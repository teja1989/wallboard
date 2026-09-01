'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, TriangleAlert } from 'lucide-react';
import { brand, formatPrice, planById } from '@/config';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/client/api-client';

/**
 * The development checkout.
 *
 * Not a stub — pressing the button posts a real event to the real webhook, which applies a
 * real plan change through the same code path Stripe drives in production. That is the
 * whole point: the upgrade flow is exercised end to end in development and in CI, and
 * switching to Stripe changes one environment variable rather than a code path.
 *
 * Loudly labelled, and the server refuses to mint a session for it unless the billing
 * driver is `mock` — a checkout that takes no money must never be reachable in production.
 */
function MockCheckoutInner() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planId = params.get('plan') ?? 'event';
  const eventId = params.get('event');
  const uid = params.get('uid') ?? '';
  const sessionId = params.get('session') ?? '';
  const successUrl = params.get('success') ?? '/';
  const cancelUrl = params.get('cancel') ?? '/';
  const plan = planById(planId);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      // Exactly the payload the mock gateway expects back from its own webhook.
      await api.post(
        '/api/billing/webhook',
        eventId
          ? {
              type: 'event.unlocked',
              eventId,
              planId,
              actorUid: uid,
              reference: sessionId,
            }
          : {
              // No period end: the gateway fills that in. A client deciding how long a
              // subscription lasts would be wrong even in a mock.
              type: 'subscription.active',
              actorUid: uid,
              planId: 'pro',
              customerId: `mock_cus_${uid.slice(0, 8)}`,
            },
      );
      window.location.assign(successUrl);
    } catch (caught) {
      setError(errorMessage(caught, 'That did not go through.'));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-6 flex items-start gap-2.5 rounded-2xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">Development checkout.</strong> No card, no money, no
          Stripe. This exists so the upgrade path can be tested end to end.
        </p>
      </div>

      <div className="card p-8 text-center">
        <span className="mx-auto mb-5 inline-flex size-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <CreditCard className="size-5" aria-hidden />
        </span>

        <h1 className="text-2xl font-semibold tracking-tight">{plan.label}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{plan.audience}</p>

        <p className="mt-6 text-4xl font-semibold tracking-tight">{formatPrice(plan)}</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{plan.priceNote}</p>

        {error && (
          <p role="alert" className="mt-5 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <Button size="lg" className="mt-7 w-full" loading={busy} onClick={pay}>
          Complete the pretend payment
        </Button>

        <Link
          href={cancelUrl}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-2.5 text-xs font-bold text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="size-3.5" />
          Cancel and go back
        </Link>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">{brand.name}</p>
    </main>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <MockCheckoutInner />
    </Suspense>
  );
}
