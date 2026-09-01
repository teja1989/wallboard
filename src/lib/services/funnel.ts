import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import {
  analyticsConfig,
  collections,
  funnelDayKey,
  funnelRollupEventLimit,
  type FunnelEvent,
} from '@/config';
import { db } from '@/lib/firebase/admin';
import { eventRef } from '@/lib/services/events';

/**
 * Counting what happened, without recording who it happened to.
 *
 * One document per event per day, holding nothing but integers. There is no visitor id, no
 * session, no path — by construction, not by policy. The question this answers is "what
 * fraction of invitations get opened", and that needs sums, not people.
 *
 * That constraint is worth defending rather than relaxing later. The moment a row exists per
 * visitor, the product is keeping a behavioural record of guests at somebody's wedding, and
 * the promise that the event disappears becomes a thing we would have to carefully qualify.
 * Sums cannot be de-anonymised, so there is nothing to qualify.
 *
 * Every increment is fired from a **route handler on the server**, so nothing here can be
 * forged by a client inflating its own numbers — and every one of them is best-effort.
 * Measuring an RSVP must never be able to stop one.
 */

function funnelRef(eventId: string, dayKey: string) {
  return eventRef(eventId).collection(collections.funnel).doc(dayKey);
}

/**
 * Adds one to a counter.
 *
 * `set` with `merge` rather than `update`, so the first event of a day creates the document
 * instead of failing on a missing one — the alternative is a read before every write, on a
 * path that runs for every guest of every event.
 *
 * Swallows its own failures on purpose, and logs them. A counter is worth strictly less than
 * the thing it counts: if Firestore is having a bad minute, a guest should still be able to
 * reply to an invitation, and the missing number is a gap in a chart rather than an error
 * anybody sees.
 */
export interface FunnelOptions {
  /**
   * How many. Defaults to one.
   *
   * Explicit rather than "call it n times", because one send of an invitation to forty guests
   * is forty invitations and one write. Passing a repeated array instead would collapse to a
   * single increment on the way through `Object.fromEntries`, and the biggest denominator in
   * the funnel would have quietly read `1`.
   */
  by?: number;
  /** Injectable so a test does not depend on which side of midnight it runs. */
  at?: number;
}

export async function recordFunnel(
  eventId: string,
  event: FunnelEvent,
  options: FunnelOptions = {},
): Promise<void> {
  await recordFunnelAll(eventId, [event], options);
}

/** Several distinct counters in one write, for a moment that is more than one thing. */
export async function recordFunnelAll(
  eventId: string,
  events: readonly FunnelEvent[],
  { by = 1, at = Date.now() }: FunnelOptions = {},
): Promise<void> {
  if (events.length === 0 || by <= 0) return;

  try {
    const dayKey = funnelDayKey(at);
    // A Set because two of the same name in one call would otherwise silently become one
    // increment rather than two — the caller wanted `by`, not a repeated array.
    const increments = Object.fromEntries(
      [...new Set(events)].map((name) => [name, FieldValue.increment(by)]),
    );
    await funnelRef(eventId, dayKey).set(
      { ...increments, day: dayKey, updatedAt: at },
      { merge: true },
    );
  } catch (error) {
    if (!analyticsConfig.failOpen) throw error;
    console.error('[funnel] could not record', events.join(','), error);
  }
}

export interface FunnelDay {
  day: string;
  counts: Partial<Record<FunnelEvent, number>>;
}

/**
 * Every day recorded for one event, oldest first.
 *
 * Read only when somebody asks — there is no dashboard yet, and this is what one would be
 * built on. Deliberately not aggregated across events here: doing that needs a collection
 * group query and an index, and it is the owner console's job rather than this module's.
 */
export interface FunnelRollup {
  /** Summed across every event read. */
  totals: Partial<Record<FunnelEvent, number>>;
  /** How many events contributed, so a ratio built on three of them can be taken with salt. */
  events: number;
  /** …and how many of those had any counters at all. */
  eventsWithData: number;
}

/**
 * Every counter, summed across recent events.
 *
 * This is the one that answers the questions the per-event view cannot. "Do guests click gift
 * links" is not a question about one party — a single host's fortieth tells you nothing, and
 * the per-event numbers are already better served by the guest list, which counts people
 * rather than sums.
 *
 * **Reads each event's counters directly rather than running a collection-group query.** That
 * costs one extra read per event, which is the wrong trade on a hot path and the right one
 * here: this is opened by an owner, occasionally, and it needs no collection-group index.
 * A missing index is invisible locally — the emulator happily answers queries production
 * refuses — and this repo has already shipped a 500 that way. When the volume justifies it,
 * swap in the collection-group query and add the index in both places.
 */
export async function funnelAcrossEvents(limit = funnelRollupEventLimit): Promise<FunnelRollup> {
  const events = await db()
    .collection(collections.events)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  const totals: Partial<Record<FunnelEvent, number>> = {};
  let eventsWithData = 0;

  // Sequential rather than a Promise.all over two hundred events: this is a background-ish
  // page, and a burst of two hundred concurrent subcollection reads is the sort of thing that
  // earns rate limiting for no benefit to anyone waiting on it.
  for (const event of events.docs) {
    const days = await event.ref.collection(collections.funnel).get();
    if (days.empty) continue;
    eventsWithData += 1;

    for (const day of days.docs) {
      const { day: _day, updatedAt: _updatedAt, ...counts } = day.data() as Record<string, unknown>;
      for (const [name, value] of Object.entries(counts)) {
        if (typeof value !== 'number') continue;
        const key = name as FunnelEvent;
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }

  return { totals, events: events.size, eventsWithData };
}

export async function funnelForEvent(eventId: string): Promise<FunnelDay[]> {
  const snapshot = await eventRef(eventId).collection(collections.funnel).orderBy('day').get();

  return snapshot.docs.map((doc) => {
    // `day` and `updatedAt` are bookkeeping rather than counters, so they are peeled off
    // instead of being reported as metrics with implausibly large values.
    const { day, updatedAt: _updatedAt, ...counts } = doc.data() as Record<string, unknown>;
    return {
      day: String(day ?? doc.id),
      counts: counts as Partial<Record<FunnelEvent, number>>,
    };
  });
}
