import 'server-only';
import { serverConfig } from '@/config';
import { mockGateway } from './mock.gateway';
import { stripeGateway } from './stripe.gateway';
import type { BillingGateway } from './types';

export type * from './types';

const gateways: Record<BillingGateway['driver'], BillingGateway> = {
  mock: mockGateway,
  stripe: stripeGateway,
};

/**
 * Selected by BILLING_DRIVER. Defaults to `mock`, so a deploy that forgets its Stripe keys
 * cannot silently take real payments through a half-configured account.
 */
export function billingGateway(): BillingGateway {
  return gateways[serverConfig().billing.driver];
}
