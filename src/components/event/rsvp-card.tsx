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
  partySize: number;
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
export function RsvpCard({ event, status, partySize, onAnswered }: RsvpCardProps) {
  const { notify } = useToast();
  const occasion = occasionById(event.occasion);

  const [choice, setChoice] = useState<RsvpStatus>(status);
  const [party, setParty] = useState(partySize);
  const [note, setNote] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  // Read once when the card mounts rather than on every render: a deadline is a date, and
  // re-reading the clock mid-render is both impure and pointless at that resolution.
  const [mountedAt] = useState(() => Date.now());
  const deadlinePassed = event.rsvp.deadline !== null && mountedAt > event.rsvp.deadline;
  const maxParty = event.rsvp.allowPlusOnes ? event.rsvp.maxPartySize : 1;
  const hasReplied = status !== 'pending';

  async function submit(next: RsvpStatus) {
    setChoice(next);
    setSaving(true);
    try {
      await api.post(`/api/events/${event.id}/rsvp`, {
        status: next,
        partySize: next === 'yes' ? party : 1,
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
              {maxParty > 1 && (
                <div>
                  <label
                    htmlFor="rsvp-party"
                    className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
                  >
                    How many of you, including yourself?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: maxParty }, (_, index) => index + 1).map((size) => (
                      <button
                        key={size}
                        type="button"
                        id={size === 1 ? 'rsvp-party' : undefined}
                        aria-pressed={party === size}
                        onClick={() => setParty(size)}
                        className={cn(
                          'size-11 rounded-full text-sm font-medium transition-all duration-200',
                          party === size
                            ? 'bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]'
                            : 'bg-[var(--surface-sunken)] hover:bg-[var(--accent-soft)]',
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
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
