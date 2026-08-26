import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { sessionConfig, storagePaths } from '@/config';
import { requireEvent } from '@/lib/services/events';
import { signedUrl } from '@/lib/storage/signed-url-cache';
import { ApiError, limitByUser, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { eventIdSchema, mediaUrlsSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Mints read URLs for a wall's media.
 *
 * A batch, and deliberately so. The obvious shape — one request per post, each re-reading
 * that post to find its object paths — cost three Firestore reads per post, so opening a
 * wall of thirty photos cost ninety reads before a single pixel arrived. This costs two,
 * for any number of posts.
 *
 * The client already holds the post documents from its live listener, so it already knows
 * the paths; re-reading them server-side told us nothing we did not have. What matters is
 * that the paths are *authorised*, and the prefix is the authorisation: every object under
 * `events/{id}/posts/` belongs to that event, so a member of that event may already see
 * all of it. A path outside the prefix is refused.
 *
 * Removed posts are not a hole here: deleting a post destroys its bytes, so a stale path
 * signs a URL that resolves to nothing.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireActor();
  const event = await requireEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  if (!can('post:view', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That event does not exist.');
  }
  await limitByUser('mediaUrlPerUser', actor.uid);

  const { paths } = await parseBody(request, mediaUrlsSchema);
  const prefix = `${storagePaths.eventPrefix(id)}posts/`;
  const ttl = sessionConfig.mediaUrlTtlSeconds;

  const urls: Record<string, string> = {};
  for (const path of paths) {
    // The prefix check is the whole access control. Anything else would let a member of
    // one event sign a URL for another event's bytes.
    if (!path.startsWith(prefix)) continue;
    urls[path] = await signedUrl(path, ttl);
  }

  return ok({ urls, expiresAt: Date.now() + ttl * 1000 });
});
