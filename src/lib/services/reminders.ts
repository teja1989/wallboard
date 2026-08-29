import 'server-only';
import {
  collections,
  dueReminderSlot,
  furthestReminderMs,
  remindersConfig,
  type ReminderSlot,
} from '@/config';
import { db } from '@/lib/firebase/admin';
import { recordFunnel } from '@/lib/services/funnel';
import { repliedAddressesFor, sendToInvitees } from '@/lib/services/invites';
import type { EventDoc } from '@/types/domain';

/**
 * Chasing the people who have not replied, without the host having to remember.
 *
 * The nudge already existed; it only went out when a host pressed a button on a tab inside a
 * page they had to think to open. Most never did, and a reply that never arrives because
 * nobody asked twice looks exactly like an invitation that did not work.
 *
 * The whole design problem here is **exactly once**. A cron that double-sends costs a guest's
 * goodwill and burns sending reputation that every host on the platform shares, so the slot is
 * claimed in a transaction *before* anything is sent. That trades a missed reminder for a
 * duplicate one when a run dies mid-flight, which is the right way round.
 */

export interface ReminderRun {
  eventsConsidered: number;
  eventsReminded: number;
  sent: number;
  failed: number;
  startedAt: number;
  finishedAt: number;
}

/**
 * Events close enough to the day to be worth looking at.
 *
 * One query for every slot: `status == live` with a range on `startsAt`, which is the same
 * `(status, <range>)` shape as the sweep's own query and uses a declared composite index. Two
 * range filters on the *same* field are allowed and need no second index.
 */
async function candidates(now: number): Promise<EventDoc[]> {
  const snapshot = await db()
    .collection(collections.events)
    .where('status', '==', 'live')
    .where('startsAt', '>', now)
    .where('startsAt', '<=', now + furthestReminderMs)
    .orderBy('startsAt', 'asc')
    .limit(remindersConfig.maxEventsPerRun)
    .get();

  return snapshot.docs.map((doc) => ({ ...(doc.data() as Omit<EventDoc, 'id'>), id: doc.id }));
}

/**
 * Takes the slot, or returns null because somebody else already had it.
 *
 * The transaction re-reads inside itself rather than trusting the query's snapshot: two runs
 * overlapping — a retry landing on top of a slow run — would otherwise both see an unfired
 * slot and both send. Whoever writes first wins and the loser sends nothing.
 */
async function claimSlot(eventId: string, slot: ReminderSlot, now: number): Promise<boolean> {
  const reference = db().collection(collections.events).doc(eventId);

  return db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return false;

    const event = snapshot.data() as EventDoc;
    const already = event.remindersSent ?? [];
    if (already.includes(slot.id)) return false;

    // Re-checked inside the claim, not just at selection: an event can end, or its host can
    // switch reminders off, between the query and this write.
    if (dueReminderSlot(toCandidate({ ...event, id: eventId }), now)?.id !== slot.id) return false;

    transaction.update(reference, { remindersSent: [...already, slot.id] });
    return true;
  });
}

/** The narrow shape `dueReminderSlot` needs, so the decision stays testable without Firestore. */
function toCandidate(event: EventDoc) {
  return {
    startsAt: event.startsAt,
    createdAt: event.createdAt,
    remindersSent: event.remindersSent ?? [],
    rsvpEnabled: event.rsvp?.enabled ?? false,
    // Events created before this feature have no flag. Defaulting a *sending* behaviour to on
    // for them would email guests of an event whose host never agreed to it, so it is off.
    autoRemind: event.rsvp?.autoRemind === true,
    rsvpDeadline: event.rsvp?.deadline ?? null,
  };
}

export async function runScheduledReminders(now = Date.now()): Promise<ReminderRun> {
  const startedAt = now;
  const run: ReminderRun = {
    eventsConsidered: 0,
    eventsReminded: 0,
    sent: 0,
    failed: 0,
    startedAt,
    finishedAt: startedAt,
  };

  const events = await candidates(now);
  run.eventsConsidered = events.length;

  for (const event of events) {
    const slot = dueReminderSlot(toCandidate(event), now);
    if (!slot) continue;

    if (!(await claimSlot(event.id, slot, now))) continue;

    try {
      // `sendToInvitees` does the rest of the eligibility work: never somebody who has
      // unsubscribed, never somebody who has replied, and never somebody nudged inside the
      // cooldown — which is the second net under the claim above.
      const replied = await repliedAddressesFor(event.id);
      const summary = await sendToInvitees(event, 'reminder', replied);

      run.sent += summary.sent;
      run.failed += summary.failed;
      if (summary.sent > 0) {
        run.eventsReminded += 1;
        // Counted the same way a host-pressed send is, so the funnel's `inviteSent` stays a
        // true denominator rather than quietly excluding everything sent automatically.
        await recordFunnel(event.id, 'inviteSent', { by: summary.sent });
      }
    } catch (error) {
      // One event's failure must not stop the run. The slot stays claimed on purpose: a
      // retry that re-sent to everyone who *did* receive it is the outcome being avoided.
      run.failed += 1;
      console.error(`[reminders] ${event.id} failed`, error);
    }
  }

  run.finishedAt = Date.now();
  return run;
}
