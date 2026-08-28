'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { brand } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/client/api-client';
import type { EventPreview } from '@/types/domain';

interface InvitationRedeemerProps {
  code: string;
  /** Null when the code is unknown, in which case there is nothing to record against. */
  eventId: string | null;
  /** From `?g=` — which guest is holding this link. Null for the shared link. */
  guestToken: string | null;
  /** Rendered while redeeming so the page is never blank. Null when the code is unknown. */
  title: string | null;
  hostedBy: string | null;
}

/**
 * Turning a followed invitation into membership.
 *
 * The message promised "one tap — no account, no app", so this asks for nothing: the guest
 * identity is bootstrapped silently, the code the link carried is redeemed, and the
 * invitation opens. The only thing anyone should ever have to do here is arrive.
 *
 * When that fails — a rotated code, an event already over — it says which, and offers the
 * manual entry rather than dead-ending on an apology.
 */
export function InvitationRedeemer({
  code,
  eventId,
  guestToken,
  title,
  hostedBy,
}: InvitationRedeemerProps) {
  const router = useRouter();
  const { signInAsGuest, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const redeemed = useRef(false);
  const beaconed = useRef(false);

  const redeem = useCallback(async () => {
    try {
      await signInAsGuest();
      const result = await api.post<{ event: EventPreview }>('/api/events/join', { code });
      router.replace(`/e/${result.event.id}`);
    } catch (caught) {
      setError(errorMessage(caught, 'That invitation link did not work.'));
    }
  }, [code, router, signInAsGuest]);

  /**
   * Tell the host their guest looked.
   *
   * Its own effect, deliberately: it must not be blocked on signing in or on the code
   * redeeming, because a guest whose code has been rotated still opened the invitation and
   * the host still wants to know. Failure is silent — a guest's evening does not depend on
   * our analytics.
   */
  useEffect(() => {
    // Fired with or without a token. A token attributes the view to one guest; without one it
    // still counts toward "somebody opened this", which is the first ratio in the funnel and
    // the denominator for the rest. Most real invitations are shared rather than sent, so
    // counting only the attributable opens would have read low by exactly the wrong amount.
    if (!eventId || beaconed.current) return;
    beaconed.current = true;
    void (async () => {
      await api
        .post(`/api/events/${eventId}/invites/view`, guestToken ? { token: guestToken } : {})
        .catch(() => undefined);
    })();
  }, [eventId, guestToken]);

  useEffect(() => {
    if (loading || redeemed.current) return;
    redeemed.current = true;
    void (async () => {
      await redeem();
    })();
  }, [loading, redeem]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
      {error ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">This invitation did not open</h1>
          <p className="mt-2 text-[var(--text-secondary)]">{error}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            The host may have made a new code, or the event may be over. Asking them for a fresh
            link is the quickest fix.
          </p>
          <div className="mt-6 space-y-3">
            <Button size="lg" className="w-full" onClick={() => router.push('/join')}>
              Enter a code instead
            </Button>
            <Link
              href="/"
              className="block text-sm text-[var(--text-muted)] underline underline-offset-4"
            >
              Go to {brand.name}
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">
            {title ?? 'Opening your invitation'}
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            {hostedBy ? `From ${hostedBy} — one moment.` : 'One moment.'}
          </p>
        </>
      )}
    </main>
  );
}
