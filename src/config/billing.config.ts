import { DAY } from './limits.config';
import type { PlanId } from './plans.config';

/**
 * Payment configuration.
 *
 * Price IDs come from the environment rather than being hard-coded, because they differ
 * between a Stripe test account and a live one, and a hard-coded test price shipped to
 * production is a product given away for free.
 */

export const billingConfig = {
  /** Stripe price IDs, per plan. `free` never has one. */
  priceIds: {
    free: '',
    event: process.env.STRIPE_PRICE_EVENT ?? '',
    pro: process.env.STRIPE_PRICE_PRO ?? '',
  } as Record<PlanId, string>,

  /**
   * How far out of date a webhook signature may be. Stripe's own default; short enough
   * that a captured signature cannot be replayed tomorrow, long enough to survive a slow
   * network and a clock that is a little out.
   */
  webhookToleranceSeconds: 300,

  /** Used as a floor for a new subscription until a subscription event carries the real one. */
  assumedPeriodMs: 366 * DAY,

  /**
   * A per-event unlock is refundable until the first guest replies. Cheap to honour, and
   * it removes the main hesitation on a $19 impulse purchase. Enforcement is manual for
   * now; this is the policy the copy promises.
   */
  refundWindowNote: 'Full refund before your first guest replies.',
} as const;
