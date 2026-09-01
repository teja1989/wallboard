import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { renderEmail } from '@/lib/email/render';
import { readJoinCode, requireEvent } from '@/lib/services/events';
import { ok, requireIdentifiedActor, route } from '@/lib/server/api';
import { eventIdSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

// Only the two a host actually sends. The RSVP confirmation goes to a guest as a consequence
// of their own action, so there is no moment where a host is deciding whether to send it.
const kindSchema = z.enum(['invitation', 'reminder']).catch('invitation');

/**
 * What the guests will actually receive.
 *
 * There was no way to see this. `renderEmail` produces the HTML that lands in forty inboxes
 * and the host had no means of reading it before pressing send — they were mailing something
 * they had never looked at, to everyone they know.
 *
 * Returned as a string for the client to put in a sandboxed iframe rather than served as
 * `text/html`. Serving it would mean a page on our own origin whose body is assembled from
 * host-supplied text, and the global CSP sets `frame-ancestors 'none'`, so framing our own
 * route would need that relaxed. A string into `srcdoc` under `sandbox` needs neither: the
 * document gets an opaque origin and no script execution, and nothing about the CSP changes.
 *
 * The join code is real, because a preview built from a fake link is not a preview of the
 * message. It is host-only for exactly that reason — the rendered HTML contains a working
 * invitation link, so this is as sensitive as the code itself.
 */
export const GET = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireIdentifiedActor();
  const event = await requireEvent(id);
  assertCan('invite:send', { actor, eventRole: await eventRoleFor(id, actor.uid) });

  const kind = kindSchema.parse(new URL(request.url).searchParams.get('kind'));
  const joinCode = await readJoinCode(id);

  // Rendered with a guest's name so the host sees the greeting a real recipient gets, not a
  // blank where one belongs. No guest token: this is the shape of the message, and putting a
  // real person's tracking link in a preview would attribute the host's own read to them.
  const rendered = renderEmail(kind, { event, joinCode, guestName: 'Priya' });

  return ok({ subject: rendered.subject, html: rendered.html, kind });
});
