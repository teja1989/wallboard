import { isEnabled } from '@/config';
import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventMembershipFor } from '@/lib/authz/session';
import { requireEvent } from '@/lib/services/events';
import { recordContribution } from '@/lib/services/funds';
import { ApiError, limitByUser, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { contributeToFundSchema, eventIdSchema, fundIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string; fundId: string }> };

/**
 * Records a contribution to a cash pot.
 *
 * **This route charges nobody.** It writes a contribution row, increments the pot, and — if
 * the guest asked — posts a tribute to the wall. No card is taken anywhere in the path. That
 * is why `cashFunds` is off by default and why this refuses outright while it is: a route
 * that says "gift complete" without a payment processor behind it is telling a guest
 * something untrue about their own money.
 *
 * Wiring Stripe Connect Express is the work that makes this route honest. Until then the
 * guard below is the feature.
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

  // A contribution writes to the pot *and* to the wall, so the caller has to be a member of
  // the event rather than merely signed in — otherwise this is an unauthenticated way to
  // inflate someone's honeymoon fund and post to their guest wall in one request.
  const membership = await eventMembershipFor(id, actor.uid);
  const eventRole = membership?.role ?? (actor.uid === event.hostUid ? 'host' : null);
  if (!can('event:view', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That event does not exist.');
  }

  const input = await parseBody(request, contributeToFundSchema.omit({ fundId: true })).then(
    (body) => ({ ...body, fundId: fid }),
  );

  const result = await recordContribution(event, input, actor);
  return ok(result);
});
