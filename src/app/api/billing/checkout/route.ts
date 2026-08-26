import { appConfig, isEnabled, planById } from '@/config';
import { recordAudit } from '@/lib/audit';
import { billingGateway } from '@/lib/billing/gateway';
import { requireEvent } from '@/lib/services/events';
import {
  ApiError,
  limitByUser,
  ok,
  parseBody,
  requireIdentifiedActor,
  route,
} from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { checkoutSchema } from '@/lib/validation/schemas';
import type { PlanId } from '@/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Starts a checkout.
 *
 * For a per-event unlock the caller must be that event's host — the upgrade attaches to a
 * specific invitation, so paying for someone else's would leave a payment nobody can
 * support or refund sensibly.
 */
export const POST = route(async (request) => {
  if (!isEnabled('billing')) {
    throw new ApiError('forbidden', 'Everything is free while we are in preview.');
  }

  const actor = await requireIdentifiedActor();
  await limitByUser('checkoutPerUser', actor.uid);
  const input = await parseBody(request, checkoutSchema);
  const planId = input.planId as PlanId;

  if (planId === 'free') {
    throw new ApiError('bad_request', 'There is nothing to pay for on the free plan.');
  }

  let eventId: string | null = null;
  if (planId === 'event') {
    if (!input.eventId) {
      throw new ApiError('bad_request', 'Open the invitation you want to upgrade.');
    }
    const event = await requireEvent(input.eventId);
    if (event.hostUid !== actor.uid) {
      throw new ApiError('forbidden', 'Only the host can upgrade this event.');
    }
    if (event.plan !== 'free') {
      throw new ApiError('conflict', 'This event is already upgraded.');
    }
    eventId = event.id;
  }

  const returnTo = eventId ? `${appConfig.siteUrl}/e/${eventId}` : `${appConfig.siteUrl}/pricing`;
  const session = await billingGateway().createCheckoutSession({
    planId,
    eventId,
    actorUid: actor.uid,
    actorEmail: actor.email,
    successUrl: `${returnTo}?upgraded=1`,
    cancelUrl: returnTo,
  });

  await recordAudit(
    actor,
    {
      action: 'billing.checkoutStarted',
      targetType: eventId ? 'event' : 'user',
      targetId: eventId ?? actor.uid,
      eventId,
      metadata: { plan: planById(planId).label, session: session.id },
    },
    requestContext(request),
  );

  return ok({ url: session.url, sessionId: session.id });
});
