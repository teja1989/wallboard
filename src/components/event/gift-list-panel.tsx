'use client';
import { useEffect, useState } from 'react';
import { Gift, Loader2, Plus, X } from 'lucide-react';
import { registryCopy, registryHostLabel, registryLimits } from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { GiftPotManager } from '@/components/event/gift-pot-manager';
import type { CashFundDoc, RegistryLinkDoc } from '@/types/domain';

interface RegistryResponse {
  links: RegistryLinkDoc[];
  allowed: boolean;
}

interface FundsResponse {
  funds: CashFundDoc[];
}

/**
 * The small grey line under a link's name.
 *
 * Where it goes and how many people have been there — but never repeating the name directly
 * above it. A host who left the name blank gets one named after the destination, so printing
 * the destination underneath produced rows that read "Amazon / Amazon".
 *
 * The count appears only once somebody has actually tapped. "0 opened" under a link nobody has
 * seen yet is a host being told their party is going badly before it has started.
 */
function subLine(link: RegistryLinkDoc): string {
  const host = registryHostLabel(link.url);
  const parts = host === link.label ? [] : [host];

  if (link.clickCount > 0) {
    const who = link.clickCount === 1 ? 'guest has' : 'guests have';
    parts.push(`${link.clickCount} ${who} opened this`);
  }

  return parts.join(' · ');
}

/**
 * The host's side of the gift list.
 *
 * Paste a URL, press add. The name is optional because the common case is a host who has one
 * registry and no opinion about what to call it — the server names it from the destination, so
 * an empty field produces "Amazon" rather than a blank row.
 *
 * Renders nothing when the occasion does not expect gifts. That is the server's answer, not a
 * guess made here: `allowed` comes back with the list so the panel and the invitation cannot
 * disagree about whether a work offsite has a gift list.
 */
export function GiftListPanel({ eventId }: { eventId: string }) {
  const { notify } = useToast();

  const [links, setLinks] = useState<RegistryLinkDoc[]>([]);
  const [funds, setFunds] = useState<CashFundDoc[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [regData, fundData] = await Promise.all([
          api.get<RegistryResponse>(`/api/events/${eventId}/registry`),
          api.get<FundsResponse>(`/api/events/${eventId}/funds`).catch(() => ({ funds: [] })),
        ]);
        if (cancelled) return;
        setLinks(regData.links);
        setFunds(fundData.funds);
        setAllowed(regData.allowed);
      } catch (caught) {
        if (!cancelled) notify(errorMessage(caught, 'The gift list would not load.'), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, notify, refreshKey]);

  const full = links.length >= registryLimits.maxLinksPerEvent;

  async function add() {
    if (url.trim() === '' || saving) return;
    setSaving(true);
    try {
      const { link } = await api.post<{ link: RegistryLinkDoc }>(
        `/api/events/${eventId}/registry`,
        { url, label, note },
      );
      setLinks((current) => [...current, link]);
      setUrl('');
      setLabel('');
      setNote('');
    } catch (caught) {
      notify(errorMessage(caught, 'That link could not be added.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(linkId: string) {
    try {
      await api.delete(`/api/events/${eventId}/registry/${linkId}`);
      setLinks((current) => current.filter((link) => link.id !== linkId));
    } catch (caught) {
      notify(errorMessage(caught, 'That link could not be removed.'), 'error');
    }
  }

  if (loading) {
    return (
      <div className="card flex justify-center p-8">
        <Loader2
          className="size-5 animate-spin text-[var(--text-muted)]"
          aria-label="Loading the gift list"
        />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <section className="card p-5 space-y-6" aria-labelledby="gift-panel-heading">
      {/* 1. Collective Cash Pots & Dream Gifting Section */}
      <GiftPotManager
        eventId={eventId}
        funds={funds}
        onFundsChanged={() => setRefreshKey((k) => k + 1)}
      />

      <div className="border-t border-[var(--border-subtle)] pt-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <Gift className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="gift-panel-heading" className="font-semibold">
              External Store Registries
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              Paste external wishlists or registries (Amazon, Target, Zola, etc.).
            </p>
          </div>
        </div>
      </div>

      {links.length > 0 && (
        <ul className="mt-4 space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center gap-3 rounded-2xl bg-[var(--surface-sunken)] px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{link.label}</span>
                <span className="block truncate text-xs text-[var(--text-muted)]">
                  {subLine(link)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void remove(link.id)}
                aria-label={`${registryCopy.remove}: ${link.label}`}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--danger)]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          {registryCopy.full(registryLimits.maxLinksPerEvent)}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="registry-url"
              className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
            >
              {registryCopy.urlLabel}
            </label>
            <input
              id="registry-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={registryCopy.urlPlaceholder}
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="registry-label"
              className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
            >
              {registryCopy.nameLabel}
            </label>
            <input
              id="registry-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={registryLimits.labelMaxLength}
              placeholder={registryCopy.namePlaceholder}
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="registry-note"
              className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
            >
              {registryCopy.noteLabel}
            </label>
            <input
              id="registry-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={registryLimits.noteMaxLength}
              placeholder={registryCopy.notePlaceholder}
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
          </div>

          <Button onClick={add} loading={saving} disabled={url.trim() === ''} className="w-full">
            <Plus className="size-4" aria-hidden />
            {registryCopy.addLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
