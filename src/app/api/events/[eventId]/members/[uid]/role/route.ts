import { assertCan } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { assignMemberRole, requireEvent } from '@/lib/services/events';
import { ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { assignRoleSchema, eventIdSchema, uidSchema } from '@/lib/validation/schemas';
import type { EventRole } from '@/types/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string; uid: string }> };

/**
 * Assigns an event role to a member (e.g. promoting to cohost or demoting to member).
 *
 * Enforces:
 *  - Caller must hold `member:assignRole` (primary host).
 *  - Target cannot be the event's creator/host (the primary host cannot be demoted).
 *  - Caller cannot change their own role.
 *  - Anonymous guests cannot be given administrative roles (cohost/moderator) until they sign in.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId, uid } = await params;
  const id = eventIdSchema.parse(eventId);
  const targetUid = uidSchema.parse(uid);

  const actor = await requireIdentifiedActor();
  const event = await requireEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  assertCan('member:assignRole', eventAuthzContext(actor, event, eventRole));

  const input = await parseBody(request, assignRoleSchema);
  const role = input.role as EventRole;

  const outcome = await assignMemberRole(event, targetUid, role, actor);

  await recordAudit(
    actor,
    {
      action: 'member.roleAssigned',
      targetType: 'member',
      targetId: targetUid,
      eventId: id,
      metadata: { previousRole: outcome.previousRole, newRole: outcome.newRole },
    },
    requestContext(request),
  );

  return ok({
    ok: true,
    previousRole: outcome.previousRole,
    role: outcome.newRole,
  });
});
