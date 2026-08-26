'use client';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Copy, Lock, PartyPopper, Share2 } from 'lucide-react';
import {
  POST_KINDS,
  brand,
  contentLimits,
  defaultExpiryPresetId,
  defaultOccasionId,
  templates,
  expiryPresets,
  occasionById,
  occasions,
  type PostKind,
} from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Button } from '@/components/ui/button';
import { TemplatePicker } from '@/components/event/template-picker';
import { TextAreaField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { canUseExpiryPreset, canUseTemplate } from '@/lib/billing/entitlements';
import { api, errorMessage } from '@/lib/client/api-client';
import { formatJoinCode } from '@/lib/codes-format';
import { cn, fromDateTimeLocalValue } from '@/lib/utils';
import type { EventPreview } from '@/types/domain';

const KIND_LABELS: Record<PostKind, string> = {
  text: 'Messages',
  image: 'Photos',
  video: 'Video',
  audio: 'Voice notes',
};

/**
 * Creating an invitation.
 *
 * Occasion comes first and does real work: it picks the theme, decides whether to offer a
 * dress-code field, and sets the words on the rest of the form. Everything after the title
 * is optional, so a host in a hurry can be done in fifteen seconds and a host planning a
 * wedding can fill in every field.
 *
 * Paid choices are shown, not hidden. A theme nobody can see is a theme nobody upgrades
 * for; a locked one they can see is the whole pitch.
 */
export default function CreateEventPage() {
  const router = useRouter();
  const { notify } = useToast();
  const { actor, loading, isAnonymous } = useAuth();

  const [occasionId, setOccasionId] = useState<string>(defaultOccasionId);
  const [title, setTitle] = useState('');
  const [hostedBy, setHostedBy] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [templateId, setTemplateId] = useState<string>(
    occasionById(defaultOccasionId).defaultTemplateId,
  );
  const [templateTouched, setTemplateTouched] = useState(false);
  const [expiryPresetId, setExpiryPresetId] = useState<string>(defaultExpiryPresetId);
  const [allowedKinds, setAllowedKinds] = useState<PostKind[]>([...POST_KINDS]);
  const [allowPlusOnes, setAllowPlusOnes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ event: EventPreview; joinCode: string } | null>(null);

  const occasion = useMemo(() => occasionById(occasionId), [occasionId]);

  // Every event starts on the free plan; the picker greys out what that does not include.
  // While billing is off nothing is actually locked, so the copy below adapts rather than
  // promising a paywall the visitor will not meet.
  const planId = 'free';
  const lockedTemplateCount = templates.filter((t) => !canUseTemplate(planId, t.id)).length;

  if (!loading && (!actor || isAnonymous)) {
    return (
      <SignInPrompt
        title="Sign in to host"
        body="An invitation needs someone to send it and someone to answer to, so hosting takes an account. Replying to one never does."
      />
    );
  }

  function chooseOccasion(id: string) {
    setOccasionId(id);
    // Only follow the occasion's theme until the host expresses their own preference.
    if (!templateTouched) setTemplateId(occasionById(id).defaultTemplateId);
  }

  function toggleKind(kind: PostKind) {
    setAllowedKinds((current) =>
      current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<{ event: EventPreview; joinCode: string }>(
        '/api/events/create',
        {
          title,
          description,
          occasion: occasionId,
          hostedBy,
          templateId,
          startsAt: fromDateTimeLocalValue(startsAt),
          endsAt: null,
          location:
            locationName || locationAddress
              ? { name: locationName, address: locationAddress, url: null }
              : null,
          dressCode,
          rsvp: {
            enabled: true,
            deadline: null,
            allowPlusOnes,
            maxPartySize: allowPlusOnes ? 2 : 1,
            askNote: false,
            question: null,
          },
          expiryPresetId,
          allowedKinds,
        },
      );
      setCreated(result);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not create the invitation.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <CreatedPanel
        title={created.event.title}
        code={created.joinCode}
        eventId={created.event.id}
        onCopied={() => notify('Copied', 'success')}
        onOpen={() => router.push(`/e/${created.event.id}`)}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 py-10">
      <Link
        href="/"
        className="mb-8 w-fit text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        ← {brand.name}
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Make an invitation</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Only the first two are required. You can change everything later.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-7" noValidate>
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
            What is the occasion?
          </legend>
          <div className="flex flex-wrap gap-2">
            {occasions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseOccasion(option.id)}
                aria-pressed={occasionId === option.id}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3.5 py-2 text-sm font-medium transition-all duration-200',
                  occasionId === option.id
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]',
                )}
              >
                <span aria-hidden>{option.glyph}</span>
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <TextField
          label="What are we calling it?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={occasion.titlePlaceholder}
          maxLength={contentLimits.eventTitleMaxLength}
          required
        />

        <TextField
          label="Hosted by"
          hint="Leave blank to use your name."
          value={hostedBy}
          onChange={(e) => setHostedBy(e.target.value)}
          placeholder="Priya & Sam"
          maxLength={contentLimits.hostedByMaxLength}
        />

        <TextAreaField
          label="A note for your guests"
          hint="Optional."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Drinks from seven, dinner at eight."
          maxLength={contentLimits.eventDescriptionMaxLength}
          rows={3}
        />

        <div>
          <label
            htmlFor="starts-at"
            className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
          >
            When is it?
          </label>
          <input
            id="starts-at"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 transition-colors focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
          />
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Optional — you can send a save-the-date without one.
          </p>
        </div>

        <div className="space-y-4">
          <TextField
            label="Where?"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="The Rooftop, or just: ours"
            maxLength={contentLimits.locationNameMaxLength}
          />
          <TextField
            label="Address"
            hint="Optional."
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
            placeholder="14 Bridge Street"
            maxLength={contentLimits.locationAddressMaxLength}
          />
        </div>

        {occasion.asksDressCode && (
          <TextField
            label="Dress code"
            hint="Optional."
            value={dressCode}
            onChange={(e) => setDressCode(e.target.value)}
            placeholder="Whatever makes you happy"
            maxLength={contentLimits.dressCodeMaxLength}
          />
        )}

        <fieldset>
          <legend className="mb-3 block text-sm font-medium text-[var(--text-secondary)]">
            Pick a design
          </legend>
          <TemplatePicker
            occasionId={occasionId}
            value={templateId}
            planId={planId}
            canUse={(id) => canUseTemplate(planId, id)}
            onChange={(id) => {
              setTemplateId(id);
              setTemplateTouched(true);
            }}
          />
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {lockedTemplateCount > 0
              ? `${lockedTemplateCount} more designs come with a paid plan. `
              : 'Every design is available while we are in preview. '}
            <Link href="/templates" className="underline underline-offset-2">
              Browse them all
            </Link>
            .
          </p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
            Can guests bring someone?
          </legend>
          <div className="flex gap-2">
            {[
              [true, 'Yes, plus one'],
              [false, 'Just them'],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setAllowPlusOnes(value as boolean)}
                aria-pressed={allowPlusOnes === value}
                className={cn(
                  'rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-all duration-200',
                  allowPlusOnes === value
                    ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:bg-[var(--accent-soft)]',
                )}
              >
                {label as string}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
            What can guests post to the wall?
          </legend>
          <div className="flex flex-wrap gap-2">
            {POST_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => toggleKind(kind)}
                aria-pressed={allowedKinds.includes(kind)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-all duration-200',
                  allowedKinds.includes(kind)
                    ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
                )}
              >
                {allowedKinds.includes(kind) && <Check className="size-3.5" aria-hidden />}
                {KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
            How long should the wall stay up afterwards?
          </legend>
          <div className="flex flex-wrap gap-2">
            {expiryPresets.map((preset) => {
              const locked = !canUseExpiryPreset(planId, preset.id);
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={locked}
                  onClick={() => setExpiryPresetId(preset.id)}
                  aria-pressed={expiryPresetId === preset.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-all duration-200',
                    expiryPresetId === preset.id
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                      : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]',
                    locked && 'cursor-not-allowed opacity-45 hover:bg-[var(--surface-sunken)]',
                  )}
                >
                  {locked && <Lock className="size-3" aria-hidden />}
                  {preset.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={submitting}
          disabled={!title.trim() || allowedKinds.length === 0}
        >
          {occasion.inviteVerb}
        </Button>
      </form>
    </main>
  );
}

interface CreatedPanelProps {
  title: string;
  code: string;
  eventId: string;
  onCopied: () => void;
  onOpen: () => void;
}

/**
 * The code is shown once, here. Re-reading it later is a separate audited call from inside
 * the event, so it never turns up in a payload someone could stumble across.
 */
function CreatedPanel({ title, code, eventId, onCopied, onOpen }: CreatedPanelProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/e/${eventId}`;

  async function copy(what: 'code' | 'link') {
    await navigator.clipboard.writeText(what === 'code' ? formatJoinCode(code) : link);
    setCopied(what);
    onCopied();
    setTimeout(() => setCopied(null), 2000);
  }

  async function share() {
    if (!navigator.share) return copy('link');
    await navigator
      .share({ title, text: `You're invited to ${title}`, url: link })
      .catch(() => undefined);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
      <span className="mx-auto mb-6 inline-flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <PartyPopper className="size-6" aria-hidden />
      </span>

      <h1 className="text-3xl font-semibold tracking-tight">Your invitation is ready</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Send the link, or read the code out. Either gets your guests in.
      </p>

      <div className="card mt-8 p-8">
        <p className="code-display text-4xl font-semibold">{formatJoinCode(code)}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="soft" size="sm" onClick={() => copy('code')}>
            {copied === 'code' ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </Button>
          <Button variant="soft" size="sm" onClick={share}>
            <Share2 className="size-4" aria-hidden />
            Share the link
          </Button>
        </div>
      </div>

      <Button size="lg" className="mt-6 w-full" onClick={onOpen}>
        Open the invitation
      </Button>

      <p className="mt-4 text-sm text-[var(--text-muted)]">
        You can find the code again in the host panel, any time.
      </p>
    </main>
  );
}
