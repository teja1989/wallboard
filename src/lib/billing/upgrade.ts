import { planById, type Entitlements, type PlanId } from '@/config';
import { cheapestPlanReaching, cheapestPlanWith } from './entitlements';

/**
 * Turning a refused action into a sentence a host can act on.
 *
 * A limit message that says only "upgrade to continue" makes the reader do the work of
 * finding out what they hit and what fixes it. These say both, and name the cheapest plan
 * that solves it rather than the most expensive one that would.
 */

export interface UpgradePrompt {
  /** What just got refused, in plain words. */
  reason: string;
  /** The cheapest plan that lifts the limit, or null if nothing does. */
  planId: PlanId | null;
  /** A complete sentence combining both, ready to render. */
  message: string;
}

export function upgradeForFlag(entitlement: keyof Entitlements, reason: string): UpgradePrompt {
  const planId = cheapestPlanWith(entitlement);
  return {
    reason,
    planId,
    message: planId ? `${reason} ${planById(planId).label} includes it.` : reason,
  };
}

export function upgradeForLimit(
  entitlement: keyof Entitlements,
  needed: number,
  reason: string,
): UpgradePrompt {
  const planId = cheapestPlanReaching(entitlement, needed);
  return {
    reason,
    planId,
    message: planId ? `${reason} ${planById(planId).label} raises the limit.` : reason,
  };
}
