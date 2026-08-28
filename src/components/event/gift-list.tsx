'use client';
import { useEffect, useState } from 'react';
import { Gift, ExternalLink } from 'lucide-react';
import { registryCopy, registryHostLabel } from '@/config';
import { api } from '@/lib/client/api-client';
import type { RegistryLinkDoc } from '@/types/domain';

interface RegistryResponse {
  links: RegistryLinkDoc[];
  allowed: boolean;
}

/** The host's note, or where the link goes — never a repeat of the name above it. */
function subLine(link: RegistryLinkDoc): string {
  if (link.note !== '') return link.note;
  const host = registryHostLabel(link.url);
  return host === link.label ? '' : host;
}

/**
 * The gift list, as a guest sees it.
 *
 * Renders nothing at all when the host has not added anything, which is most invitations —
 * an empty "Gifts" heading reads as an ask, and this product should never nag somebody on
 * behalf of a host who did not ask it to.
 *
 * Every row is a plain anchor with a real `href`. That matters more than it looks: the count
 * is a beacon fired on the way out, so a guest with JavaScript off, or one whose tap happens
 * while our own route is down, still reaches the shop. The measurement is ours to lose, not
 * theirs.
 */
export function GiftList({ eventId }: { eventId: string }) {
  const [links, setLinks] = useState<RegistryLinkDoc[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<RegistryResponse>(`/api/events/${eventId}/registry`);
        if (!cancelled) setLinks(data.allowed ? data.links : []);
      } catch {
        // A gift list that will not load is not worth an error message on somebody's
        // invitation. The details, the date and the reply are all still there.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (links.length === 0) return null;

  return (
    <section className="card p-5" aria-labelledby="gift-list-heading">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <Gift className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="gift-list-heading" className="font-semibold">
            {registryCopy.guestHeading}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{registryCopy.guestHint}</p>
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
