'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FUNNEL_EVENTS, funnelRatios, type FunnelEvent } from '@/config';
import { api, errorMessage } from '@/lib/client/api-client';

interface Rollup {
  totals: Partial<Record<FunnelEvent, number>>;
  events: number;
  eventsWithData: number;
}

/**
 * Every counter, across every event, with the decision each ratio settles printed under it.
 *
 * The reason this exists at all: seven counters were being written and nothing read them. The
 * gift list in particular was built for one number and one number only — whether guests on an
 * invitation will click through to buy something — and that number was going into a place
 * nobody could look at, which makes the feature that produced it unfalsifiable.
 *
 * Ratios are shown with their denominators, never alone. "12%" means nothing when the
 * denominator is eight.
 */
export function FunnelBoard() {
  const [rollup, setRollup] = useState<Rollup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await api.get<Rollup>('/api/admin/funnel');
        if (!cancelled) setRollup(next);
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught, 'Could not read the numbers.'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null) {
    return <p className="card p-6 text-sm text-[var(--text-secondary)]">{error}</p>;
  }

  if (rollup === null) {
    return (
      <div className="card flex justify-center p-10">
        <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" aria-label="Loading" />
      </div>
    );
  }

  const { totals } = rollup;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--text-secondary)]">
        Across {rollup.events} {rollup.events === 1 ? 'event' : 'events'}, {rollup.eventsWithData}{' '}
        with anything recorded.
        {rollup.eventsWithData < 5 && ' Too few to conclude much from yet.'}
      </p>

      <section aria-labelledby="ratios-heading">
        <h2 id="ratios-heading" className="mb-3 text-lg font-semibold tracking-tight">
          What these decide
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {funnelRatios.map((ratio) => {
            const top = totals[ratio.numerator] ?? 0;
            const bottom = totals[ratio.denominator] ?? 0;

            return (
              <div key={ratio.id} className="card p-5">
                <p className="text-sm text-[var(--text-secondary)]">{ratio.label}</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    {/*
                      No denominator means no ratio — not 0%, which reads as "nobody did it"
                      when the truth is "nobody has been asked yet". They are different, and
                      the second one is not a failure.
                    */}
                    {bottom === 0 ? '—' : `${Math.round((top / bottom) * 100)}%`}
                  </span>
                  <span className="text-sm text-[var(--text-muted)] tabular-nums">
                    {top} of {bottom}
                  </span>
                </p>
                {/* Over 100% is real information, not a rendering bug — a forwarded link is an
                    open with no send behind it — so it is explained rather than clamped. */}
                {ratio.canExceedOne && bottom > 0 && top > bottom && (
                  <p className="mt-1 text-xs text-[var(--accent)]">
                    Over 100%: links are travelling beyond the guest list.
                  </p>
                )}
                <p className="mt-2 text-xs text-[var(--text-muted)]">{ratio.decides}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="raw-heading">
        <h2 id="raw-heading" className="mb-3 text-lg font-semibold tracking-tight">
          The counters themselves
        </h2>
        <dl className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          {FUNNEL_EVENTS.map((name) => (
            <div key={name}>
              <dt className="text-xs text-[var(--text-muted)]">{name}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{totals[name] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
