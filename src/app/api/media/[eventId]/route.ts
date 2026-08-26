import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { requireEvent } from '@/lib/services/events';
import { getPost, resolveMedia } from '@/lib/services/posts';
import { ApiError, limitByUser, ok, requireActor, route } from '@/lib/server/api';
import { eventIdSchema, postIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Mints short-lived read URLs for a post's media.
 *
 * The wall reads post *documents* straight from Firestore for live updates, but those
 * documents hold object paths, not URLs. Playable URLs are issued here, per request, only
 * to members, and they expire — so a link pasted elsewhere stops working, and revoking
 * someone's membership actually revokes their access to the media.
 */
export const GET = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const postId = postIdSchema.parse(request.nextUrl.searchParams.get('postId') ?? '');

  const actor = await requireActor();
  const event = await requireEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  if (!can('post:view', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That post does not exist.');
  }
  await limitByUser('mediaUrlPerUser', actor.uid);

  const post = await getPost(id, postId);
  if (!post || post.state !== 'visible') {
    throw new ApiError('not_found', 'That post does not exist.');
  }

  return ok({ media: await resolveMedia(post.media) });
});
