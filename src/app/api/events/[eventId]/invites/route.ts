import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { readJoinCode, requireEvent } from '@/lib/services/events';
import { addInvitees, listInvitees } from '@/lib/services/invites';
import { limitByUser, ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { addInviteesSchema, eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * The guest list. Host only — this is who the invitation goes to, and who has seen it.
 *
 * The join code rides along because the relay panel cannot build a guest's personal link
 * without it, and anyone allowed to manage the list is by definition allowed to see the
 * code: they are about to send it to two hundred people.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireIdentifiedActor();
  await requireEvent(id);

  assertCan('invite:manage', { actor, eventRole: await eventRoleFor(id, actor.uid) });

  const [invitees, joinCode] = await Promise.all([listInvitees(id), readJoinCode(id)]);
  return ok({ invitees, joinCode });
});

/**
 * Adds addresses. Idempotent, capped by the event's plan, and it will not resurrect anyone
 * who has unsubscribed — the response says how many of each so the host is not left
 * wondering why the count did not move.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireIdentifiedActor();
  const event = await requireEvent(id);

  assertCan('invite:manage', { actor, eventRole: await eventRoleFor(id, actor.uid) });
  await limitByUser('addInviteesPerUser', actor.uid);

  const input = await parseBody(request, addInviteesSchema);
  const result = await addInvitees(event, input.invitees);

  await recordAudit(
    actor,
    {
      action: 'invite.add',
      targetType: 'event',
      targetId: id,
      eventId: id,
      metadata: { added: result.added, duplicates: result.duplicates, blocked: result.blocked },
    },
    requestContext(request),
  );

  return ok(result);
});
