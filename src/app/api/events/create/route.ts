import { can } from '@/lib/authz/policy';
import { recordAudit } from '@/lib/audit';
import { createEvent, toPreview } from '@/lib/services/events';
import {
  ApiError,
  limitByUser,
  ok,
  parseBody,
  requireIdentifiedActor,
  route,
} from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { createEventSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Creates an event and returns its join code exactly once, in this response. The code is
 * never included in any list or wall payload afterwards — re-reading it is a separate,
 * audited call that only the host can make.
 */
export const POST = route(async (request) => {
  const actor = await requireIdentifiedActor();
  if (!can('event:create', { actor })) {
    throw new ApiError('forbidden', 'This account cannot create events.');
  }
  await limitByUser('createEventPerUser', actor.uid);

  const input = await parseBody(request, createEventSchema);
  const { event, joinCode, promoId } = await createEvent(actor, input);

  await recordAudit(
    actor,
    {
      action: 'event.create',
      targetType: 'event',
      targetId: event.id,
      eventId: event.id,
      // The plan and any promo behind it are recorded here because this is the only moment
      // they are decided. A promo whose events cannot be identified afterwards is a cost with
      // no way of finding out whether it bought anything.
      metadata: {
        title: event.title,
        expiresAt: event.expiresAt,
        plan: event.plan,
        ...(promoId ? { promoId } : {}),
      },
    },
    requestContext(request),
  );

  return ok({ event: toPreview(event), joinCode });
});
