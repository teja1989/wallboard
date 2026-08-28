import { requireEvent } from '@/lib/services/events';
import { recordFunnel } from '@/lib/services/funnel';
import { recordRegistryClick } from '@/lib/services/registry';
import { limitByIp, ok, parseBody, route } from '@/lib/server/api';
import { eventIdSchema, registryClickSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * "Somebody went to look at a present."
 *
 * A beacon, not a redirect, and that is a deliberate choice. Counting clicks by routing guests
 * through `/r/{linkId}` would be more reliable — but the same mail scanners that forced the
 * view beacon to run after hydration would fetch that URL out of every emailed invitation, and
 * the one number this whole feature exists to produce would be inflated by robots. It would
 * also mean the destination stops working the moment we do, and put us between a guest and a
 * shop for no benefit to them.
 *
 * So the anchor keeps a real `href` — it works with JavaScript off, and it works if this route
 * is down — and the count is a side effect fired on the way out.
 *
 * Unauthenticated for the same reason as the view beacon: the reader may be a guest with no
 * session. It grants nothing and returns nothing, so the worst a forged call achieves is
 * making a host's own gift list look slightly more popular than it is.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  await limitByIp(request, 'viewBeaconPerIp');
  const { linkId } = await parseBody(request, registryClickSchema);

  await requireEvent(id);

  // The aggregate is the answer we are actually after — clicks over opens, across every event
  // — and it carries no identifiers. The per-link count beside it is for the host.
  await recordFunnel(id, 'giftLinkClicked');
  await recordRegistryClick(id, linkId);

  return ok({ recorded: true });
});
