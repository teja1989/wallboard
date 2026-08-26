import { recordAudit } from '@/lib/audit';
import { getEvent } from '@/lib/services/events';
import { unsubscribe, verifyUnsubscribeToken } from '@/lib/services/invites';
import { ApiError, limitByIp, ok, parseBody, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { unsubscribeSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Opting out.
 *
 * Deliberately unauthenticated: the person clicking this is a guest who never had an
 * account and should not need one to be left alone. The signed token is what proves they
 * hold the link that was sent to that address.
 *
 * Always answers the same way, whether or not the address was ever on the list, so this
 * cannot be used to test which addresses a host invited.
 */
export const POST = route(async (request) => {
  await limitByIp(request, 'unsubscribePerIp');
  const { eventId, email, token } = await parseBody(request, unsubscribeSchema);

  if (!verifyUnsubscribeToken(eventId, email, token)) {
    throw new ApiError('forbidden', 'That link is not valid. Try the one in the email again.');
  }

  const event = await getEvent(eventId);
  if (event) {
    await unsubscribe(eventId, email);
    await recordAudit(
      { uid: 'guest', role: 'user' },
      {
        action: 'invite.unsubscribe',
        targetType: 'event',
        targetId: eventId,
        eventId,
        // The address itself is not logged: an audit trail is not a mailing list.
        metadata: { viaToken: true },
      },
      requestContext(request),
    );
  }

  return ok({ unsubscribed: true });
});
