import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { assertWhoCanPostAllowed, eventRef, requireEvent } from '@/lib/services/events';
import { ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema, updateEventSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/** Host-editable event settings. Expiry is not editable here — see /extend. */
export const PATCH = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireIdentifiedActor();
  await requireEvent(id);

  assertCan('event:update', { actor, eventRole: await eventRoleFor(id, actor.uid) });
  const input = await parseBody(request, updateEventSchema);
  if (input.whoCanPost !== undefined) assertWhoCanPostAllowed(input.whoCanPost);

  // Flattened onto the settings map so a partial update cannot clobber sibling fields.
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.templateId !== undefined) update.templateId = input.templateId;
  if (input.whoCanPost !== undefined) update['settings.whoCanPost'] = input.whoCanPost;
  if (input.allowedKinds !== undefined) update['settings.allowedKinds'] = input.allowedKinds;

  await eventRef(id).update(update);
  await recordAudit(
    actor,
    {
      action: 'event.update',
      targetType: 'event',
      targetId: id,
      eventId: id,
      metadata: { fields: Object.keys(update).join(',') },
    },
    requestContext(request),
  );

  return ok({ event: await requireEvent(id) });
});
