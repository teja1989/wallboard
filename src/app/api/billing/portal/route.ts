import { appConfig } from '@/config';
import { billingGateway } from '@/lib/billing/gateway';
import { billingFor } from '@/lib/services/billing';
import { ApiError, ok, requireActor, route } from '@/lib/server/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Creates a Stripe Customer Portal link for managing an active Pro subscription.
 */
export const POST = route(async (request) => {
  const actor = await requireActor();
  const billing = await billingFor(actor.uid);

  if (!billing?.customerId) {
    throw new ApiError('not_found', 'No active subscription or customer record found.');
  }

  const origin = request.headers.get('origin') || appConfig.siteUrl;
  const returnUrl = `${origin}/account`;

  const portalUrl = await billingGateway().createPortalUrl(billing.customerId, returnUrl);
  if (!portalUrl) {
    throw new ApiError(
      'bad_request',
      'Customer billing portal is not available in mock development mode.',
    );
  }

  return ok({ url: portalUrl });
});
