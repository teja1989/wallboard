'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { joinCodeConfig } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/client/api-client';
import { formatJoinCode } from '@/lib/codes-format';
import type { EventPreview } from '@/types/domain';

/**
 * Code entry. Signing in as a guest happens silently on mount so that redeeming a code is
 * a single action — the visitor types eight characters and lands on the wall.
 *
 * `?code=` is how an emailed invitation arrives. The whole promise of that message is "one
 * tap, no account, no app", so a recipient who followed it should not then be asked to
 * copy eight characters out of the URL they just clicked: the code is filled in and
 * redeemed for them, and they land on the invitation. If it fails — a rotated code, an
 * ended event — the form is right there with the reason.
 */
export default function JoinPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { signInAsGuest, loading } = useAuth();
  const [code, setCode] = useState(() => params.get('code') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const autoRedeemed = useRef(false);

  useEffect(() => {
    if (!loading) void signInAsGuest();
  }, [loading, signInAsGuest]);

  const redeem = useCallback(
    async (value: string) => {
      setError(null);
      setSubmitting(true);
      try {
        await signInAsGuest();
        const result = await api.post<{ event: EventPreview }>('/api/events/join', {
          code: value,
        });
        router.push(`/e/${result.event.id}`);
      } catch (caught) {
        setError(errorMessage(caught, 'That code did not work.'));
        setSubmitting(false);
      }
    },
    [router, signInAsGuest],
  );

  // Arriving from an invitation: redeem what the link carried, once.
  useEffect(() => {
    if (loading || autoRedeemed.current) return;
    const fromLink = params.get('code');
    if (!fromLink || fromLink.replace(/-/g, '').length !== joinCodeConfig.length) return;

    autoRedeemed.current = true;
    // Inside an async callback rather than the effect body: `redeem` sets state on its
    // first line, and doing that synchronously during an effect cascades renders.
    void (async () => {
      await redeem(fromLink);
    })();
  }, [loading, params, redeem]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void redeem(code);
  }

  const ready = code.replace(/-/g, '').length === joinCodeConfig.length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-bold text-[var(--text-primary)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
      >
        <ArrowLeft className="size-3.5" />
        Back to Home
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Open your invitation</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Enter the {joinCodeConfig.length}-character code your host sent you.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <label htmlFor="join-code" className="sr-only">
            Event code
          </label>
          <input
            id="join-code"
            value={code}
            onChange={(event) => {
              // Formats as the visitor types, but only ever holds normalized characters.
              const raw = event.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, joinCodeConfig.length);
              setCode(formatJoinCode(raw));
              setError(null);
            }}
            placeholder="ABCD-EFGH"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'join-error' : undefined}
            className="code-display w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 py-5 text-center text-2xl font-semibold uppercase transition-colors focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
          />
        </div>

        {error && (
          <p id="join-error" role="alert" className="text-center text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!ready}>
          Open it
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
        No account needed to reply. Signing in lets you post to the wall too.
      </p>
    </main>
  );
}
