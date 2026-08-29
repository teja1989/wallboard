import { brand } from '@/config';
import { can } from '@/lib/authz/policy';
import { recordAudit } from '@/lib/audit';
import { mailer } from '@/lib/email';
import { renderEmail } from '@/lib/email/render';
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

  // Send a confirmation & welcome email with the event and host controls link.
  if (actor.email) {
    try {
      const rendered = renderEmail('welcomeHost', {
        event,
        joinCode,
      });
      await mailer().send({
        to: actor.email,
        fromName: brand.name,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        kind: 'welcomeHost',
        eventId: event.id,
      });
    } catch {
      // Non-blocking: failure to deliver email must never roll back event creation
    }
  }

  return ok({ event: toPreview(event), joinCode });
});
