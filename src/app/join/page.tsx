'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { joinCodeConfig } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/client/api-client';
import { formatJoinCode } from '@/lib/codes-format';
import type { EventPreview } from '@/types/domain';

/**
 * Code entry. Signing in as a guest happens silently on mount so that redeeming a code is
 * a single action — the visitor types eight characters and lands on the wall.
 */
export default function JoinPage() {
  const router = useRouter();
  const { signInAsGuest, loading } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading) void signInAsGuest();
  }, [loading, signInAsGuest]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInAsGuest();
      const result = await api.post<{ event: EventPreview }>('/api/events/join', { code });
      router.push(`/e/${result.event.id}`);
    } catch (caught) {
      setError(errorMessage(caught, 'That code did not work.'));
      setSubmitting(false);
    }
  }

  const ready = code.replace(/-/g, '').length === joinCodeConfig.length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 w-fit text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        ← Back
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Join an event</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Enter the {joinCodeConfig.length}-character code the host shared with you.
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
          Open the wall
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
        You can watch without an account. Signing in lets you post.
      </p>
    </main>
  );
}
