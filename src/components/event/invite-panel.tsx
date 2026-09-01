'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Share2,
  Trash2,
} from 'lucide-react';
import { deliveryCopy, reminderCopy, relayCopy } from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
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
  neutral:
    'border border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-muted)]',
  progress:
    'border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold',
  good: 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold',
  bad: 'border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold',
};

function toneOf(state: DeliveryState) {
  return deliveryCopy[state].tone;
}

/**
 * The enhanced guest list and multi-channel invitation relay.
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
  const unsent = all.filter((i) => i.status === 'pending' || i.status === 'failed');

  function linkFor(invitee: InviteeDoc): string {
    if (!code) return '';
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}${invitationPath(code, invitee.token)}`;
  }

  async function copyLink(invitee: InviteeDoc) {
    await navigator.clipboard.writeText(relayCopy.message(hostedBy, eventTitle, linkFor(invitee)));
    setCopied(invitee.id);
    notify(`Copied invitation message for ${invitee.name || 'guest'}!`, 'success');
    window.setTimeout(() => setCopied(null), 1600);
  }

  function sendWhatsApp(invitee: InviteeDoc) {
    if (!code) return;
    const link = linkFor(invitee);
    const text = relayCopy.message(hostedBy, eventTitle, link);
    const cleanPhone = invitee.phone ? invitee.phone.replace(/[^0-9]/g, '') : '';
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function sendSms(invitee: InviteeDoc) {
    if (!code) return;
    const text = relayCopy.message(hostedBy, eventTitle, linkFor(invitee));
    const phone = invitee.phone ? invitee.phone.replace(/[^0-9+]/g, '') : '';
    const url = `sms:${phone}?&body=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
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

      const parts = [`${result.added} added`];
      if (result.duplicates > 0) parts.push(`${result.duplicates} already on the list`);
      if (result.invalid > 0) parts.push(`${result.invalid} invalid`);
      if (result.blocked > 0) parts.push(`${result.blocked} opted out`);

      notify(parts.join(' · '), result.added > 0 ? 'success' : 'info');
      return result.added > 0;
    } catch (caught) {
      notify(errorMessage(caught, 'Could not add guests.'), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function remove(inviteeId: string) {
    try {
      await api.delete(`/api/events/${eventId}/invites/${inviteeId}`);
      setInvitees((current) => (current ? current.filter((i) => i.id !== inviteeId) : null));
      notify('Removed from the list.', 'info');
    } catch (caught) {
      notify(errorMessage(caught, 'Could not remove that person.'), 'error');
    }
  }

  async function sendOne(invitee: InviteeDoc) {
    if (!invitee.email) return;
    setSendingOne(invitee.id);
    try {
      await api.post(`/api/events/${eventId}/invites/${invitee.id}/send`, {
        purpose: invitee.status === 'failed' ? 'retry' : 'invitation',
      });
      notify(`Sent to ${invitee.name || invitee.email}.`, 'success');
      await load();
      onEventChanged();
    } catch (caught) {
      notify(errorMessage(caught, 'Could not send.'), 'error');
    } finally {
      setSendingOne(null);
    }
  }

  async function send(purpose: 'invitation' | 'reminder') {
    setBusy(purpose === 'invitation' ? 'send' : 'remind');
    try {
      const result = await api.post<{ sent: number; skipped: number; failed: number }>(
        `/api/events/${eventId}/invites/send`,
        { purpose },
      );
      await load();
      onEventChanged();
      notify(`Emails sent to ${result.sent} guests!`, 'success');
    } catch (caught) {
      notify(errorMessage(caught, 'Could not send the emails.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="invite-panel-heading">
      <div className="card space-y-4 border border-[var(--border-subtle)] p-5 shadow-sm sm:p-6">
        <div>
          <h2 id="invite-panel-heading" className="text-base font-bold text-[var(--text-primary)]">
            Add Guests to Your Invitation
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Add guests by name, phone number, or email. Each guest gets a personalized private link
            so you know who has opened it.
          </p>
        </div>

        <GuestEntry onAdd={add} busy={busy === 'add'} />
      </div>

      {invitees && invitees.length > 0 && (
        <>
          <InviteProgress invitees={invitees} tally={tally} />

          <AutoRemindToggle eventId={eventId} enabled={autoRemind} onChanged={onEventChanged} />

          {/* Next Action Instruction Box */}
          <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
                  <Share2 className="size-3.5" />
                </span>
                <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                  Ready to Deliver ({all.length} Contacts Added)
                </h3>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[0.7rem] font-bold text-emerald-900 dark:text-emerald-200">
                {unsent.length} Unsent
              </span>
            </div>

            <p className="text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
              Tap the <strong>WhatsApp</strong> or <strong>SMS</strong> button on each contact below
              to deliver their unique invitation link. They can RSVP in 5 seconds without
              downloading any app.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="soft"
                size="sm"
                onClick={copyAll}
                disabled={!code}
                className="rounded-full border border-emerald-500/30 bg-white text-xs font-bold text-emerald-900 dark:bg-black/40 dark:text-emerald-200"
              >
                <Copy className="size-3.5" />
                <span>Copy All Formatted Messages</span>
              </Button>

              {emailable.length > 0 && unsent.filter((i) => i.email).length > 0 && (
                <Button
                  size="sm"
                  loading={busy === 'send'}
                  onClick={() => send('invitation')}
                  className="rounded-full text-xs font-bold"
                >
                  <Mail className="size-3.5" />
                  <span>Email All Unsent ({unsent.filter((i) => i.email).length})</span>
                </Button>
              )}
            </div>
          </div>

          {/* Guest Roster with Clear Action Buttons */}
          <div className="space-y-3">
            <h3 className="px-1 text-xs font-bold tracking-wider text-[var(--text-secondary)] uppercase">
              Your Guest Roster ({all.length})
            </h3>

            <ul className="space-y-2.5">
              {invitees.map((invitee) => (
                <li
                  key={invitee.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-sm transition-all hover:border-[var(--border-strong)] sm:flex-row sm:items-center"
                >
                  {/* Left: Contact Info & Status */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {invitee.name || invitee.email || invitee.phone}
                      </p>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wider uppercase',
                          TONE_CLASS[toneOf(invitee.status)],
                        )}
                      >
                        {deliveryCopy[invitee.status].label}
                      </span>
                    </div>

                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {[invitee.email, invitee.phone].filter(Boolean).join(' · ') ||
                        relayCopy.noContact}
                    </p>

                    {invitee.statusAt > 0 && invitee.status !== 'pending' && (
                      <p className="text-[0.7rem] text-[var(--text-muted)]">
                        {formatRelativeTime(invitee.statusAt)}
                        {invitee.viewCount > 1 && ` · seen ${invitee.viewCount}×`}
                      </p>
                    )}
                  </div>

                  {/* Right: Action Buttons Row */}
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 self-start sm:self-auto">
                    {/* WhatsApp Button */}
                    <button
                      type="button"
                      onClick={() => sendWhatsApp(invitee)}
                      disabled={!code}
                      title="Send WhatsApp invitation message"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:scale-105 hover:bg-emerald-700 active:scale-95 disabled:opacity-40"
                    >
                      <MessageCircle className="size-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    {/* SMS Button */}
                    <button
                      type="button"
                      onClick={() => sendSms(invitee)}
                      disabled={!code}
                      title="Send SMS text message"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm transition-all hover:scale-105 hover:bg-blue-500/20 active:scale-95 disabled:opacity-40 dark:text-blue-300"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>SMS</span>
                    </button>

                    {/* Email Button (if email is attached and pending) */}
                    {invitee.email &&
                      (invitee.status === 'pending' || invitee.status === 'failed') && (
                        <button
                          type="button"
                          onClick={() => void sendOne(invitee)}
                          disabled={sendingOne !== null}
                          title={`Email invitation to ${invitee.email}`}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-all hover:bg-[var(--surface-raised)] disabled:opacity-40"
                        >
                          {sendingOne === invitee.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Mail className="size-3.5" />
                          )}
                          <span>Email</span>
                        </button>
                      )}

                    {/* Copy Link Button */}
                    <button
                      type="button"
                      onClick={() => copyLink(invitee)}
                      disabled={!code}
                      title="Copy guest personalized link"
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] disabled:opacity-40"
                    >
                      {copied === invitee.id ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      <span>Copy</span>
                    </button>

                    {/* Remove Contact */}
                    <button
                      type="button"
                      onClick={() => remove(invitee.id)}
                      title={`Remove ${invitee.name || 'guest'}`}
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="px-1 text-xs leading-relaxed text-[var(--text-muted)]">
            &ldquo;Seen&rdquo; means the guest opened their personal invitation in their browser.
            Every invite has tracking so you always know who is planning to come.
          </p>
        </>
      )}
    </section>
  );
}

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
