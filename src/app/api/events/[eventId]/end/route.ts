import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { endEvent, requireEvent } from '@/lib/services/events';
import { ok, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Ends an event early. The wall becomes read-only immediately; the media survives until
 * the scheduled sweep, so ending by accident is recoverable with /extend.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireIdentifiedActor();
  await requireEvent(id);

  assertCan('event:end', { actor, eventRole: await eventRoleFor(id, actor.uid) });
  await endEvent(id);
  await recordAudit(
    actor,
    { action: 'event.end', targetType: 'event', targetId: id, eventId: id },
    requestContext(request),
  );

  return ok({ status: 'ended' });
});
