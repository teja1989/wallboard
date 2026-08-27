'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { pendingEmailKey, takePendingReturn, useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { errorMessage } from '@/lib/client/api-client';

/**
 * Landing page for the email sign-in link.
 *
 * The address is normally recovered from localStorage, but the link may well be opened on
 * a different device than the one that requested it — so asking for it again is a
 * supported path, not an error state.
 */
export default function FinishSignInPage() {
  const router = useRouter();
  const { completeEmailLink } = useAuth();
  const [status, setStatus] = useState<'working' | 'needs-email' | 'error'>('working');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  // A sign-in link is single-use. React runs effects twice in development, and a browser
  // can replay a navigation, so without this guard the second attempt fails on a code the
  // first one already consumed — showing an error to someone who is now signed in.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    // Deliberately no cancellation guard: the exchange consumes the one-time code either
    // way, so abandoning its result on unmount would strand a signed-in visitor here.
    void (async () => {
      const stored = window.localStorage.getItem(pendingEmailKey);
      if (!stored) {
        setStatus('needs-email');
        return;
      }
      try {
        await completeEmailLink(stored);
        // Back to whatever they were doing when signing in interrupted them.
        router.replace(takePendingReturn());
      } catch (caught) {
        setMessage(errorMessage(caught, 'That link could not be used.'));
        setStatus('error');
      }
    })();
  }, [completeEmailLink, router]);

  async function submitEmail() {
    setStatus('working');
    try {
      await completeEmailLink(email);
      router.replace(takePendingReturn());
    } catch (caught) {
      setMessage(errorMessage(caught, 'That link could not be used.'));
      setStatus('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-center">
      {status === 'working' && (
        <p className="flex items-center justify-center gap-2 text-[var(--text-secondary)]">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Signing you in…
        </p>
      )}

      {status === 'needs-email' && (
        <div className="space-y-4 text-left">
          <h1 className="text-center text-2xl font-semibold">Confirm your email</h1>
          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            hint="The address this link was sent to."
            autoComplete="email"
          />
          <Button className="w-full" onClick={submitEmail} disabled={!email}>
            Continue
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <p role="alert" className="text-[var(--danger)]">
            {message}
          </p>
          <Button variant="soft" onClick={() => router.replace('/')}>
            Back to start
          </Button>
        </div>
      )}
    </main>
  );
}
