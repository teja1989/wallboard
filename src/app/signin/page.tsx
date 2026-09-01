'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { brand } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Button } from '@/components/ui/button';

/**
 * Signing in, on its own.
 *
 * While hosting was gated at the door, `/create` was the sign-in page by accident — you
 * could not reach the form without passing through it. Opening that door left a host with
 * a new phone, or a cleared browser, no way back to the invitations they already own. This
 * is that way back.
 *
 * `?next=` lets a page send someone here and get them returned. Restricted to same-site
 * paths: an open redirect on a sign-in page is how a phishing link borrows your domain.
 */
export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { actor, isAnonymous, loading } = useAuth();

  const requested = params.get('next') ?? '';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/create';

  const signedIn = !loading && actor && !isAnonymous;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
      <Link
        href="/"
        className="mb-8 w-fit text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        ← {brand.name}
      </Link>

      {signedIn ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">You are signed in</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            {actor.displayName ? `Welcome back, ${actor.displayName}.` : 'Welcome back.'}
          </p>
          <div className="mt-6">
            <Button size="lg" className="w-full" onClick={() => router.push(next)}>
              Make an invitation
            </Button>
          </div>
        </>
      ) : (
        <SignInPrompt
          title="Sign in"
          body="To pick up an invitation you already made, or to send a new one."
          returnTo={next}
          onSignedIn={() => router.push(next)}
        />
      )}
    </main>
  );
}
