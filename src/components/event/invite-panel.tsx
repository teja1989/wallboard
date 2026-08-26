'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Send, Trash2, UserPlus } from 'lucide-react';
import { emailConfig } from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { cn } from '@/lib/utils';
import type { InviteeDoc } from '@/types/domain';

interface InvitePanelProps {
  eventId: string;
  onSent: () => void;
}

const STATUS_LABEL: Record<InviteeDoc['status'], string> = {
  pending: 'Not sent',
  sent: 'Sent',
  failed: 'Failed',
  unsubscribed: 'Opted out',
};

/**
 * Sending the invitation by email.
 *
 * The input is a single textarea rather than a repeating "add another" row, because the
 * real behaviour is pasting a block of addresses out of a phone or a spreadsheet. Anything
 * that looks like an address is picked out of whatever gets pasted — commas, newlines,
 * semicolons, `Name <a@b.com>` — because asking someone to reformat their address book is
 * how you lose them.
 */
export function InvitePanel({ eventId, onSent }: InvitePanelProps) {
  const { notify } = useToast();
  const [invitees, setInvitees] = useState<InviteeDoc[] | null>(null);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState<'add' | 'send' | 'remind' | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ invitees: InviteeDoc[] }>(`/api/events/${eventId}/invites`);
      setInvitees(result.invitees);
    } catch (caught) {
      notify(errorMessage(caught, 'Could not load the list.'), 'error');
    }
  }, [eventId, notify]);

  useEffect(() => {
    // The state change happens inside load()'s await, not in the effect body.
    void (async () => {
      await load();
    })();
  }, [load]);

  const parsed = parseAddresses(raw);
  const unsent = (invitees ?? []).filter((i) => i.status === 'pending' || i.status === 'failed');
  const sent = (invitees ?? []).filter((i) => i.status === 'sent');

  async function add() {
    if (parsed.length === 0) return;
    setBusy('add');
    try {
      const result = await api.post<{ added: number; duplicates: number; blocked: number }>(
        `/api/events/${eventId}/invites`,
        { invitees: parsed },
      );
      setRaw('');
      await load();

      // Say what happened to all of them, not just the ones that worked — a count that
      // does not move without explanation is the most common "is it broken?" moment here.
      const parts = [`${result.added} added`];
      if (result.duplicates) parts.push(`${result.duplicates} already on the list`);
      if (result.blocked) parts.push(`${result.blocked} previously opted out`);
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
        ? `Send the invitation to ${count} ${count === 1 ? 'person' : 'people'}?`
        : `Nudge everyone who has not replied yet?`;
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
          <Mail className="size-4" aria-hidden />
          Invite by email
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Paste addresses however you have them — commas, new lines, or straight out of your
          contacts.
        </p>

        <label htmlFor="invite-addresses" className="sr-only">
          Email addresses
        </label>
        <textarea
          id="invite-addresses"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={3}
          placeholder={'priya@example.com, sam@example.com\nLee Nakamura <lee@example.com>'}
          className="mt-3 w-full resize-none rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" loading={busy === 'add'} disabled={parsed.length === 0} onClick={add}>
            <UserPlus className="size-4" aria-hidden />
            Add {parsed.length > 0 ? parsed.length : ''}
          </Button>
          {raw.trim().length > 0 && parsed.length === 0 && (
            <span className="text-sm text-[var(--text-muted)]">
              No email addresses found in that.
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
          Nobody on the email list yet. You can always share the code instead.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy === 'send'}
              disabled={unsent.length === 0}
              onClick={() => send('invitation')}
            >
              <Send className="size-4" aria-hidden />
              Send to {unsent.length} unsent
            </Button>
            <Button
              variant="soft"
              size="sm"
              loading={busy === 'remind'}
              disabled={sent.length === 0}
              onClick={() => send('reminder')}
            >
              Nudge non-repliers
            </Button>
          </div>

          <ul className="card divide-y divide-[var(--border-subtle)] overflow-hidden">
            {invitees.map((invitee) => (
              <li key={invitee.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invitee.name || invitee.email}</p>
                  {invitee.name && (
                    <p className="truncate text-xs text-[var(--text-muted)]">{invitee.email}</p>
                  )}
                  {invitee.lastError && (
                    <p className="truncate text-xs text-[var(--danger)]">{invitee.lastError}</p>
                  )}
                </div>

                <span
                  className={cn(
                    'shrink-0 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs',
                    invitee.status === 'sent' && 'bg-[var(--accent-soft)]',
                    invitee.status === 'failed' && 'bg-[var(--danger-soft)] text-[var(--danger)]',
                    invitee.status !== 'sent' &&
                      invitee.status !== 'failed' &&
                      'text-[var(--text-muted)]',
                  )}
                >
                  {STATUS_LABEL[invitee.status]}
                </span>

                <button
                  type="button"
                  onClick={() => remove(invitee.id)}
                  aria-label={`Remove ${invitee.email}`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <p className="text-xs text-[var(--text-muted)]">
            Every email carries a one-click unsubscribe. Someone who opts out stays opted out, even
            if you add them again. Up to {emailConfig.maxInviteesPerEvent} guests per event.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Pulls addresses out of whatever was pasted.
 *
 * Handles `Name <a@b.com>`, bare addresses, and any mix of commas, semicolons and newlines
 * between them. Anything that is not an address is dropped silently rather than rejected —
 * pasted text is full of stray words, and refusing the whole paste over one of them would
 * be infuriating.
 */
export function parseAddresses(input: string): { email: string; name: string }[] {
  const out = new Map<string, { email: string; name: string }>();

  for (const chunk of input.split(/[,;\n\r]+/)) {
    const piece = chunk.trim();
    if (!piece) continue;

    const angled = /^(.*?)<([^>]+)>$/.exec(piece);
    const email = (angled ? angled[2] : piece)?.trim().toLowerCase() ?? '';
    const name = angled ? (angled[1] ?? '').trim().replace(/^["']|["']$/g, '') : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) continue;
    if (!out.has(email)) out.set(email, { email, name });
  }

  return [...out.values()];
}
