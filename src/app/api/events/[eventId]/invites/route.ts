import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { requireEvent } from '@/lib/services/events';
import { addInvitees, listInvitees } from '@/lib/services/invites';
import { limitByUser, ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { addInviteesSchema, eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/** The guest list of addresses. Host only — this is the list mail goes to. */
export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireIdentifiedActor();
  await requireEvent(id);

  assertCan('invite:manage', { actor, eventRole: await eventRoleFor(id, actor.uid) });
  return ok({ invitees: await listInvitees(id) });
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
