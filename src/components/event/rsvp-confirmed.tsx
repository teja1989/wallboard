'use client';
import { Check, MessageCircle, Users } from 'lucide-react';
import { occasionById, rsvpCopy, type RsvpStatus } from '@/config';
import { AddToCalendar } from '@/components/event/add-to-calendar';
import type { EventDoc } from '@/types/domain';

/**
 * The moment after somebody replies.
 *
 * This used to be a toast. A guest tapped "I'll be there", saw a message fade, and was left
 * looking at the same three buttons they had just used — the single highest-intent instant
 * anyone has in this product, spent on nothing.
 *
 * What goes here is only what a person who has just committed actually wants: proof it saved,
 * the date somewhere they will see it again, whether anyone else is going, and a way in to the
 * thing that brings them back. Nothing is sold here. They have just done what was asked.
 *
 * Shown to a returning guest too, rather than the form. Someone opening the invitation for the
 * second time is looking for the address and the date, not for the radio buttons they already
 * answered — and changing the reply is one quiet tap away.
 */
export function RsvpConfirmed({
  event,
  status,
  partySize,
  onChange,
  onOpenWall,
}: {
  event: EventDoc;
  /** Never `pending` — this only renders once there is an answer. */
  status: Exclude<RsvpStatus, 'pending'>;
  /** How many the reply covers, so "others" can exclude them. */
  partySize: number;
  onChange: () => void;
  onOpenWall: () => void;
}) {
  const copy = rsvpCopy.outcomes[status];
  const occasion = occasionById(event.occasion);

  /*
    Everybody coming, minus the reader's own party.

    `attending` sums party sizes across every yes, so it includes them. Subtracting is what
    stops a guest who has just become the first reply being told "1 person is coming" about
    themselves. The clamp is for the moment between replying and the tally catching up.
  */
  const others = Math.max(0, event.rsvpTally.attending - (status === 'yes' ? partySize : 0));
  const wallIsOpen = event.status === 'live' && event.settings.allowedKinds.length > 0;

  return (
    <section className="card p-5" aria-labelledby="rsvp-confirmed-heading">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <Check className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="rsvp-confirmed-heading" className="font-semibold">
            {copy.heading}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{copy.body(event.hostedBy)}</p>
        </div>
      </div>

      {/*
        Only for someone actually coming. Offering to put an event in the calendar of a person
        who has just said they cannot make it is the product not listening.
      */}
      {status === 'yes' && (
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
          <AddToCalendar event={event} />
        </div>
      )}

      {status === 'yes' && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <Users className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          {others > 0 ? rsvpCopy.othersComing(others) : rsvpCopy.firstToReply}
        </p>
      )}

      {/*
        The way back. For a "no" this is the whole point of the panel: not being able to come
        is not the same as having nothing to say, and for a birthday it is often the opposite.
      */}
      {wallIsOpen && (
        <button
          type="button"
          onClick={onOpenWall}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--accent-soft)]"
        >
          <MessageCircle className="size-4" aria-hidden />
          {copy.wallCta}
        </button>
      )}

      {wallIsOpen && (
        <p className="mt-2 text-center text-xs text-[var(--text-muted)]">{occasion.wallPrompt}</p>
      )}

      <button
        type="button"
        onClick={onChange}
        className="mt-4 block w-full text-center text-sm text-[var(--text-muted)] underline underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
      >
        {rsvpCopy.change}
      </button>
    </section>
  );
}
