'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, PartyPopper } from 'lucide-react';
import {
  contentLimits,
  motion as motionTokens,
  occasionById,
  rsvpChoices,
  rsvpLabels,
  type RsvpStatus,
} from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { cn, formatDateOnly } from '@/lib/utils';
import type { EventDoc } from '@/types/domain';

interface RsvpCardProps {
  event: EventDoc;
  /** The viewer's current answer, or `pending` if they have not replied. */
  status: RsvpStatus;
  adults: number;
  /** Not `children`: React reserves that prop name for nested elements. */
  childGuests: number;
  onAnswered: () => void;
}

/**
 * The reply.
 *
 * Three big targets rather than a dropdown, because this is the single action the whole
 * invitation exists to collect and it is usually done one-handed on a phone. Party size
 * and the note only appear after "Going" is chosen — asking how many people are coming
 * before someone has said they are coming is the wrong order.
 */
export function RsvpCard({ event, status, adults, childGuests, onAnswered }: RsvpCardProps) {
  const { notify } = useToast();
  const occasion = occasionById(event.occasion);

  const [choice, setChoice] = useState<RsvpStatus>(status);
  const [adultCount, setAdultCount] = useState(adults);
  const [childCount, setChildCount] = useState(childGuests);
  const [note, setNote] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  // Read once when the card mounts rather than on every render: a deadline is a date, and
  // re-reading the clock mid-render is both impure and pointless at that resolution.
  const [mountedAt] = useState(() => Date.now());
  const deadlinePassed = event.rsvp.deadline !== null && mountedAt > event.rsvp.deadline;
  const maxParty = event.rsvp.allowPlusOnes ? event.rsvp.maxPartySize : 1;
  const party = adultCount + childCount;
  /** What is left before the host's limit — a stepper that cannot say why it stopped is worse. */
  const remaining = maxParty - party;
  const hasReplied = status !== 'pending';

  async function submit(next: RsvpStatus) {
    setChoice(next);
    setSaving(true);
    try {
      await api.post(`/api/events/${event.id}/rsvp`, {
        status: next,
        adults: next === 'yes' ? adultCount : 1,
        children: next === 'yes' ? childCount : 0,
        note,
        answer,
      });
      notify(
        next === 'yes' ? 'Wonderful — you are on the list.' : 'Thanks for letting us know.',
        'success',
      );
      onAnswered();
    } catch (caught) {
      setChoice(status);
      notify(errorMessage(caught, 'That reply did not save.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!event.rsvp.enabled) return null;

  if (deadlinePassed && !hasReplied) {
    return (
      <div className="card p-5 text-center">
        <p className="font-medium">Replies have closed</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          The date for replies was {formatDateOnly(event.rsvp.deadline)}. Message {event.hostedBy}{' '}
          directly if you would still like to come.
        </p>
      </div>
    );
  }

  return (
    <section className="card p-5" aria-labelledby="rsvp-heading">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="rsvp-heading" className="font-semibold">
            {occasion.rsvpPrompt}
          </h2>
          {event.rsvp.deadline !== null && !hasReplied && (
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Please reply by {formatDateOnly(event.rsvp.deadline)}.
            </p>
          )}
        </div>
        {hasReplied && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium">
            <Check className="size-3.5" aria-hidden />
            {rsvpLabels[status]}
          </span>
        )}
      </div>

      <div role="radiogroup" aria-labelledby="rsvp-heading" className="grid grid-cols-3 gap-2">
        {rsvpChoices.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={choice === option}
            disabled={saving || (deadlinePassed && option !== status)}
            onClick={() => (option === 'yes' ? setChoice('yes') : void submit(option))}
            className={cn(
              'rounded-2xl px-3 py-3.5 text-sm font-medium transition-all duration-200',
              'disabled:opacity-50',
              choice === option
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[var(--shadow-soft)]'
                : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]',
            )}
          >
            {rsvpLabels[option]}
          </button>
        ))}
      </div>

      {/* Only shown once someone has said yes — the details follow the decision. */}
      <AnimatePresence initial={false}>
        {choice === 'yes' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={motionTokens.base}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-4">
              {/*
                Who, not just how many. A host counting chairs, meals and car seats needs
                to know that "three" is two adults and a toddler — and asking costs the
                guest one extra tap only if they have someone to bring.
              */}
              {maxParty > 1 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    Bringing anyone with you?
                  </p>

                  <Stepper
                    id="rsvp-adults"
                    label="Adults"
                    hint="Including you"
                    value={adultCount}
                    min={1}
                    canIncrease={remaining > 0}
                    onChange={setAdultCount}
                  />
                  <Stepper
                    id="rsvp-children"
                    label="Children"
                    value={childCount}
                    min={0}
                    canIncrease={remaining > 0}
                    onChange={setChildCount}
                  />

                  <p className="text-xs text-[var(--text-muted)]">
                    {remaining > 0
                      ? `${party} of you so far. This invitation covers up to ${maxParty}.`
                      : `That is the ${maxParty} this invitation covers.`}
                  </p>
                </div>
              )}

              {event.rsvp.question && (
                <div>
                  <label
                    htmlFor="rsvp-answer"
                    className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
                  >
                    {event.rsvp.question}
                  </label>
                  <input
                    id="rsvp-answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    maxLength={contentLimits.rsvpAnswerMaxLength}
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 transition-colors focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
              )}

              {event.rsvp.askNote && (
                <div>
                  <label
                    htmlFor="rsvp-note"
                    className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
                  >
                    A note for {event.hostedBy}
                  </label>
                  <textarea
                    id="rsvp-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={contentLimits.rsvpNoteMaxLength}
                    placeholder="Only they will see this."
                    className="w-full resize-none rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
              )}

              <Button className="w-full" size="lg" loading={saving} onClick={() => submit('yes')}>
                <PartyPopper className="size-4" aria-hidden />
                {hasReplied ? 'Update my reply' : "I'll be there"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

interface StepperProps {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  canIncrease: boolean;
  onChange: (next: number) => void;
}

/**
 * A counter with two big targets.
 *
 * Not a number input: on a phone that summons a keyboard over the thing you are filling
 * in, and the range here is small enough that tapping is faster than typing anyway.
 */
function Stepper({ id, label, hint, value, min, canIncrease, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm">
        {label}
        {hint && <span className="ml-1.5 text-xs text-[var(--text-muted)]">{hint}</span>}
      </label>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`One fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="size-10 rounded-full bg-[var(--surface-sunken)] text-lg transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-40"
        >
          −
        </button>
        <output id={id} className="w-8 text-center text-sm font-semibold tabular-nums">
          {value}
        </output>
        <button
          type="button"
          aria-label={`One more ${label.toLowerCase()}`}
          disabled={!canIncrease}
          onClick={() => onChange(value + 1)}
          className="size-10 rounded-full bg-[var(--surface-sunken)] text-lg transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
