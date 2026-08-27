'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, Mail, Send, Share2, Trash2, UserPlus } from 'lucide-react';
import { deliveryCopy, emailConfig, relayCopy } from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { invitationPath } from '@/lib/codes-format';
import { looksLikePhone } from '@/lib/phone';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { DeliveryState, InviteeDoc } from '@/types/domain';

interface InvitePanelProps {
  eventId: string;
  eventTitle: string;
  hostedBy: string;
  onSent: () => void;
}

const TONE_CLASS: Record<ReturnType<typeof toneOf>, string> = {
  neutral: 'text-[var(--text-muted)]',
  progress: 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]',
  good: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  bad: 'bg-[var(--danger-soft)] text-[var(--danger)]',
};

function toneOf(state: DeliveryState) {
  return deliveryCopy[state].tone;
}

/**
 * The guest list, and getting the invitation to it.
 *
 * Two things shape this panel.
 *
 * **People are known by phone at least as often as by email.** So the box takes either, and
 * a guest can be added with only a number. Anything that looks like an address or a number
 * is picked out of whatever gets pasted, because asking someone to reformat their contacts
 * is how you lose them.
 *
 * **Every guest has their own link.** That is what makes "has Priya opened it?" answerable,
 * and it is why the host can send the invitation themselves — from their own phone, in the
 * thread they already talk to that person in — without losing any of the tracking.
 */
export function InvitePanel({ eventId, eventTitle, hostedBy, onSent }: InvitePanelProps) {
  const { notify } = useToast();
  const [invitees, setInvitees] = useState<InviteeDoc[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState<'add' | 'send' | 'remind' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ invitees: InviteeDoc[]; joinCode: string | null }>(
        `/api/events/${eventId}/invites`,
      );
      setInvitees(result.invitees);
      setCode(result.joinCode);
    } catch (caught) {
      notify(errorMessage(caught, 'Could not load the list.'), 'error');
    }
  }, [eventId, notify]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const parsed = parseContacts(raw);
  const all = invitees ?? [];
  const emailable = all.filter((i) => i.email);
  const unsent = emailable.filter((i) => i.status === 'pending' || i.status === 'failed');
  const sent = emailable.filter((i) => i.status !== 'pending' && i.status !== 'unsubscribed');

  function linkFor(invitee: InviteeDoc): string {
    if (!code) return '';
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}${invitationPath(code, invitee.token)}`;
  }

  async function copyLink(invitee: InviteeDoc) {
    await navigator.clipboard.writeText(relayCopy.message(hostedBy, eventTitle, linkFor(invitee)));
    setCopied(invitee.id);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function shareLink(invitee: InviteeDoc) {
    const text = relayCopy.message(hostedBy, eventTitle, linkFor(invitee));
    if (!navigator.share) {
      await copyLink(invitee);
      return;
    }
    // A cancelled share sheet rejects, and that is not an error worth showing anyone.
    await navigator.share({ text }).catch(() => undefined);
  }

  async function copyAll() {
    const text = all.map((i) => relayCopy.message(hostedBy, eventTitle, linkFor(i))).join('\n\n');
    await navigator.clipboard.writeText(text);
    notify(relayCopy.copiedAll, 'success');
  }

  async function add() {
    if (parsed.length === 0) return;
    setBusy('add');
    try {
      const result = await api.post<{
        added: number;
        duplicates: number;
        blocked: number;
        invalid: number;
      }>(`/api/events/${eventId}/invites`, { invitees: parsed });
      setRaw('');
      await load();

      // Account for all of them, not just the ones that worked — a count that does not move
      // without explanation is the most common "is it broken?" moment here.
      const parts = [`${result.added} added`];
      if (result.duplicates) parts.push(`${result.duplicates} already on the list`);
      if (result.blocked) parts.push(`${result.blocked} previously opted out`);
      if (result.invalid) parts.push(`${result.invalid} unusable`);
      notify(parts.join(', '), 'success');
    } catch (caught) {
      notify(errorMessage(caught, 'Could not add those.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function send(kind: 'invitation' | 'reminder') {
    const count = kind === 'invitation' ? unsent.length : sent.length;
    const what =
      kind === 'invitation'
        ? `Email the invitation to ${count} ${count === 1 ? 'person' : 'people'}?`
        : 'Nudge everyone who has not replied yet?';
    if (!window.confirm(what)) return;

    setBusy(kind === 'invitation' ? 'send' : 'remind');
    try {
      const result = await api.post<{ sent: number; failed: number; skipped: number }>(
        `/api/events/${eventId}/invites/send`,
        { kind },
      );
      await load();
      onSent();
      notify(
        result.sent > 0
          ? `${result.sent} sent${result.failed ? `, ${result.failed} failed` : ''}`
          : 'Nobody was due one — everyone has either had it or replied.',
        result.failed > 0 ? 'error' : 'success',
      );
    } catch (caught) {
      notify(errorMessage(caught, 'Could not send.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(inviteeId: string) {
    try {
      await api.delete(`/api/events/${eventId}/invites/${inviteeId}`);
      await load();
    } catch (caught) {
      notify(errorMessage(caught, 'Could not remove that.'), 'error');
    }
  }

  return (
    <section className="space-y-5">
      <div className="card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <UserPlus className="size-4" aria-hidden />
          Add your guests
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Phone numbers or email addresses — paste them however you have them.
        </p>

        <label htmlFor="invite-contacts" className="sr-only">
          Phone numbers or email addresses
        </label>
        <textarea
          id="invite-contacts"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={3}
          placeholder={'+1 415 555 0123, priya@example.com\nLee Nakamura <lee@example.com>'}
          className="mt-3 w-full resize-none rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" loading={busy === 'add'} disabled={parsed.length === 0} onClick={add}>
            <UserPlus className="size-4" aria-hidden />
            Add {parsed.length > 0 ? parsed.length : ''}
          </Button>
          {raw.trim().length > 0 && parsed.length === 0 && (
            <span className="text-sm text-[var(--text-muted)]">
              No numbers or addresses found in that.
            </span>
          )}
        </div>
      </div>

      {invitees === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" aria-label="Loading" />
        </div>
      ) : invitees.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">
          Nobody on the list yet. You can always share the code instead.
        </p>
      ) : (
        <>
          <div className="card space-y-3 p-5">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Share2 className="size-4" aria-hidden />
                {relayCopy.panelTitle}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{relayCopy.panelBody}</p>
            </div>
            <Button variant="soft" size="sm" onClick={copyAll} disabled={!code}>
              <Copy className="size-4" aria-hidden />
              Copy every message
            </Button>
          </div>

          {emailable.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={busy === 'send'}
                disabled={unsent.length === 0}
                onClick={() => send('invitation')}
              >
                <Mail className="size-4" aria-hidden />
                Email {unsent.length} unsent
              </Button>
              <Button
                variant="soft"
                size="sm"
                loading={busy === 'remind'}
                disabled={sent.length === 0}
                onClick={() => send('reminder')}
              >
                <Send className="size-4" aria-hidden />
                Nudge non-repliers
              </Button>
            </div>
          )}

          <ul className="card divide-y divide-[var(--border-subtle)] overflow-hidden">
            {invitees.map((invitee) => (
              <li key={invitee.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {invitee.name || invitee.email || invitee.phone}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {[invitee.email, invitee.phone].filter(Boolean).join(' · ') ||
                      relayCopy.noContact}
                  </p>
                  {invitee.lastError && (
                    <p className="truncate text-xs text-[var(--danger)]">{invitee.lastError}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span
                    className={cn(
                      'rounded-[var(--radius-pill)] px-2.5 py-1 text-xs',
                      TONE_CLASS[toneOf(invitee.status)],
                    )}
                  >
                    {deliveryCopy[invitee.status].label}
                  </span>
                  {invitee.statusAt > 0 && invitee.status !== 'pending' && (
                    <span className="text-[0.68rem] text-[var(--text-muted)] tabular-nums">
                      {formatRelativeTime(invitee.statusAt)}
                      {invitee.viewCount > 1 && ` · seen ${invitee.viewCount}×`}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => copyLink(invitee)}
                  disabled={!code}
                  aria-label={`Copy the invitation for ${invitee.name || invitee.email || invitee.phone}`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-40"
                >
                  {copied === invitee.id ? (
                    <Check className="size-4 text-[var(--accent)]" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => shareLink(invitee)}
                  disabled={!code}
                  aria-label={`Send the invitation to ${invitee.name || invitee.email || invitee.phone}`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-40 sm:hidden"
                >
                  <Share2 className="size-4" aria-hidden />
                </button>

                <button
                  type="button"
                  onClick={() => remove(invitee.id)}
                  aria-label={`Remove ${invitee.name || invitee.email || invitee.phone}`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            &ldquo;Seen&rdquo; means they opened their invitation — not that an inbox previewed it.
            Every email carries a one-click unsubscribe, and someone who opts out stays opted out
            even if you add them again. Up to {emailConfig.maxInviteesPerEvent} guests per event.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Pulls people out of whatever was pasted.
 *
 * Handles `Name <a@b.com>`, bare addresses, and phone numbers in any of the shapes a
 * contacts app produces, separated by commas, semicolons or newlines. Anything that is
 * neither is dropped silently — pasted text is full of stray words, and refusing the whole
 * paste over one of them would be infuriating.
 *
 * Numbers are only shape-checked here. The server normalises them to E.164 with a real
 * phone-number library and refuses what it cannot dial, because a number stored as typed is
 * a guest who never hears anything.
 */
export function parseContacts(input: string): { email?: string; phone?: string; name: string }[] {
  const out = new Map<string, { email?: string; phone?: string; name: string }>();

  for (const chunk of input.split(/[,;\n\r]+/)) {
    const piece = chunk.trim();
    if (!piece) continue;

    const angled = /^(.*?)<([^>]+)>$/.exec(piece);
    const value = (angled ? angled[2] : piece)?.trim() ?? '';
    const name = angled ? (angled[1] ?? '').trim().replace(/^["']|["']$/g, '') : '';

    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      const email = value.toLowerCase();
      if (!out.has(email)) out.set(email, { email, name });
      continue;
    }

    if (looksLikePhone(value)) {
      // Only exact repeats are collapsed here. The same number written two ways —
      // `+1 415 555 0123` and `(415) 555-0123` — is one person, but deciding that needs real
      // phone-number metadata, and guessing with a digit heuristic risks treating two
      // genuinely different numbers as one and silently dropping a guest. The server
      // normalises to E.164 and reports what it collapsed, which is the honest place for it.
      const key = value.replace(/\s+/g, '');
      if (!out.has(key)) out.set(key, { phone: value, name });
    }
  }

  return [...out.values()];
}
