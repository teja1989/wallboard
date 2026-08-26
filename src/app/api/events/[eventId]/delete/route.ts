import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { deleteEventCompletely } from '@/lib/services/archive';
import { requireEvent } from '@/lib/services/events';
import { ApiError, ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { deleteEventSchema, eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Params = { params: Promise<{ eventId: string }> };

/**
 * Deletes an event and everything in it, now.
 *
 * The host has to type the event's title to confirm. That is not ceremony: this destroys
 * other people's photos as well as their own, there is no undo, and a mis-tap on a phone
 * should not be able to do it. Comparing the typed title is the cheapest way to be sure the
 * person meant *this* event and not the one they were looking at a minute ago.
 *
 * A POST rather than a DELETE on the event route, because it carries a confirmation body
 * and because it is a heavier act than the soft "end" that already exists.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireIdentifiedActor();
  const event = await requireEvent(id);

  // Deliberately the host permission, not a moderator's: ending an event is moderation,
  // erasing it is ownership.
  assertCan('event:update', { actor, eventRole: await eventRoleFor(id, actor.uid) });

  const { confirm } = await parseBody(request, deleteEventSchema);
  if (confirm.trim().toLowerCase() !== event.title.trim().toLowerCase()) {
    throw new ApiError('bad_request', 'That does not match the event name.');
  }

  // Logged before the deletion, so the trail survives the thing it describes.
  await recordAudit(
    actor,
    {
      action: 'event.delete',
      targetType: 'event',
      targetId: id,
      eventId: id,
      metadata: { title: event.title, postCount: event.postCount },
    },
    requestContext(request),
  );

  const summary = await deleteEventCompletely(event);
  return ok(summary);
});
