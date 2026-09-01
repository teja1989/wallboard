'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { formatPrice, plans } from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';

/**
 * Upgrading this event.
 *
 * Placed inside the host panel rather than on the pricing page, because this is where the
 * moment actually happens: someone is looking at their own wedding invitation and wants the
 * thing they cannot have. A pricing page is where people compare; this is where they buy.
 *
 * Shows nothing at all when billing is off. A dangling "upgrade" button that leads to a
 * page saying everything is free is worse than no button.
 */
export function UpgradeSection({ eventId, plan }: { eventId: string; plan: string }) {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  if (plan !== 'free') {
    return (
      <section className="mb-6 space-y-2 rounded-2xl bg-[var(--accent-soft)] p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check className="size-4 text-[var(--accent)]" aria-hidden />
          This event is on {plans[plan as keyof typeof plans]?.label ?? 'a paid plan'}.
        </p>
        <Button
          type="button"
          variant="soft"
          size="sm"
          className="w-full rounded-xl text-xs"
          onClick={async () => {
            try {
              const res = await api.post<{ url: string }>('/api/billing/portal');
              if (res.url) window.location.href = res.url;
            } catch (err) {
              notify((err as Error).message || 'Could not open billing portal.', 'error');
            }
          }}
        >
          Manage Subscription & Invoices
        </Button>
      </section>
    );
  }

  async function upgrade() {
    setBusy(true);
    try {
      const result = await api.post<{ url: string }>('/api/billing/checkout', {
        planId: 'event',
        eventId,
      });
      window.location.assign(result.url);
    } catch (caught) {
      notify(errorMessage(caught, 'Could not start checkout.'), 'error');
      setBusy(false);
    }
  }

  const paid = plans.event;

  return (
    <section className="mb-6">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
        <Sparkles className="size-4" aria-hidden />
        Upgrade this event
      </h3>

      <div className="rounded-2xl bg-[var(--surface-sunken)] p-4">
        <ul className="space-y-1.5 text-sm">
          {paid.highlights.slice(0, 4).map((highlight) => (
            <li key={highlight} className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>

        <Button className="mt-4 w-full" loading={busy} onClick={upgrade}>
          Upgrade for {formatPrice(paid)}
        </Button>

        <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
          Your guests keep the same link and code.{' '}
          <Link href="/pricing" className="underline underline-offset-2">
            Compare plans
          </Link>
        </p>
      </div>
    </section>
  );
}
