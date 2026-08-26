import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { requireEvent } from '@/lib/services/events';
import { submitRsvp } from '@/lib/services/rsvp';
import { ApiError, limitByUser, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema, rsvpSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Answers the invitation.
 *
 * Anonymous guests are allowed here on purpose: someone handed the code was invited, and
 * requiring an account before they can say "yes, I'll be there" loses replies for no
 * security benefit. Posting to the wall still needs an account — that is where attribution
 * starts to matter.
 *
 * Ended and expired events still accept replies, because an RSVP deadline is the host's to
 * set and has nothing to do with when the wall stops taking photos.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireActor();
  const event = await requireEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  if (!can('rsvp:respond', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That event does not exist.');
  }
  await limitByUser('rsvpPerUser', actor.uid);

  const input = await parseBody(request, rsvpSchema);
  const outcome = await submitRsvp(actor, event, input);

  await recordAudit(
    actor,
    {
      action: outcome.changed ? 'rsvp.change' : 'rsvp.respond',
      targetType: 'member',
      targetId: actor.uid,
      eventId: id,
      metadata: { status: outcome.status, partySize: outcome.partySize },
    },
    requestContext(request),
  );

  return ok({ rsvp: outcome });
});
