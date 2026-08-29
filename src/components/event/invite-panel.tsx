'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, Mail, Send, Share2, Trash2 } from 'lucide-react';
import { deliveryCopy, emailConfig, reminderCopy, relayCopy } from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { EmailPreview } from '@/components/event/email-preview';
import { InviteProgress } from '@/components/event/invite-progress';
import { GuestEntry } from '@/components/event/guest-entry';
import { api, errorMessage } from '@/lib/client/api-client';
import { invitationPath } from '@/lib/codes-format';
import { type Contact } from '@/lib/contacts';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { DeliveryState, InviteeDoc, RsvpTally } from '@/types/domain';

interface InvitePanelProps {
  eventId: string;
  eventTitle: string;
  hostedBy: string;
  /** Who is coming, transactionally maintained — never re-derived from the funnel. */
  tally: RsvpTally;
  /** Whether we chase non-repliers for this host. Toggled below. */
  autoRemind: boolean;
  /** Reload the event: a send, or a settings change made here, both move it. */
  onEventChanged: () => void;
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
 * **People are known by phone at least as often as by email.** So a guest can be added with
 * only a number, and — since the entry form was rebuilt — with a name beside it, which the
 * old paste box could not express for anyone who was not an email address.
 *
 * **Every guest has their own link.** That is what makes "has Priya opened it?" answerable,
 * and it is why the host can send the invitation themselves — from their own phone, in the
 * thread they already talk to that person in — without losing any of the tracking.
 */
export function InvitePanel({
  eventId,
  eventTitle,
  hostedBy,
  tally,
  autoRemind,
  onEventChanged,
}: InvitePanelProps) {
  const { notify } = useToast();
  const [invitees, setInvitees] = useState<InviteeDoc[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<'add' | 'send' | 'remind' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /** The one guest a per-row send is in flight for, so only their button spins. */
  const [sendingOne, setSendingOne] = useState<string | null>(null);

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

  async function add(guests: Contact[]): Promise<boolean> {
    if (guests.length === 0) return false;
    setBusy('add');
    try {
      const result = await api.post<{
        added: number;
        duplicates: number;
        blocked: number;
        invalid: number;
      }>(`/api/events/${eventId}/invites`, { invitees: guests });
      await load();

      // Account for all of them, not just the ones that worked — a count that does not move
      // without explanation is the most common "is it broken?" moment here.
      const parts = [`${result.added} added`];
      if (result.duplicates) parts.push(`${result.duplicates} already on the list`);
      if (result.blocked) parts.push(`${result.blocked} previously opted out`);
      if (result.invalid) parts.push(`${result.invalid} unusable`);
      notify(parts.join(', '), 'success');
      return true;
    } catch (caught) {
      // Left in the form rather than cleared, so a failed add is a retry instead of
      // fifteen names to type again.
      notify(errorMessage(caught, 'Could not add those.'), 'error');
      return false;
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
      onEventChanged();
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

  /**
   * Sends to exactly one person.
   *
   * No confirm dialog: the row names them, the button sits on that row, and one email to one
   * named person is not the irreversible-feeling act that "email 40 people" is. The bulk
   * button keeps its confirm for that reason.
   *
   * The server still decides whether they are eligible — this only narrows who is considered,
   * so a summary can legitimately come back `sent: 0` if their state changed underneath.
   */
  async function sendOne(invitee: InviteeDoc) {
    setSendingOne(invitee.id);
    try {
      const result = await api.post<{ sent: number; failed: number; skipped: number }>(
        `/api/events/${eventId}/invites/send`,
        { kind: 'invitation', inviteeIds: [invitee.id] },
      );
      await load();
      onEventChanged();
      const who = invitee.name || invitee.email;
      notify(
        result.sent > 0 ? `Sent to ${who}.` : `Nothing sent — ${who} has already had theirs.`,
        result.failed > 0 ? 'error' : 'success',
      );
    } catch (caught) {
      notify(errorMessage(caught, 'Could not send that one.'), 'error');
    } finally {
      setSendingOne(null);
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
      <GuestEntry busy={busy === 'add'} onAdd={add} />

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
          {/*
            Above the relay panel and the list, because "how is this going" is the question a
            host opens this tab to answer. Derived from the list already in hand, so it costs
            nothing to draw.
          */}
          <InviteProgress invitees={invitees} tally={tally} />

          <AutoRemindToggle eventId={eventId} enabled={autoRemind} onChanged={onEventChanged} />

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

          {/*
            Each control appears only when it has something to do, rather than sitting there
            greyed out. "Email 0 unsent" was a send button offered before there was anybody to
            send to — it read as the primary action of the panel while being permanently
            disabled, which puts the tool's suggested order (send, then decide who) backwards
            from the real one.
          */}
          {(unsent.length > 0 || sent.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {unsent.length > 0 && (
                <Button size="sm" loading={busy === 'send'} onClick={() => send('invitation')}>
                  <Mail className="size-4" aria-hidden />
                  {/* "all" earns its place now that each row can be sent on its own. */}
                  Email all {unsent.length}
                </Button>
              )}
              {sent.length > 0 && (
                <Button
                  variant="soft"
                  size="sm"
                  loading={busy === 'remind'}
                  onClick={() => send('reminder')}
                >
                  <Send className="size-4" aria-hidden />
                  Nudge non-repliers
                </Button>
              )}
              <EmailPreview eventId={eventId} />
            </div>
          )}

          {unsent.length > 0 && (
            <p className="-mt-2 text-xs text-[var(--text-muted)]">
              Or send to one person at a time with the ✉ beside their name.
            </p>
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

                {/*
                  Send to this one person.

                  "Email everyone unsent" was the only send there was, which is the wrong
                  granularity for how a guest list is actually built: people arrive in ones and
                  twos over a week, and a host who has just added their sister should not have
                  to either wait or re-run the whole list. A failed address needs one retry,
                  not a batch.

                  Shown only where it would do something — an address on file, and a state the
                  server would act on. The same `pending | failed` test the bulk button uses,
                  so the two cannot disagree about who is owed one.
                */}
                {invitee.email && (invitee.status === 'pending' || invitee.status === 'failed') && (
                  <button
                    type="button"
                    onClick={() => void sendOne(invitee)}
                    disabled={sendingOne !== null}
                    aria-label={`Email the invitation to ${invitee.name || invitee.email}`}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-40"
                  >
                    {sendingOne === invitee.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Mail className="size-4" aria-hidden />
                    )}
                  </button>
                )}

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
 * Whether we chase the people who have not replied.
 *
 * Sits on the guest list rather than in the host drawer, beside the manual nudge it replaces:
 * this is the same job, done for you, and a host deciding whether to chase somebody is
 * already looking at who has not answered.
 *
 * Optimistic, and deliberately so — a checkbox that waits on a round trip before moving reads
 * as broken. The failure path puts it back and says why.
 */
function AutoRemindToggle({
  eventId,
  enabled,
  onChanged,
}: {
  eventId: string;
  enabled: boolean;
  onChanged: () => void;
}) {
  const { notify } = useToast();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const on = optimistic ?? enabled;

  async function toggle() {
    const next = !on;
    setOptimistic(next);
    try {
      await api.patch(`/api/events/${eventId}/settings`, { rsvp: { autoRemind: next } });
      onChanged();
    } catch (caught) {
      setOptimistic(null);
      notify(errorMessage(caught, 'That did not save.'), 'error');
    }
  }

  return (
    <div className="card flex items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="font-medium">{reminderCopy.settingLabel}</p>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
          {on ? reminderCopy.settingHint : reminderCopy.settingOff}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={reminderCopy.settingLabel}
        onClick={toggle}
        className={cn(
          'mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors',
          on ? 'bg-[var(--accent)]' : 'bg-[var(--surface-sunken)]',
        )}
      >
        <span
          className={cn(
            'size-5 rounded-full bg-white shadow-sm transition-transform',
            on && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}
