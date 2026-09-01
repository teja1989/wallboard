import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { requireEvent, requireLiveEvent } from '@/lib/services/events';
import { addRegistryLink, listRegistry, registryAllowedFor } from '@/lib/services/registry';
import {
  ApiError,
  ok,
  parseBody,
  requireIdentifiedActor,
  requireActor,
  route,
} from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { addRegistryLinkSchema, eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * The gift list.
 *
 * Readable by every member, because that is who it is for — a guest deciding what to bring is
 * the entire audience. Writable only by the host.
 *
 * `allowed` comes back alongside the links so the client never has to re-derive the occasion
 * rule; the server decides once whether this kind of event carries a gift list, and the panel
 * and the invitation both read the same answer.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireActor();
  const event = await requireEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);
  const context = eventAuthzContext(actor, event, eventRole);

  // Matching the guest list: a stranger holding an id learns nothing, not even that it exists.
  if (!can('member:list', context)) {
    throw new ApiError('not_found', 'That event does not exist.');
  }

  return ok({ links: await listRegistry(id), allowed: registryAllowedFor(event) });
});

export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireIdentifiedActor();
  const input = await parseBody(request, addRegistryLinkSchema);
  const event = await requireLiveEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  if (!can('event:update', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('forbidden', 'Only the host can change the gift list.');
  }

  const link = await addRegistryLink(event, input);

  // Audited with the destination, because "who put this link in front of two hundred guests"
  // is a question worth being able to answer.
  await recordAudit(
    actor,
    {
      action: 'registry.add',
      targetType: 'event',
      targetId: id,
      eventId: id,
      metadata: { linkId: link.id, url: link.url },
    },
    requestContext(request),
  );

  return ok({ link });
});
