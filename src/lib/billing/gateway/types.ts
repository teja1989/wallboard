import type { PlanId } from '@/config';

/**
 * Payment abstraction.
 *
 * Third adapter in the app with the same shape, for the same reason: the whole thing must
 * run with no account and no keys. The mock driver here is not a stub — it completes a real
 * purchase against our own data, so the upgrade path is exercised end to end in development
 * and in CI, and switching to Stripe changes one environment variable.
 */

export interface CheckoutRequest {
  planId: PlanId;
  /** Present for a per-event unlock; absent for a subscription. */
  eventId: string | null;
  actorUid: string;
  actorEmail: string | null;
  /** Where to land after paying, and after backing out. */
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Where to send the browser. */
  url: string;
  id: string;
}

/** What a verified webhook told us happened. */
export type BillingEvent =
  | {
      type: 'event.unlocked';
      eventId: string;
      planId: PlanId;
      actorUid: string;
      /** Provider reference, kept for reconciliation and refunds. */
      reference: string;
    }
  | {
      type: 'subscription.active';
      actorUid: string;
      planId: PlanId;
      customerId: string;
      currentPeriodEnd: number;
    }
  | { type: 'subscription.ended'; actorUid: string; customerId: string }
  | { type: 'ignored'; reason: string };

export interface BillingGateway {
  readonly driver: 'mock' | 'stripe';
  createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession>;
  /** A link to manage or cancel a subscription. Null when the driver has no portal. */
  createPortalUrl(customerId: string, returnUrl: string): Promise<string | null>;
  /**
   * Verifies the signature and returns what happened. Throws on a bad signature — an
   * unverified webhook is an attacker handing out free upgrades.
   */
  parseWebhook(rawBody: string, signature: string | null): Promise<BillingEvent>;
}
