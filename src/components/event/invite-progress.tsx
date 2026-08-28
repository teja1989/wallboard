'use client';
import { CheckCheck, Eye, MessageSquare, Send } from 'lucide-react';
import { inviteProgressCopy } from '@/config';
import { cn } from '@/lib/utils';
import type { InviteeDoc, RsvpTally } from '@/types/domain';

/**
 * How the invitation is going, in four numbers.
 *
 * Every one of these is a count of **people**, taken from the invitee list the panel has
 * already loaded and from the event's own tally. That is deliberate, and it is the reason
 * this does not read the funnel:
 *
 * The funnel counts sums, not people. `invitationOpened` goes up every time anybody loads the
 * invitation, so one guest who checks the address three times is three, and a link forwarded
 * into a group chat produces opens with no invitee behind them. Rendering that as "31 of 40
 * guests looked" would be a confident lie, and a host chasing the nine who supposedly had not
 * would be chasing nobody. The per-guest record — `firstViewedAt`, set by the same beacon —
 * is the honest answer to that question, and it is already on the list.
 *
 * So: the funnel is for the cross-event question (do guests, in general, do this?) and the
 * invitee list is for this host's event. Neither substitutes for the other.
 *
 * Costs no extra read: everything here is derived from data the panel is already holding.
 */
export function InviteProgress({ invitees, tally }: { invitees: InviteeDoc[]; tally: RsvpTally }) {
  // Nothing to report before anybody has been invited, and an empty progress bar over an
  // empty guest list is just a widget telling a host they have not started yet.
  if (invitees.length === 0) return null;

  const sent = invitees.filter((invitee) => invitee.lastSentAt !== null).length;
  const seen = invitees.filter((invitee) => invitee.firstViewedAt !== null).length;
  const replied = invitees.filter((invitee) => invitee.repliedAt !== null).length;

  const steps = [
    { id: 'invited', icon: Send, label: inviteProgressCopy.invited, value: invitees.length },
    { id: 'sent', icon: CheckCheck, label: inviteProgressCopy.sent, value: sent },
    { id: 'seen', icon: Eye, label: inviteProgressCopy.seen, value: seen },
    { id: 'replied', icon: MessageSquare, label: inviteProgressCopy.replied, value: replied },
  ] as const;

  return (
    <section className="card p-5" aria-labelledby="invite-progress-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="invite-progress-heading" className="font-semibold">
          {inviteProgressCopy.heading}
        </h2>
        {/*
          The tally, not a funnel counter: this is who is coming *right now*, and it is
          maintained transactionally alongside every reply. It counts heads rather than
          replies, so a family of four is four.
        */}
        {tally.attending > 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            {inviteProgressCopy.attending(tally.attending)}
          </p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((step) => (
          <div key={step.id} className="rounded-2xl bg-[var(--surface-sunken)] px-4 py-3">
            <dt className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <step.icon className="size-3.5 shrink-0" aria-hidden />
              {step.label}
            </dt>
            <dd
              className={cn(
                'mt-1 text-2xl font-semibold tabular-nums',
                step.value === 0 && 'text-[var(--text-muted)]',
              )}
            >
              {step.value}
            </dd>
          </div>
        ))}
      </dl>

      {/*
        The one line a host can act on, and only when acting is possible. "Nobody has opened
        it" an hour after sending is normal and reads as failure, so it is never said —
        the nudge appears once there is a gap worth closing.
      */}
      {sent > 0 && replied < sent && (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          {inviteProgressCopy.waitingOn(sent - replied)}
        </p>
      )}
    </section>
  );
}
