'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { appConfig, authProviders, brand, type AuthProviderId } from '@/config';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/client/api-client';

interface SignInPromptProps {
  title?: string;
  body?: string;
  /** Rendered inline (inside a wall) rather than as a full page. */
  compact?: boolean;
  /**
   * Fired once the account exists and the session is live — only reachable on a popup
   * provider, which keeps the page alive. The email link leaves the site entirely, so
   * anything that must survive it has to be persisted before the link is sent.
   */
  onSignedIn?: () => void;
  /** Shown under the options. Somewhere to reassure a host their draft is safe. */
  note?: string;
  /** Where the email link should return them. Defaults to the current page. */
  returnTo?: string;
}

/**
 * Signing in.
 *
 * Every way in is a full-width row of the same size, because the previous version made
 * Google a filled button and the email link a faint ghost underneath — which reads as "this
 * is the real one and here is a fallback", and quietly penalises anyone without a Google
 * account. They are alternatives, not a default and a consolation.
 *
 * Both paths *link* the credential to the current anonymous session where there is one, so
 * a guest who has already joined an event keeps their uid — their membership and anything
 * they posted stay theirs.
 */
export function SignInPrompt({
  title,
  body,
  compact = false,
  onSignedIn,
  note,
  returnTo,
}: SignInPromptProps) {
  const { upgradeWithGoogle, sendEmailLink, signInWithDevAccount } = useAuth();
  const { notify } = useToast();
  const [email, setEmail] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState<AuthProviderId | 'email' | 'dev' | null>(null);

  const providers = authProviders(appConfig.auth.googleSignIn).filter((p) => p.enabled);

  async function handleDevSignIn(devEmail: string, devName: string) {
    setBusy('dev');
    try {
      await signInWithDevAccount(devEmail, devName);
      notify(`Signed in as ${devName} (${devEmail})`, 'success');
      onSignedIn?.();
    } catch (caught) {
      notify(errorMessage(caught, 'Could not complete dev sign in.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function signInWith(id: AuthProviderId) {
    setBusy(id);
    try {
      // Only Google is live; the list is what makes adding the next one small.
      if (id === 'google') await upgradeWithGoogle();
      onSignedIn?.();
    } catch (caught) {
      notify(errorMessage(caught, 'That did not complete. Try again.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleEmail(event: FormEvent) {
    event.preventDefault();
    setBusy('email');
    try {
      await sendEmailLink(email, returnTo);
      setSent(email);
    } catch (caught) {
      notify(errorMessage(caught, 'Could not send that link.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  /**
   * After the link is sent, the page's job changes completely: the person is about to
   * leave for their inbox, and what they need is confirmation of which address it went to
   * and a way back if it was the wrong one.
   */
  if (sent) {
    const content = (
      <>
        <span className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <Mail className="size-5" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          We sent a sign-in link to <strong className="font-medium">{sent}</strong>. It opens you
          straight back here.
        </p>
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Nothing yet? It can take a minute, and it sometimes lands in spam.{' '}
          <button
            type="button"
            onClick={() => {
              setSent(null);
              setShowEmail(true);
            }}
            className="underline underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
          >
            Use a different address
          </button>
        </p>
      </>
    );
    return compact ? <div className="card p-6 text-center">{content}</div> : content;
  }

  const content = (
    <>
      {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
      {body && <p className="mt-2 text-[var(--text-secondary)]">{body}</p>}

      <div className="mt-6 space-y-2.5">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={busy !== null}
            onClick={() => signInWith(provider.id)}
            className={cn(
              'flex h-13 w-full items-center gap-3 rounded-[var(--radius-pill)] border border-[var(--border-subtle)]',
              'bg-[var(--surface-raised)] px-5 text-base font-medium transition-all duration-200',
              'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] active:scale-[0.99]',
              'disabled:opacity-60',
            )}
          >
            <span
              aria-hidden
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: provider.tint }}
            >
              {provider.label.charAt(0)}
            </span>
            <span>
              {busy === provider.id ? 'Just a moment…' : `Continue with ${provider.label}`}
            </span>
          </button>
        ))}

        {/* An equal, not a fallback. Same height, same shape, its own icon. */}
        {showEmail ? (
          <form onSubmit={handleEmail} className="space-y-2.5 pt-1 text-left">
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <Button type="submit" size="lg" className="w-full" loading={busy === 'email'}>
              Email me a link
            </Button>
          </form>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setShowEmail(true)}
            className={cn(
              'flex h-13 w-full items-center gap-3 rounded-[var(--radius-pill)] border border-[var(--border-subtle)]',
              'bg-[var(--surface-raised)] px-5 text-base font-medium transition-all duration-200',
              'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] active:scale-[0.99]',
              'disabled:opacity-60',
            )}
          >
            <span
              aria-hidden
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)]"
            >
              <Mail className="size-3.5" aria-hidden />
            </span>
            <span>Continue with email</span>
          </button>
        )}

        {/* Local Emulator 1-Click Fast Sign-In */}
        {appConfig.useEmulators && (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-left">
            <div className="flex items-center justify-between text-[0.7rem] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-2">
              <span>⚡ Fast Dev Sign-In (Local)</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => handleDevSignIn('priya@example.com', 'Priya Sharma')}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-[var(--surface-raised)] px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-amber-500 transition-all text-left truncate"
              >
                <span>👑</span>
                <span className="truncate">Host: Priya</span>
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => handleDevSignIn('you@example.com', 'Admin Owner')}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-[var(--surface-raised)] px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-amber-500 transition-all text-left truncate"
              >
                <span>🛡️</span>
                <span className="truncate">Admin Owner</span>
              </button>
            </div>
          </div>
        )}

        {note && <p className="pt-1 text-xs text-[var(--text-muted)]">{note}</p>}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-[var(--text-muted)]">
        No password to forget. {brand.name} never posts anything anywhere on your behalf.
      </p>
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
