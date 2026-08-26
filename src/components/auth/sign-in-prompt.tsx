'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { appConfig } from '@/config';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/client/api-client';

interface SignInPromptProps {
  title?: string;
  body?: string;
  /** Rendered inline (inside a wall) rather than as a full page. */
  compact?: boolean;
}

/**
 * Sign-in surface. Both paths *link* the credential to the current anonymous session where
 * there is one, so a guest who has already joined an event keeps their uid — their
 * membership and anything they posted stay theirs.
 */
export function SignInPrompt({ title, body, compact = false }: SignInPromptProps) {
  const { upgradeWithGoogle, sendEmailLink } = useAuth();
  const { notify } = useToast();
  const [email, setEmail] = useState('');
  // With no OAuth client configured for the project there is no Google button, so the
  // email form is the only way in and opens expanded rather than behind a second tap.
  const googleAvailable = appConfig.auth.googleSignIn;
  const [showEmail, setShowEmail] = useState(!googleAvailable);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);

  async function handleGoogle() {
    setBusy('google');
    try {
      await upgradeWithGoogle();
    } catch (caught) {
      notify(errorMessage(caught, 'Google sign-in did not complete.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleEmail(event: FormEvent) {
    event.preventDefault();
    setBusy('email');
    try {
      await sendEmailLink(email);
      notify('Check your inbox for the sign-in link.', 'success');
      setShowEmail(false);
    } catch (caught) {
      notify(errorMessage(caught, 'Could not send that link.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const content = (
    <>
      {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
      {body && <p className="mt-2 text-[var(--text-secondary)]">{body}</p>}

      <div className="mt-6 space-y-3">
        {googleAvailable && (
          <Button size="lg" className="w-full" loading={busy === 'google'} onClick={handleGoogle}>
            Continue with Google
          </Button>
        )}

        {showEmail ? (
          <form onSubmit={handleEmail} className="space-y-3 text-left">
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <Button
              type="submit"
              size={googleAvailable ? 'md' : 'lg'}
              variant={googleAvailable ? 'soft' : 'primary'}
              className="w-full"
              loading={busy === 'email'}
            >
              Send me a link
            </Button>
          </form>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setShowEmail(true)}>
            <Mail className="size-4" aria-hidden />
            Use an email link instead
          </Button>
        )}
      </div>
    </>
  );

  if (compact) return <div className="card p-6 text-center">{content}</div>;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
      <Link
        href="/"
        className="mb-8 w-fit text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        ← Back
      </Link>
      {content}
    </main>
  );
}
