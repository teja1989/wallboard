'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Copy, PartyPopper } from 'lucide-react';
import {
  POST_KINDS,
  contentLimits,
  defaultExpiryPresetId,
  eventThemes,
  expiryPresets,
  type PostKind,
} from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Button } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { formatJoinCode } from '@/lib/codes-format';
import { cn } from '@/lib/utils';
import type { EventPreview } from '@/types/domain';

const KIND_LABELS: Record<PostKind, string> = {
  text: 'Messages',
  image: 'Photos',
  video: 'Video',
  audio: 'Voice notes',
};

export default function CreateEventPage() {
  const router = useRouter();
  const { notify } = useToast();
  const { actor, loading, isAnonymous } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [themeId, setThemeId] = useState<string>(eventThemes[0].id);
  const [expiryPresetId, setExpiryPresetId] = useState<string>(defaultExpiryPresetId);
  const [allowedKinds, setAllowedKinds] = useState<PostKind[]>([...POST_KINDS]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ event: EventPreview; joinCode: string } | null>(null);

  // Creating an event attributes it to a real person, so this page requires an account
  // even though watching a wall does not.
  if (!loading && (!actor || isAnonymous)) {
    return (
      <SignInPrompt
        title="Sign in to host"
        body="An event needs an owner who can moderate it, so hosting takes an account. Watching a wall never does."
      />
    );
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
        { title, description, themeId, expiryPresetId, allowedKinds },
      );
      setCreated(result);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not create the event.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <CreatedPanel
        code={created.joinCode}
        eventId={created.event.id}
        onCopied={() => notify('Code copied', 'success')}
        onOpen={() => router.push(`/e/${created.event.id}`)}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 py-12">
      <Link
        href="/"
        className="mb-8 w-fit text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        ← Back
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Start an event</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        You will get a code to share. Everything posted disappears when the event ends.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        <TextField
          label="What is it?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Priya's birthday"
          maxLength={contentLimits.eventTitleMaxLength}
          required
          autoFocus
        />

        <TextAreaField
          label="A note for guests"
          hint="Optional."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Post your photos from tonight here."
          maxLength={contentLimits.eventDescriptionMaxLength}
          rows={3}
        />

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
            How long should it last?
          </legend>
          <div className="flex flex-wrap gap-2">
            {expiryPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setExpiryPresetId(preset.id)}
                aria-pressed={expiryPresetId === preset.id}
                className={cn(
                  'rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-all duration-200',
                  expiryPresetId === preset.id
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
            What can guests post?
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
            Colour
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {eventThemes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setThemeId(theme.id)}
                aria-pressed={themeId === theme.id}
                aria-label={theme.label}
                title={theme.label}
                className={cn(
                  'size-10 rounded-full transition-all duration-200',
                  themeId === theme.id
                    ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-page)]'
                    : 'ring-1 ring-[var(--border-subtle)] hover:scale-105',
                )}
                style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
              />
            ))}
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
          Create the wall
        </Button>
      </form>
    </main>
  );
}

interface CreatedPanelProps {
  code: string;
  eventId: string;
  onCopied: () => void;
  onOpen: () => void;
}

/**
 * The code is shown once, right here. Re-reading it later is a separate audited call from
 * inside the event, so it never appears in a payload someone could stumble across.
 */
function CreatedPanel({ code, eventId, onCopied, onOpen }: CreatedPanelProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(formatJoinCode(code));
    setCopied(true);
    onCopied();
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
      <span className="mx-auto mb-6 inline-flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <PartyPopper className="size-6" aria-hidden />
      </span>

      <h1 className="text-3xl font-semibold tracking-tight">Your wall is live</h1>
      <p className="mt-2 text-[var(--text-secondary)]">Share this code with your guests.</p>

      <div className="card mt-8 p-8">
        <p className="code-display text-4xl font-semibold">{formatJoinCode(code)}</p>
        <Button variant="soft" size="sm" className="mt-5" onClick={copy}>
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? 'Copied' : 'Copy code'}
        </Button>
      </div>

      <Button size="lg" className="mt-6 w-full" onClick={onOpen}>
        Open the wall
      </Button>

      <p className="mt-4 text-sm text-[var(--text-muted)]">
        You can find this code again in the event&rsquo;s host panel.
      </p>
      <Link href={`/e/${eventId}`} className="sr-only">
        Open event
      </Link>
    </main>
  );
}
