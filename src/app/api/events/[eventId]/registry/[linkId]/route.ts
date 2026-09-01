import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { requireLiveEvent } from '@/lib/services/events';
import { removeRegistryLink } from '@/lib/services/registry';
import { ApiError, ok, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema, registryLinkIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string; linkId: string }> };

/**
 * Taking a link back off the list. Host only, like putting one on.
 *
 * The sibling `registry/click` is a static segment, which Next resolves ahead of this dynamic
 * one, so the beacon is never mistaken for a link id. `registryLinkIdSchema` would reject the
 * word anyway — ids are twelve characters — but the routing is what actually decides it.
 */
export const DELETE = route(async (request, { params }: Params) => {
  const raw = await params;
  const id = eventIdSchema.parse(raw.eventId);
  const linkId = registryLinkIdSchema.parse(raw.linkId);

  const actor = await requireIdentifiedActor();
  const event = await requireLiveEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  if (!can('event:update', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('forbidden', 'Only the host can change the gift list.');
  }

  await removeRegistryLink(id, linkId);

  await recordAudit(
    actor,
    {
      action: 'registry.remove',
      targetType: 'event',
      targetId: id,
      eventId: id,
      metadata: { linkId },
    },
    requestContext(request),
  );

  return ok({ removed: linkId });
});
