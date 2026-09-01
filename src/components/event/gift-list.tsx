'use client';
import { useEffect, useState } from 'react';
import { Gift, ExternalLink } from 'lucide-react';
import { registryCopy, registryHostLabel } from '@/config';
import { api } from '@/lib/client/api-client';
import { GiftPotSection } from '@/components/event/gift-pot-section';
import type { CashFundDoc, RegistryLinkDoc } from '@/types/domain';

interface RegistryResponse {
  links: RegistryLinkDoc[];
  allowed: boolean;
}

interface FundsResponse {
  funds: CashFundDoc[];
}

/** The host's note, or where the link goes — never a repeat of the name above it. */
function subLine(link: RegistryLinkDoc): string {
  if (link.note !== '') return link.note;
  const host = registryHostLabel(link.url);
  return host === link.label ? '' : host;
}

export function GiftList({ eventId }: { eventId: string }) {
  const [links, setLinks] = useState<RegistryLinkDoc[]>([]);
  const [funds, setFunds] = useState<CashFundDoc[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [regData, fundData] = await Promise.all([
          api
            .get<RegistryResponse>(`/api/events/${eventId}/registry`)
            .catch(() => ({ links: [], allowed: false })),
          api.get<FundsResponse>(`/api/events/${eventId}/funds`).catch(() => ({ funds: [] })),
        ]);
        if (cancelled) return;
        setLinks(regData.allowed ? regData.links : []);
        setFunds(fundData.funds || []);
      } catch {
        // Quiet fail
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, refreshKey]);

  if (links.length === 0 && funds.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Collective Cash Pots */}
      {funds.length > 0 && (
        <GiftPotSection
          eventId={eventId}
          funds={funds}
          onContributionSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* External Links */}
      {links.length > 0 && (
        <section className="card p-5" aria-labelledby="gift-list-heading">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Gift className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="gift-list-heading" className="font-semibold">
                {registryCopy.guestHeading}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                {registryCopy.guestHint}
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  // `noopener` keeps the shop from reaching back through `window.opener`; the
                  // referrer half also stops the destination learning which invitation sent them.
                  rel="noopener noreferrer"
                  onClick={() => countClick(eventId, link.id)}
                  className="flex items-center gap-3 rounded-2xl bg-[var(--surface-sunken)] px-4 py-3 transition-colors hover:bg-[var(--accent-soft)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{link.label}</span>
                    {/*
                  The host's note if they left one, otherwise where the tap goes — but never
                  the destination when it is already the name above, which is what a host who
                  left the name blank gets. "Amazon / Amazon" reads like a bug.
                */}
                    {subLine(link) !== '' && (
                      <span className="block truncate text-xs text-[var(--text-muted)]">
                        {subLine(link)}
                      </span>
                    )}
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Counts the tap without delaying it.
 *
 * `sendBeacon` because the browser is already navigating away: a `fetch` started in a click
 * handler is cancelled when the page unloads, which on a fast connection loses most of the
 * very number this feature exists to produce. The queued beacon survives the navigation.
 *
 * Falls back to a keepalive fetch where `sendBeacon` is missing, and gives up quietly if both
 * fail. Nothing here is allowed to stand between a guest and a present.
 */
function countClick(eventId: string, linkId: string): void {
  const url = `/api/events/${eventId}/registry/click`;
  const body = JSON.stringify({ linkId });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // The type matters: the route parses JSON, and a beacon defaults to text/plain.
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    });
  } catch {
    // Deliberately silent.
  }
}
