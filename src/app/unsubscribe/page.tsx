'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { brand } from '@/config';
import { api, errorMessage } from '@/lib/client/api-client';

/**
 * Opting out of an event's emails.
 *
 * Acts on load rather than asking someone to confirm. A person who clicked "stop emailing
 * me" has already made their decision, and a confirmation step here is a dark pattern with
 * a friendly face.
 */
function UnsubscribeInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState<string | null>(null);
  // The request is not idempotent from the user's point of view, and Strict Mode runs
  // effects twice — the guard keeps the second run from reporting a spurious failure.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    // Wrapped in an async callback so no state is set synchronously in the effect body.
    void (async () => {
      const eventId = params.get('e');
      const email = params.get('a');
      const token = params.get('t');

      if (!eventId || !email || !token) {
        setMessage('That link is incomplete. Try the one in the email again.');
        setStatus('error');
        return;
      }

      try {
        await api.post('/api/unsubscribe', { eventId, email, token });
        setStatus('done');
      } catch (caught) {
        setMessage(errorMessage(caught, 'That link could not be used.'));
        setStatus('error');
      }
    })();
  }, [params]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-center">
      {status === 'working' && (
        <p className="flex items-center justify-center gap-2 text-[var(--text-secondary)]">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          One moment…
        </p>
      )}

      {status === 'done' && (
        <>
          <span className="mx-auto mb-5 inline-flex size-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">That is done</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            You will not get any more emails about this event. If you still want to come, you can
            always open the invitation with the link you already have.
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">We could not do that</h1>
          <p role="alert" className="mt-2 text-[var(--text-secondary)]">
            {message}
          </p>
        </>
      )}

      <Link
        href="/"
        className="mt-8 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        {brand.name}
      </Link>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}
