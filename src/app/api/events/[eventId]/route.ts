import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { collections } from '@/config';
import { db } from '@/lib/firebase/admin';
import { effectiveStatus, requireEvent } from '@/lib/services/events';
import { ApiError, ok, requireActor, route } from '@/lib/server/api';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Full event detail for a member. Non-members get 404 rather than 403: whether an event id
 * exists is itself information, and the join code is the only intended way in.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const actor = await requireActor();
  const id = eventIdSchema.parse(eventId);

  const event = await requireEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  if (!can('event:view', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That event does not exist.');
  }

  // The viewer's own reply, so the invitation can open in the right state without a
  // second round trip.
  const memberSnapshot = await db()
    .collection(collections.events)
    .doc(id)
    .collection(collections.members)
    .doc(actor.uid)
    .get();

  const memberRsvp = memberSnapshot.exists
    ? (memberSnapshot.get('rsvp') as { status?: string; partySize?: number } | undefined)
    : undefined;

  return ok({
    event: { ...event, status: effectiveStatus(event) },
    role: eventRole,
    rsvp: {
      status: memberRsvp?.status ?? 'pending',
      partySize: memberRsvp?.partySize ?? 1,
    },
    permissions: {
      canPost:
        can('post:create', eventAuthzContext(actor, event, eventRole)) &&
        effectiveStatus(event) === 'live',
      canModerate: can('post:deleteAny', eventAuthzContext(actor, event, eventRole)),
      canManage: can('event:update', eventAuthzContext(actor, event, eventRole)),
      canViewCode: can('event:viewJoinCode', eventAuthzContext(actor, event, eventRole)),
      canExportGuests: can('rsvp:export', eventAuthzContext(actor, event, eventRole)),
    },
  });
});
