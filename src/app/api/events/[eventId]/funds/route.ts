import { isEnabled } from '@/config';
import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventMembershipFor, eventRoleFor } from '@/lib/authz/session';
import { requireEvent } from '@/lib/services/events';
import { createCashFund, listFundsForEvent } from '@/lib/services/funds';
import { ApiError, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { createFundSchema, eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Refuses every cash-pot request while `cashFunds` is off, which is its default.
 *
 * A clean `not_found` rather than a 500 or a silent empty list: the feature does not exist
 * as far as a caller is concerned, and a route that half-answers when a flag is off is how
 * an unfinished feature leaks out one endpoint at a time.
 */
function assertFundsEnabled(): void {
  if (!isEnabled('cashFunds')) {
    throw new ApiError('not_found', 'Cash pots are not available.');
  }
}

export const GET = route(async (_request, { params }: Params) => {
  assertFundsEnabled();
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  const event = await requireEvent(id);

  // Membership, not merely a session. What a couple are saving for and how close they are to
  // it is the guest list's business, and `requireActor` alone would publish it to anyone
  // holding an event id.
  const membership = await eventMembershipFor(id, actor.uid);
  const eventRole = membership?.role ?? (actor.uid === event.hostUid ? 'host' : null);
  if (!can('event:view', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That event does not exist.');
  }

  const funds = await listFundsForEvent(id);
  return ok({ funds });
});

export const POST = route(async (request, { params }: Params) => {
  assertFundsEnabled();
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  const event = await requireEvent(id);
  const role = (await eventRoleFor(id, actor.uid)) ?? (actor.uid === event.hostUid ? 'host' : null);

  if (role !== 'host') {
    throw new ApiError('forbidden', 'Only the host can create cash pots.');
  }

  const input = await parseBody(request, createFundSchema);
  const fund = await createCashFund(event, input);
  return ok({ fund });
});
