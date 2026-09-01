import { appConfig, isEnabled } from '@/config';
import { connectBillingService } from '@/lib/billing/connect';
import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventMembershipFor } from '@/lib/authz/session';
import { requireEvent } from '@/lib/services/events';
import { getFund } from '@/lib/services/funds';
import { ApiError, limitByUser, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { contributeToFundSchema, eventIdSchema, fundIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string; fundId: string }> };

/**
 * Creates a Stripe Checkout session to contribute to a cash pot.
 */
export const POST = route(async (request, { params }: Params) => {
  if (!isEnabled('cashFunds')) {
    throw new ApiError('not_found', 'Cash pots are not available.');
  }

  const { eventId, fundId } = await params;
  const id = eventIdSchema.parse(eventId);
  const fid = fundIdSchema.parse(fundId);
  const actor = await requireActor();
  await limitByUser('rsvpPerUser', actor.uid);

  const event = await requireEvent(id);
  const fund = await getFund(id, fid);
  if (!fund) {
    throw new ApiError('not_found', 'Cash pot not found.');
  }

  const membership = await eventMembershipFor(id, actor.uid);
  const eventRole = membership?.role ?? (actor.uid === event.hostUid ? 'host' : null);
  if (!can('event:view', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That event does not exist.');
  }

  const input = await parseBody(request, contributeToFundSchema.omit({ fundId: true }));

  const origin = request.headers.get('origin') || appConfig.siteUrl;
  const returnUrls = {
    success: `${origin}/e/${id}?tab=gifts&gift=success`,
    cancel: `${origin}/e/${id}?tab=gifts&gift=cancel`,
  };

  const result = await connectBillingService.createContributionCheckout(
    event,
    fund,
    input,
    actor,
    returnUrls,
  );

  return ok(result);
});
