import { PLAN_IDS, type PlanId } from './plans.config';

/**
 * Promotional windows.
 *
 * A promo raises the plan a **new** event is created on. It is granted once, at creation, and
 * written onto the event — it never reaches back and changes an event that already exists.
 *
 * That direction is the whole design. Entitlements used to be derived from global present
 * state, which meant the answer to "what is this event allowed to do" could change underneath
 * a host who was mid-event. A promo that worked that way would be the same bug wearing a
 * friendlier name: everything opens up for a week and then quietly closes on people who are
 * still using it. So a grant is a fact recorded at a moment, not a rule evaluated later.
 *
 * **A promo has real costs**, unlike a discount on software. Granting the `event` plan means
 * 5 GB of storage for 30 days for every event created in the window, and that bill arrives
 * whether or not the host ever comes back. It is bounded by the wall's lifetime, which is what
 * makes it affordable — but the window is the only thing bounding the *number*, so keep it
 * short rather than leaving one open.
 */

export interface Promo {
  id: string;
  /** Shown to the host where the grant is explained. Never a surprise. */
  label: string;
  /** What an event created during the window is stamped with. */
  grantsPlanId: PlanId;
  /** Epoch ms, inclusive start and exclusive end. */
  startsAt: number;
  endsAt: number;
  /**
   * Restrict to particular occasions, or null for all of them.
   *
   * The point of a promo is usually to learn something about one segment. Opening it to
   * everything makes it a discount instead of an experiment.
   */
  occasions: readonly string[] | null;
}

/**
 * The live promo table.
 *
 * Empty on purpose. A promo is a deliberate act with a cost attached, so it should appear here
 * in a commit somebody reviewed rather than be togglable from a console at 2am.
 */
export const promos: readonly Promo[] = [] as const;

/** Ranked weakest to strongest, which is the order `PLAN_IDS` is declared in. */
function rank(planId: PlanId): number {
  return PLAN_IDS.indexOf(planId);
}

/** The stronger of two plans. Used so a promo can never *downgrade* a paying subscriber. */
export function bestPlan(a: PlanId, b: PlanId): PlanId {
  return rank(a) >= rank(b) ? a : b;
}

/**
 * The promo in force right now, if any.
 *
 * Returns the most generous match rather than the first, so overlapping windows behave the way
 * a host would expect if they ever saw both advertised. The window is half-open — start
 * inclusive, end exclusive — so two back-to-back promos are never both live for a millisecond.
 *
 * `now` and `table` are parameters so this can be tested against a supplied window rather than
 * against whatever the calendar happens to say. A test that re-implements the resolver in
 * order to exercise it is testing the copy, not the code.
 */
export function activePromo(
  occasionId: string,
  now: number = Date.now(),
  table: readonly Promo[] = promos,
): Promo | null {
  let best: Promo | null = null;

  for (const promo of table) {
    if (now < promo.startsAt || now >= promo.endsAt) continue;
    if (promo.occasions && !promo.occasions.includes(occasionId)) continue;
    if (!best || rank(promo.grantsPlanId) > rank(best.grantsPlanId)) best = promo;
  }

  return best;
}
