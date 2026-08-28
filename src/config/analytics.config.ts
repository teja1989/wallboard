/**
 * The funnel.
 *
 * Every number in the business case is currently a guess, and will stay one until this
 * exists. It is the cheapest thing in the plan and it blocks every decision after it — there
 * is no point arguing about where a paywall belongs while nobody can say what fraction of
 * guests ever open an invitation.
 *
 * Three rules, inherited from `docs/ADS_MARKETING.md` and not negotiable:
 *
 * 1. **First-party and server-side.** No third-party script, no pixel, nothing that runs
 *    before consent — because nothing here needs consent. A counter that only ever goes up
 *    is not a profile of anybody.
 * 2. **Aggregate only.** Counts per event per day. There is deliberately no per-visitor row,
 *    no identifier, and no way to reconstruct one person's path. That is a design constraint
 *    rather than a shortcut: the product's promise is that this stuff disappears, and an
 *    analytics table that outlived the event would quietly make that promise false.
 * 3. **Nothing outlives the event.** The counters hang off the event document, so the same
 *    sweep and the same delete that remove everything else remove these too.
 */

/**
 * The moments worth counting, as a closed set.
 *
 * A union rather than free-form strings, for the same reason the audit log has one: a typo in
 * an event name is a metric that silently reads zero forever, and nobody notices a number that
 * was never there.
 *
 * Each of these is recorded **server-side, from a route handler**, so none of them can be
 * forged by a client that felt like inflating its own numbers.
 */
export const FUNNEL_EVENTS = [
  /** An invitation was emailed. The denominator for everything downstream. */
  'inviteSent',
  /** Somebody opened an invitation — after hydration, so scanners do not count. */
  'invitationOpened',
  /** A guest answered, either way. "No" is a reply and belongs in the numerator. */
  'rsvpAnswered',
  /** …and said yes. Separately, because attendance and engagement are different questions. */
  'rsvpYes',
  /** Something reached the wall. The moment a replier becomes a participant. */
  'postCreated',
  /**
   * A guest clicked through to a gift list.
   *
   * The whole reason the registry exists. Over `invitationOpened` this is the one number that
   * says whether guests have any purchase intent on an invitation at all — and therefore
   * whether cash gifting is a business or a three-month bet on a hunch.
   */
  'giftLinkClicked',
  /**
   * A host ticked something off the planning list.
   *
   * Whether the planning board is a reason to pay or a tab nobody opens twice. It is the only
   * host-side counter here, and deliberately measures *use* rather than views: opening a tab
   * proves curiosity, working the list proves it was worth building.
   */
  'milestoneCompleted',
  /** A host reached checkout. Where the money question starts being answerable. */
  'checkoutStarted',
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export const analyticsConfig = {
  /**
   * One counter document per event per day.
   *
   * Per day rather than one document per event because a single document takes roughly one
   * sustained write per second, and a wedding's invitations get opened in bursts. Splitting by
   * day spreads that and gives the shape of a campaign for free — the interesting question is
   * usually "what happened after we sent them", not "how many in total".
   *
   * Per event rather than one global rollup for the same reason, and one better: a global
   * daily document would be the single hottest key in the system and every host would be
   * queued behind every other host.
   */
  dayKeyFormat: 'UTC',

  /**
   * Counters are recorded on a best-effort basis and never block the request that produced
   * them. Measuring an RSVP must not be able to stop one.
   */
  failOpen: true,
} as const;

/** `2026-08-28`. UTC so a rollup never depends on where the server happened to be. */
export function funnelDayKey(at: number = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10);
}
