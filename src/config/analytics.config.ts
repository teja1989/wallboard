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
  /**
   * An invitation was opened — after hydration, so scanners do not count.
   *
   * **Opens, not openers.** One guest who looks three times is three, and a link shared into
   * a group chat produces opens with no invitation behind them at all, so this can legitimately
   * exceed `inviteSent`. Both facts follow from counting sums rather than people, which is the
   * design and not a defect — but it means this must never be rendered as "31 of 40 guests
   * looked". How many *people* have seen it is per-guest and authoritative on the invitee list
   * (`firstViewedAt`), which is what the host's own summary reads.
   */
  'invitationOpened',
  /**
   * A guest replied for the first time. "No" is a reply and belongs in the numerator.
   *
   * First replies only — a change of mind is not a second conversion. See the long note in
   * the RSVP route for why counting reply *actions* quietly corrupts every ratio built on it.
   */
  'rsvpAnswered',
  /**
   * …and that first reply was yes. Separately, because attendance and engagement are
   * different questions.
   *
   * Not "ever said yes": a guest who warms up from maybe to yes is not counted here, because
   * counting that correctly needs a history the member document does not keep. Attendance is
   * `event.rsvpTally.attending`, which is transactional and always current.
   */
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

/**
 * The ratios that decide things, and what each one decides.
 *
 * Written down as a table rather than computed ad hoc in a component, because the point of
 * this is that a number has a *consequence*. A dashboard of counters nobody has attached a
 * decision to is a dashboard nobody reads twice — and every one of these was named in the
 * business plan as the thing that would settle an argument.
 */
export interface FunnelRatio {
  id: string;
  label: string;
  numerator: FunnelEvent;
  denominator: FunnelEvent;
  /** The question this answers. Shown under the number, because that is the whole point. */
  decides: string;
  /**
   * Whether exceeding 100% is meaningful rather than a bug.
   *
   * True for anything measured against `inviteSent`: a link forwarded into a group chat is an
   * open with no invitation behind it, so opens can legitimately outrun sends. Rendering that
   * as a clamped 100% would hide the most interesting thing the number can say.
   */
  canExceedOne?: boolean;
}

export const funnelRatios: readonly FunnelRatio[] = [
  {
    id: 'reach',
    label: 'Opened, per invitation sent',
    numerator: 'invitationOpened',
    denominator: 'inviteSent',
    decides: 'Whether email is worth it at all, or whether hosts are really sharing links.',
    canExceedOne: true,
  },
  {
    id: 'reply',
    label: 'Replied, per opened',
    numerator: 'rsvpAnswered',
    denominator: 'invitationOpened',
    decides: 'Whether the invitation asks clearly enough. The core product ratio.',
  },
  {
    id: 'participate',
    label: 'Posted, per reply',
    numerator: 'postCreated',
    denominator: 'rsvpAnswered',
    decides: 'Whether a replier ever becomes a participant — the case for the wall.',
  },
  {
    id: 'gift',
    label: 'Tapped a gift list, per opened',
    numerator: 'giftLinkClicked',
    denominator: 'invitationOpened',
    decides:
      'Whether guests have any purchase intent on an invitation. Cash gifting is not built until this is real.',
  },
  {
    id: 'upgrade',
    label: 'Reached checkout, per invitation sent',
    numerator: 'checkoutStarted',
    denominator: 'inviteSent',
    decides: 'Where the money question starts being answerable.',
    canExceedOne: true,
  },
];

/**
 * How many recent events a rollup reads.
 *
 * Bounded on purpose. The rollup reads each event's counters directly rather than running a
 * collection-group query, which costs one read per event — fine on a page only an owner opens,
 * and it needs no collection-group index. That matters more than the read count here: this
 * repo has already shipped a production 500 from a missing index that every local test passed,
 * because the emulator answers queries no index could serve. When volume makes N+1 the wrong
 * trade, the replacement is a collection-group query on `day` plus an index in **both**
 * `firestore.indexes.json` and `infra/terraform/firestore.tf`.
 */
export const funnelRollupEventLimit = 200;
