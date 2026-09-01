import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { recordFunnel } from '@/lib/services/funnel';
import { requireLiveEvent } from '@/lib/services/events';
import { createPost, resolveMedia } from '@/lib/services/posts';
import { ApiError, limitByUser, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { createPostSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Step two: verifies the uploaded object, promotes it, and writes the post. The wall picks
 * the new document up through its Firestore listener, so there is nothing to broadcast here.
 */
export const POST = route(async (request) => {
  const actor = await requireActor();
  const input = await parseBody(request, createPostSchema);
  const event = await requireLiveEvent(input.eventId);
  const eventRole = await eventRoleFor(event.id, actor.uid);

  if (!can('post:create', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError(
      'forbidden',
      actor.isAnonymous ? 'Sign in to post to this wall.' : 'You cannot post here.',
    );
  }
  if (eventRole === null) throw new ApiError('forbidden', 'Join the event first.');

  await limitByUser('createPostPerUser', actor.uid);
  const post = await createPost(actor, event, input);

  // The moment a replier becomes a participant, which is the ratio the wall lives or dies on.
  await recordFunnel(event.id, 'postCreated');

  await recordAudit(
    actor,
    {
      action: 'post.create',
      targetType: 'post',
      targetId: post.id,
      eventId: event.id,
      metadata: { kind: post.kind, bytes: post.media[0]?.bytes ?? 0 },
    },
    requestContext(request),
  );

  return ok({ post: { ...post, media: await resolveMedia(post.media) } });
});
