import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { requireLiveEvent } from '@/lib/services/events';
import { recordFunnel } from '@/lib/services/funnel';
import { patchMilestone, removeMilestone } from '@/lib/services/planning';
import { ApiError, ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { eventIdSchema, milestoneIdSchema, patchMilestoneSchema } from '@/lib/validation/schemas';
import type { EventDoc } from '@/types/domain';
import type { Actor } from '@/types/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string; milestoneId: string }> };

/**
 * Everything a host does to one row: tick it, rename it, date it, price it, bin it.
 *
 * Both verbs share one gate, below. A stranger gets 404 for the same reason the read does; a
 * host on the free tier gets an honest 403, because they can see the list and are being told
 * plainly what unlocks working it.
 */
async function requireWorkingHost(eventId: string): Promise<{ actor: Actor; event: EventDoc }> {
  const actor = await requireIdentifiedActor();
  const event = await requireLiveEvent(eventId);
  const eventRole = await eventRoleFor(eventId, actor.uid);

  // The same two-step the read uses, and it has to stay the same: a guest who got 403 reading
  // and 404 writing would have been told, by the difference, that the thing they were refused
  // is real. Not found for somebody outside the event, forbidden for a guest inside it who
  // already knows it exists.
  if (eventRole === null) throw new ApiError('not_found', 'That event does not exist.');
  if (!can('event:update', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('forbidden', 'Only the host keeps the plan.');
  }
  if (!entitlementsFor(event.plan).eventPlanning) {
    throw new ApiError('forbidden', 'Working the planning list is part of a paid plan.');
  }

  return { actor, event };
}

export const PATCH = route(async (request, { params }: Params) => {
  const raw = await params;
  const id = eventIdSchema.parse(raw.eventId);
  const milestoneId = milestoneIdSchema.parse(raw.milestoneId);

  const patch = await parseBody(request, patchMilestoneSchema);
  const { event } = await requireWorkingHost(id);

  const { milestone, justCompleted } = await patchMilestone(event, milestoneId, patch);

  // Counted on the transition only, so a host toggling a box does not inflate the number.
  // Best-effort, like every counter: measuring the plan must not be able to break it.
  if (justCompleted) await recordFunnel(id, 'milestoneCompleted');

  return ok({ milestone });
});

export const DELETE = route(async (_request, { params }: Params) => {
  const raw = await params;
  const id = eventIdSchema.parse(raw.eventId);
  const milestoneId = milestoneIdSchema.parse(raw.milestoneId);

  const { event } = await requireWorkingHost(id);
  await removeMilestone(event, milestoneId);

  return ok({ removed: milestoneId });
});
