import { appConfig, isEnabled } from '@/config';
import { connectBillingService } from '@/lib/billing/connect';
import { requireEvent } from '@/lib/services/events';
import { ApiError, ok, requireActor, route } from '@/lib/server/api';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Initiates Stripe Connect Express onboarding for the host to link their bank account.
 */
export const POST = route(async (request, { params }: Params) => {
  if (!isEnabled('cashFunds')) {
    throw new ApiError('not_found', 'Cash pots are not available.');
  }

  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  const event = await requireEvent(id);

  if (event.hostUid !== actor.uid) {
    throw new ApiError('forbidden', 'Only the event host can connect payout accounts.');
  }

  const origin = request.headers.get('origin') || appConfig.siteUrl;
  const returnUrl = `${origin}/e/${id}?tab=guests&connect=success`;
  const refreshUrl = `${origin}/e/${id}?tab=guests&connect=refresh`;

  const accountId = await connectBillingService.getOrCreateHostAccount(actor.uid, actor.email);
  const onboardingUrl = await connectBillingService.createOnboardingLink(
    accountId,
    returnUrl,
    refreshUrl,
  );

  return ok({ url: onboardingUrl, accountId });
});
