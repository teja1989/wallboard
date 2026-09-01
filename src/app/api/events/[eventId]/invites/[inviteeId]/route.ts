import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { requireEvent } from '@/lib/services/events';
import { removeInvitee } from '@/lib/services/invites';
import { ok, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema, inviteeIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string; inviteeId: string }> };

/**
 * Removes an address from the list.
 *
 * Note this is a removal, not an unsubscribe: a host tidying up a typo should not
 * permanently block that address. Opting out is the guest's decision and lives at
 * /api/unsubscribe.
 */
export const DELETE = route(async (request, { params }: Params) => {
  const raw = await params;
  const id = eventIdSchema.parse(raw.eventId);
  const inviteeId = inviteeIdSchema.parse(raw.inviteeId);

  const actor = await requireIdentifiedActor();
  await requireEvent(id);
  assertCan('invite:manage', { actor, eventRole: await eventRoleFor(id, actor.uid) });

  await removeInvitee(id, inviteeId);
  await recordAudit(
    actor,
    { action: 'invite.remove', targetType: 'event', targetId: id, eventId: id },
    requestContext(request),
  );

  return ok({ removed: true });
});
