import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { recordFunnel } from '@/lib/services/funnel';
import { requireEvent } from '@/lib/services/events';
import { repliedAddressesFor, sendToInvitees } from '@/lib/services/invites';
import {
  ApiError,
  limitByUser,
  ok,
  parseBody,
  requireIdentifiedActor,
  route,
} from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema, sendInvitesSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Params = { params: Promise<{ eventId: string }> };

/**
 * Sends the invitation, or nudges the people who have not replied.
 *
 * The host chooses *who* by having built the list; they do not choose *what* — the body is
 * rendered from the event. There is no field anywhere in this request that reaches a
 * recipient's inbox as free text, which is what keeps the sending domain ours to lose
 * rather than any one host's to burn.
 *
 * Reminders carry a heavier rate limit than invitations, because the invitation goes once
 * and a reminder is the button someone presses when they are impatient.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireIdentifiedActor();
  const event = await requireEvent(id);
  assertCan('invite:send', { actor, eventRole: await eventRoleFor(id, actor.uid) });

  const { kind, inviteeIds } = await parseBody(request, sendInvitesSchema);
  await limitByUser(kind === 'reminder' ? 'remindInvitesPerUser' : 'sendInvitesPerUser', actor.uid);

  if (event.status === 'ended') {
    throw new ApiError('gone', 'This event has ended, so nothing more will be sent.');
  }

  // A reminder must never reach someone who has already replied — so the set of people who
  // have is gathered here rather than trusted from the request.
  const replied = kind === 'reminder' ? await repliedAddressesFor(id) : new Set<string>();
  /*
    `inviteeIds` narrows, and only narrows — see `sendToInvitees`. It exists because "send to
    everyone unsent" was the only shape available, which is the wrong granularity for the way
    a guest list is actually built: people arrive in ones and twos over a week, a host wants
    to send to the four they just added without waiting, and a bounced address needs one
    retry, not a re-run over the whole list.
  */
  const summary = await sendToInvitees(event, kind, replied, inviteeIds);

  // One per message actually sent, so the denominator matches what left the building rather
  // than what the host pressed the button for. Reminders count too: an invitation that only
  // landed on the second attempt still had to be sent twice, and hiding that would flatter
  // the open rate.
  await recordFunnel(id, 'inviteSent', { by: summary.sent });

  await recordAudit(
    actor,
    {
      action: kind === 'reminder' ? 'invite.remind' : 'invite.send',
      targetType: 'event',
      targetId: id,
      eventId: id,
      metadata: {
        sent: summary.sent,
        failed: summary.failed,
        skipped: summary.skipped,
        // How many were named, not which — the log records the shape of the action, and a
        // list of guest ids in an audit entry is a guest list in an audit entry.
        named: inviteeIds?.length ?? 0,
      },
    },
    requestContext(request),
  );

  return ok(summary);
});
