import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventMembershipFor } from '@/lib/authz/session';
import { effectiveStatus, requireEvent } from '@/lib/services/events';
import { listConfirmedAttendees } from '@/lib/services/rsvp';
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

  // One read of the membership document serves both the authorization decision and the
  // viewer's own reply, which the invitation needs to open in the right state. Reading the
  // role and then re-reading the same document for its `rsvp` field doubled the cost of
  // the most-requested route in the app.
  const membership = await eventMembershipFor(id, actor.uid);
  const eventRole = membership?.role ?? null;

  if (!can('event:view', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That event does not exist.');
  }

  const canListMembers = can('member:list', eventAuthzContext(actor, event, eventRole));
  const confirmedAttendees =
    canListMembers && event.rsvpTally.yes > 0 ? await listConfirmedAttendees(id, 6) : [];

  return ok({
    event: { ...event, status: effectiveStatus(event) },
    role: eventRole,
    confirmedAttendees,
    rsvp: {
      status: membership?.rsvp?.status ?? 'pending',
      partySize: membership?.rsvp?.partySize ?? 1,
      // Replies written before the breakdown existed count as adults; inventing children
      // for them would be worse than the missing detail.
      adults: membership?.rsvp?.adults ?? membership?.rsvp?.partySize ?? 1,
      children: membership?.rsvp?.children ?? 0,
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
