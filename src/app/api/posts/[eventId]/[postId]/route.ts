import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { requireEvent } from '@/lib/services/events';
import { getPost, removePost } from '@/lib/services/posts';
import { ApiError, ok, requireActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema, postIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string; postId: string }> };

/**
 * Deletes a post. Authors can remove their own; moderators, hosts and platform admins can
 * remove anyone's. Media bytes are destroyed immediately either way.
 */
export const DELETE = route(async (request, { params }: Params) => {
  const raw = await params;
  const eventId = eventIdSchema.parse(raw.eventId);
  const postId = postIdSchema.parse(raw.postId);

  const actor = await requireActor();
  const event = await requireEvent(eventId);
  const post = await getPost(eventId, postId);
  if (!post || post.state === 'removed')
    throw new ApiError('not_found', 'That post is already gone.');

  const eventRole = await eventRoleFor(eventId, actor.uid);
  const isOwnResource = post.authorUid === actor.uid;
  const allowed =
    can('post:deleteAny', eventAuthzContext(actor, event, eventRole)) ||
    can('post:deleteOwn', eventAuthzContext(actor, event, eventRole, isOwnResource));

  if (!allowed) throw new ApiError('forbidden', 'You cannot remove that post.');

  await removePost(eventId, post);
  await recordAudit(
    actor,
    {
      action: 'post.delete',
      targetType: 'post',
      targetId: postId,
      eventId,
      metadata: { authorUid: post.authorUid, byAuthor: isOwnResource },
    },
    requestContext(request),
  );

  return ok({ deleted: true });
});
