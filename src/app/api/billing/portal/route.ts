import { appConfig, isEnabled } from '@/config';
import { billingGateway } from '@/lib/billing/gateway';
import { billingFor } from '@/lib/services/billing';
import { ApiError, ok, requireIdentifiedActor, route } from '@/lib/server/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A link to manage or cancel a subscription.
 *
 * Handed off to the provider rather than rebuilt here: card details, invoices and
 * cancellation are theirs to hold, and every one of those we implement ourselves is
 * compliance surface we did not need.
 */
export const POST = route(async () => {
  if (!isEnabled('billing')) {
    throw new ApiError('forbidden', 'There is nothing to manage while we are in preview.');
  }

  const actor = await requireIdentifiedActor();
  const billing = await billingFor(actor.uid);

  if (!billing?.customerId) {
    throw new ApiError('not_found', 'There is no subscription on this account.');
  }

  const url = await billingGateway().createPortalUrl(
    billing.customerId,
    `${appConfig.siteUrl}/pricing`,
  );
  if (!url) throw new ApiError('not_found', 'Subscription management is not available here.');

  return ok({ url });
});
