import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { requireEvent } from '@/lib/services/events';
import { funnelForEvent } from '@/lib/services/funnel';
import { ApiError, ok, requireIdentifiedActor, route } from '@/lib/server/api';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * What happened to this invitation, in aggregate.
 *
 * Host only. The counters carry no identifiers — they are sums, one document per day — but
 * "thirty-one opened it and twenty-two replied" describes how the guest list is behaving,
 * and that is the host's to know rather than any guest's. So the Firestore rules deny the
 * collection outright and this is the only door.
 *
 * It exists now rather than when a dashboard does, because a service nothing calls is a
 * service nobody tests: `listDeliveries` has been written and unread for weeks, and a
 * measurement pipeline whose read path is unexercised is one that quietly stops working.
 * Smoke covers this route, which is what makes the counters trustworthy.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireIdentifiedActor();
  await requireEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  // Not found rather than forbidden for a stranger, matching the guest list and the event
  // itself: a 403 would confirm to anyone holding an id that the event exists. A member gets
  // the honest 403 below, because they already know it does.
  if (eventRole === null) throw new ApiError('not_found', 'That event does not exist.');
  assertCan('event:update', { actor, eventRole });

  // Not audited, unlike the join code or the guest list. Those name people; this counts them.
  return ok({ days: await funnelForEvent(id) });
});
