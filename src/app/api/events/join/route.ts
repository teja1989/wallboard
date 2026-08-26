import { recordAudit } from '@/lib/audit';
import { effectiveStatus, findEventByCode, joinEvent, toPreview } from '@/lib/services/events';
import {
  ApiError,
  limitByIp,
  limitByUser,
  ok,
  parseBody,
  requireActor,
  route,
} from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { joinEventSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Redeems a join code.
 *
 * Two rate limits apply: per-IP, which is what actually blocks code guessing, and
 * per-account, which stops a single signed-in identity from farming attempts across
 * addresses. Failures are logged so a burst of them is visible in the audit trail.
 *
 * Every failure mode returns the same message. Distinguishing "no such code" from
 * "expired code" would turn this endpoint into an oracle for which codes exist.
 */
export const POST = route(async (request) => {
  await limitByIp(request, 'joinAttemptPerIp');
  const actor = await requireActor();
  await limitByUser('joinAttemptPerUser', actor.uid);

  const input = await parseBody(request, joinEventSchema);
  const context = requestContext(request);
  const event = await findEventByCode(input.code);

  const rejected = !event || effectiveStatus(event) !== 'live';
  if (rejected) {
    await recordAudit(
      actor,
      {
        action: 'event.joinFailed',
        targetType: 'event',
        targetId: event?.id ?? 'unknown',
        eventId: event?.id ?? null,
        metadata: { reason: event ? 'not-live' : 'no-match' },
      },
      context,
    );
    throw new ApiError('not_found', 'That code did not work. Check it and try again.');
  }

  const outcome = await joinEvent(actor, event, input.displayName);

  if (!outcome.alreadyMember) {
    await recordAudit(
      actor,
      {
        action: 'event.join',
        targetType: 'member',
        targetId: actor.uid,
        eventId: event.id,
        metadata: { role: outcome.role, anonymous: actor.isAnonymous },
      },
      context,
    );
  }

  return ok({
    event: toPreview(event),
    role: outcome.role,
    alreadyMember: outcome.alreadyMember,
    canPost: outcome.role !== 'viewer',
  });
});
