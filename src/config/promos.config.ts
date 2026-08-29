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

/**
 * Any promo live right now, regardless of occasion.
 *
 * `activePromo` needs an occasion because a grant is per event; a marketing surface has no
 * event yet and still has to be able to say "this is on". Returns the most generous, matching
 * `activePromo`'s tie-break so the two can never advertise different things.
 */
export function anyActivePromo(
  now: number = Date.now(),
  table: readonly Promo[] = promos,
): Promo | null {
  let best: Promo | null = null;

  for (const promo of table) {
    if (now < promo.startsAt || now >= promo.endsAt) continue;
    if (!best || rank(promo.grantsPlanId) > rank(best.grantsPlanId)) best = promo;
  }

  return best;
}

/**
 * What a promo says out loud.
 *
 * A promo that nobody notices attracts nobody, which was the state of this until now: the
 * grant was resolved at creation, recorded in the audit log, and mentioned to no one. A host
 * got a free upgrade without being told, and nothing anywhere said a window was open.
 */
export const promoCopy = {
  /** On the pricing page, above the table. */
  banner: (promo: Promo) => `${promo.label} — on us right now.`,

  /** On the create form, before they commit, when their occasion qualifies. */
  applies: (promo: Promo) => `${promo.label}. Nothing to enter — it is already applied.`,

  /** After publishing, so the upgrade is explained rather than mysterious. */
  granted: (promo: Promo, planLabel: string) =>
    `${planLabel} is on us for this one — ${promo.label.toLowerCase()}.`,

  /** Said where a promo is scoped, so nobody reads a partial offer as a general one. */
  limitedTo: (promo: Promo, occasionLabels: readonly string[]) =>
    occasionLabels.length === 0 || promo.occasions === null
      ? ''
      : `Applies to ${occasionLabels.join(', ')}.`,
} as const;
