import { z } from 'zod';
import { recordAudit } from '@/lib/audit';
import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventMembershipFor } from '@/lib/authz/session';
import { joinEvent, requireLiveEvent } from '@/lib/services/events';
import { ApiError, limitByUser, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const directJoinSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
});

type Params = { params: Promise<{ eventId: string }> };

/**
 * Joins the wall from inside the event page, without re-entering the code.
 *
 * The visitor is already looking at the event — they arrived by a guest link or by redeeming
 * the code — and this is the "enter your name to post" upgrade on the wall. So it does not
 * take a code, and that is the only way it differs from `POST /api/events/join`.
 *
 * **Everything else defers to `joinEvent`**, deliberately, because the first version of this
 * route reimplemented it and lost four things in the process:
 *
 *  - the `maxGuests` entitlement cap, so a free-plan guest list became unlimited;
 *  - the anonymous-visitor rule, forcing `role: 'member'` even where the host had set
 *    `whoCanPost: 'members'` — posting rights the host never granted;
 *  - the RSVP tally arithmetic, writing `rsvp.status: 'yes'` over an existing reply without
 *    decrementing whichever bucket the guest was already counted in;
 *  - and it wrote that `'yes'` at all, which tells the host somebody is attending because
 *    they typed their name to leave a photo.
 *
 * `event:view` is asserted first: without it this route would confirm which event ids exist
 * and add the caller to any of them.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  await limitByUser('joinAttemptPerUser', actor.uid);

  const event = await requireLiveEvent(id);
  const membership = await eventMembershipFor(id, actor.uid);
  const eventRole = membership?.role ?? (actor.uid === event.hostUid ? 'host' : null);

  if (!can('event:view', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('not_found', 'That event does not exist.');
  }

  const body = await parseBody(request, directJoinSchema).catch(() => ({
    displayName: undefined,
  }));
  const displayName = body?.displayName || actor.displayName || 'Guest';

  const outcome = await joinEvent(actor, event, displayName);

  if (!outcome.alreadyMember) {
    await recordAudit(
      actor,
      {
        action: 'event.join',
        targetType: 'member',
        targetId: actor.uid,
        eventId: event.id,
        metadata: { role: outcome.role, anonymous: actor.isAnonymous, via: 'direct' },
      },
      requestContext(request),
    );
  }

  // `canPost` rather than a bare `joined: true`: an anonymous visitor on a members-only
  // event joins as `viewer`, and the UI has to be told that so it does not show a composer
  // that every post would be rejected by.
  return ok({
    joined: true,
    displayName,
    role: outcome.role,
    alreadyMember: outcome.alreadyMember,
    canPost: outcome.role !== 'viewer',
  });
});
