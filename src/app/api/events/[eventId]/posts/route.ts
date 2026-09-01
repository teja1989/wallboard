import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventMembershipFor } from '@/lib/authz/session';
import { requireEvent } from '@/lib/services/events';
import { listVisiblePosts } from '@/lib/services/posts';
import { ApiError, ok, requireActor, route } from '@/lib/server/api';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * The wall, as a plain fetch — the fallback the live listener falls back *to*.
 *
 * `requireActor` is not authorization. It says somebody is signed in, and an anonymous guest
 * satisfies it, so on its own it would let any visitor read the guest wall of any event whose
 * id they could name. `post:view` through `can()` is what actually scopes this to the event's
 * own members, and it is the same check the realtime path gets from `firestore.rules`.
 *
 * A caller who may not see the event gets `not_found`, not `forbidden`: telling them the
 * event exists but is closed to them is the same disclosure, made politely.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  const event = await requireEvent(id);

  const membership = await eventMembershipFor(id, actor.uid);
  const eventRole = membership?.role ?? (actor.uid === event.hostUid ? 'host' : null);

  if (!can('post:view', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That event does not exist.');
  }

  const posts = await listVisiblePosts(id);
  return ok({ posts });
});
