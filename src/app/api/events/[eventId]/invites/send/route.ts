import { collections } from '@/config';
import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { recordFunnel } from '@/lib/services/funnel';
import { db } from '@/lib/firebase/admin';
import { eventRef, requireEvent } from '@/lib/services/events';
import { normalizeEmail, sendToInvitees } from '@/lib/services/invites';
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
import type { MemberDoc } from '@/types/domain';

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

  const { kind } = await parseBody(request, sendInvitesSchema);
  await limitByUser(kind === 'reminder' ? 'remindInvitesPerUser' : 'sendInvitesPerUser', actor.uid);

  if (event.status === 'ended') {
    throw new ApiError('gone', 'This event has ended, so nothing more will be sent.');
  }

  // A reminder must never reach someone who has already replied — so the set of people who
  // have is gathered here rather than trusted from the request.
  const replied = kind === 'reminder' ? await repliedAddresses(id) : new Set<string>();
  const summary = await sendToInvitees(event, kind, replied);

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
      metadata: { sent: summary.sent, failed: summary.failed, skipped: summary.skipped },
    },
    requestContext(request),
  );

  return ok(summary);
});

/**
 * Addresses belonging to members who have answered.
 *
 * Matching is by address, which only works for guests who arrived through an emailed
 * invitation and signed in with the same address. Someone who used the code and a different
 * account will still get a nudge — annoying, but the alternative is silently not reminding
 * people who genuinely have not replied, which is worse for the host.
 */
async function repliedAddresses(eventId: string): Promise<Set<string>> {
  const snapshot = await eventRef(eventId).collection(collections.members).get();
  const uids = snapshot.docs
    .map((doc) => doc.data() as MemberDoc)
    .filter((member) => (member.rsvp?.status ?? 'pending') !== 'pending')
    .map((member) => member.uid);

  if (uids.length === 0) return new Set();

  const addresses = new Set<string>();
  // Firestore caps an `in` query at 30 values, so this walks in chunks.
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    const users = await db().collection(collections.users).where('uid', 'in', chunk).get();
    for (const doc of users.docs) {
      const email = doc.get('email');
      if (typeof email === 'string' && email) addresses.add(normalizeEmail(email));
    }
  }
  return addresses;
}
