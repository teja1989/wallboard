import { findInviteeByToken } from '@/lib/services/invites';
import { recordView } from '@/lib/services/delivery';
import { requireEvent } from '@/lib/services/events';
import { limitByIp, ok, parseBody, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema, guestTokenSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

const viewSchema = z.object({ token: guestTokenSchema });

/**
 * "Someone actually looked at this."
 *
 * Called by a beacon the invitation page fires *after hydration*, and that timing is the
 * entire point. Corporate mail security — Outlook Safe Links, Proofpoint, Mimecast — opens
 * every URL in every message it scans. If a plain request counted as a view, every guest at
 * a company would show as having read their invitation seconds after it was sent, and the
 * host's dashboard would be confidently, uselessly wrong. Requiring JavaScript to have run
 * is the one signal a scanner does not produce.
 *
 * Deliberately unauthenticated: the visitor is a guest who may have no session yet, and the
 * link token is the credential. It grants nothing — there is no readable response — so the
 * worst a stolen token buys is marking its own owner as having looked.
 *
 * The response never says whether the token was real. An endpoint that answered "no such
 * guest" would let anyone holding an event id test tokens, or confirm that a particular
 * person is on a guest list.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  await limitByIp(request, 'viewBeaconPerIp');
  const { token } = await parseBody(request, viewSchema);

  await requireEvent(id);
  const invitee = await findInviteeByToken(id, token);

  if (invitee) {
    await recordView(id, invitee, requestContext(request).userAgent);
  }

  return ok({ recorded: true });
});
