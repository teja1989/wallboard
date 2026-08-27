'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { clearDraft, loadDraft, saveDraft } from '@/lib/client/event-draft';
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
 *
 * Anyone can build one; the account is asked for at publish. Hosting genuinely does need
 * a durable identity — the host alone can delete the event, read private replies and
 * rotate the code, and an anonymous session lives in browser storage that a cleared cookie
 * takes with it. But none of that is true of a form nobody has submitted, and demanding
 * identity before showing anything is a wall in front of an unseen product. Asked at
 * publish, the same question answers itself: sign in so that only you can change this.
 *
 * The uid survives the upgrade — `linkWithCredential` keeps it — so the draft stays the
 * same person's. The email-link path leaves the site for an inbox, which is why the draft
 * is persisted before the link is sent and resumed on the way back.
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
  /** Set when publish was pressed without an account: the form yields to the sign-in step. */
  const [needsAccount, setNeedsAccount] = useState(false);
  const [restored, setRestored] = useState(false);
  const resumed = useRef(false);

  const occasion = useMemo(() => occasionById(occasionId), [occasionId]);

  // Every event starts on the free plan; the picker greys out what that does not include.
  // While billing is off nothing is actually locked, so the copy below adapts rather than
  // promising a paywall the visitor will not meet.
  const planId = 'free';
  const lockedTemplateCount = templates.filter((t) => !canUseTemplate(planId, t.id)).length;

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

  /** The form, in the shape the draft store keeps it. */
  const draftFields = useMemo(
    () => ({
      occasionId,
      title,
      hostedBy,
      description,
      startsAt,
      locationName,
      locationAddress,
      dressCode,
      templateId,
      templateTouched,
      expiryPresetId,
      allowedKinds,
      allowPlusOnes,
    }),
    [
      occasionId,
      title,
      hostedBy,
      description,
      startsAt,
      locationName,
      locationAddress,
      dressCode,
      templateId,
      templateTouched,
      expiryPresetId,
      allowedKinds,
      allowPlusOnes,
    ],
  );

  const publish = useCallback(async (fields: typeof draftFields) => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<{ event: EventPreview; joinCode: string }>(
        '/api/events/create',
        {
          title: fields.title,
          description: fields.description,
          occasion: fields.occasionId,
          hostedBy: fields.hostedBy,
          templateId: fields.templateId,
          startsAt: fromDateTimeLocalValue(fields.startsAt),
          endsAt: null,
          location:
            fields.locationName || fields.locationAddress
              ? { name: fields.locationName, address: fields.locationAddress, url: null }
              : null,
          dressCode: fields.dressCode,
          rsvp: {
            enabled: true,
            deadline: null,
            allowPlusOnes: fields.allowPlusOnes,
            maxPartySize: fields.allowPlusOnes ? 2 : 1,
            askNote: false,
            question: null,
          },
          expiryPresetId: fields.expiryPresetId,
          allowedKinds: fields.allowedKinds,
        },
      );
      // Published: the draft has served its purpose and the event is the record now.
      clearDraft();
      setCreated(result);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not create the invitation.'));
    } finally {
      setSubmitting(false);
    }
  }, []);

  /**
   * The gate, at the only point it earns its place. An anonymous host keeps their work:
   * the draft is written before anything can navigate away, and picked up again below.
   */
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!actor || isAnonymous) {
      saveDraft({ ...draftFields, pendingPublish: true });
      setNeedsAccount(true);
      return;
    }
    void publish(draftFields);
  }

  /**
   * Keep the work, continuously.
   *
   * Not only for the sign-in trip: a closed tab, a refresh, or a phone that drops the page
   * to reclaim memory all cost a host everything they had typed. `pendingPublish` stays
   * false here — this is a draft someone is still writing, and coming back to it later
   * must never send it on its own.
   */
  useEffect(() => {
    if (created || needsAccount || !title.trim()) return;
    saveDraft({ ...draftFields, pendingPublish: false });
  }, [draftFields, created, needsAccount, title]);

  /**
   * Coming back from an email link, in a new tab, with the form empty.
   *
   * Restores what was typed and finishes the job they already asked for — they pressed
   * publish before being interrupted, so making them press it a second time is asking
   * twice for one decision. Runs once, and only when there is genuinely a session.
   */
  useEffect(() => {
    if (loading || resumed.current) return;
    if (!actor || isAnonymous) return;

    resumed.current = true;
    void (async () => {
      const draft = loadDraft();
      if (!draft) return;

      setOccasionId(draft.occasionId);
      setTitle(draft.title);
      setHostedBy(draft.hostedBy);
      setDescription(draft.description);
      setStartsAt(draft.startsAt);
      setLocationName(draft.locationName);
      setLocationAddress(draft.locationAddress);
      setDressCode(draft.dressCode);
      setTemplateId(draft.templateId);
      setTemplateTouched(draft.templateTouched);
      setExpiryPresetId(draft.expiryPresetId);
      setAllowedKinds(draft.allowedKinds);
      setAllowPlusOnes(draft.allowPlusOnes);
      setNeedsAccount(false);
      setRestored(true);

      // Only auto-publish what publish was already pressed on. A draft merely left behind
      // is restored and left alone, so nobody's half-written invitation goes out because
      // they signed in for some other reason.
      if (draft.pendingPublish && draft.title.trim() && draft.allowedKinds.length > 0) {
        await publish({
          occasionId: draft.occasionId,
          title: draft.title,
          hostedBy: draft.hostedBy,
          description: draft.description,
          startsAt: draft.startsAt,
          locationName: draft.locationName,
          locationAddress: draft.locationAddress,
          dressCode: draft.dressCode,
          templateId: draft.templateId,
          templateTouched: draft.templateTouched,
          expiryPresetId: draft.expiryPresetId,
          allowedKinds: draft.allowedKinds,
          allowPlusOnes: draft.allowPlusOnes,
        });
      }
    })();
  }, [actor, isAnonymous, loading, publish]);

  /**
   * The ask, at the moment it makes sense. The host has already built the thing; what is
   * being requested is a way to keep it theirs, which is a reason rather than a toll.
   */
  if (needsAccount) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
        <button
          type="button"
          onClick={() => setNeedsAccount(false)}
          className="mb-8 w-fit text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          ← Back to editing
        </button>
        <SignInPrompt
          title="Almost there"
          body={`Sign in and “${title.trim()}” goes out. It takes an account because you are the only one who should be able to change it, delete it, or read what your guests write to you privately.`}
          note="Your invitation is saved — signing in will not lose it."
          onSignedIn={() => {
            setNeedsAccount(false);
            void publish(draftFields);
          }}
        />
      </main>
    );
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

      {/*
        Someone who left to fetch a sign-in link comes back to a tab that never held their
        work. Saying so is the difference between trusting the form and retyping into it.
      */}
      {restored && !submitting && (
        <p
          role="status"
          className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]"
        >
          Welcome back — we kept what you had written.
        </p>
      )}

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
