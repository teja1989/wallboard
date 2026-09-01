import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { extendEvent, requireEvent } from '@/lib/services/events';
import { ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema, extendEventSchema } from '@/lib/validation/schemas';
import type { ExpiryPresetId } from '@/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Pushes the expiry out. Works on a just-lapsed event too, as long as it is still inside
 * the cleanup grace window — the media has not been swept yet, so the wall comes back whole.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireIdentifiedActor();
  await requireEvent(id);

  assertCan('event:extend', { actor, eventRole: await eventRoleFor(id, actor.uid) });
  const { expiryPresetId } = await parseBody(request, extendEventSchema);

  const expiresAt = await extendEvent(id, expiryPresetId as ExpiryPresetId);
  await recordAudit(
    actor,
    {
      action: 'event.extend',
      targetType: 'event',
      targetId: id,
      eventId: id,
      metadata: { expiresAt },
    },
    requestContext(request),
  );

  return ok({ expiresAt });
});
