import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { readJoinCode, requireEvent, rotateJoinCode } from '@/lib/services/events';
import { ok, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Reads the current join code. Deliberately an explicit endpoint rather than a field on
 * the event: every read is authorised and logged, so a host can see if their code was
 * pulled by an admin.
 */
export const GET = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireIdentifiedActor();
  await requireEvent(id);

  assertCan('event:viewJoinCode', { actor, eventRole: await eventRoleFor(id, actor.uid) });

  const code = await readJoinCode(id);
  await recordAudit(
    actor,
    { action: 'event.codeViewed', targetType: 'event', targetId: id, eventId: id },
    requestContext(request),
  );
  return ok({ code });
});

/** Rotates the code. The previous one stops working the moment this returns. */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireIdentifiedActor();
  await requireEvent(id);

  assertCan('event:rotateJoinCode', { actor, eventRole: await eventRoleFor(id, actor.uid) });

  const code = await rotateJoinCode(id);
  await recordAudit(
    actor,
    { action: 'event.codeRotated', targetType: 'event', targetId: id, eventId: id },
    requestContext(request),
  );
  return ok({ code });
});
