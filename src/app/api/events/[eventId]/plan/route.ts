import { assertCan, can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { requireEvent, requireLiveEvent } from '@/lib/services/events';
import { addMilestone, readPlan } from '@/lib/services/planning';
import { ApiError, ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { addMilestoneSchema, eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * The host's planning list.
 *
 * Host only, in both directions. This is somebody's working notes about their own party —
 * what it is costing, what they have not done yet — and none of it is a guest's business. A
 * stranger gets a 404 rather than a 403, matching the guest list and the funnel, so holding an
 * event id confirms nothing.
 *
 * **Readable on every plan, workable only on a paid one.** The free tier gets the full list
 * for its occasion and cannot tick anything off. That is deliberate: the pitch *is* the rows —
 * a host looking at the ten things a fortieth needs can see exactly what they would be buying,
 * and hiding it behind a lock icon would be selling them a mystery. The gate is enforced on
 * every write below, not merely drawn in the UI.
 */
export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireIdentifiedActor();
  const event = await requireEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  if (eventRole === null) throw new ApiError('not_found', 'That event does not exist.');
  assertCan('event:update', { actor, eventRole });

  const plan = await readPlan(event);

  return ok({
    ...plan,
    // The client draws the locked state from the same answer the server enforces with, so a
    // UI that offers a tick the server would refuse is not possible.
    entitled: entitlementsFor(event.plan).eventPlanning,
    // Rendered beside the rows that ask for them. Derived here rather than stored, so they
    // cannot go stale, and free because the event document is already in hand.
    live: {
      headcount: event.rsvpTally.attending,
      replies: event.rsvpTally.yes + event.rsvpTally.no + event.rsvpTally.maybe,
      pending: event.rsvpTally.pending,
      venue: event.location?.name ?? event.location?.address ?? '',
    },
  });
});

export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireIdentifiedActor();
  const input = await parseBody(request, addMilestoneSchema);
  const event = await requireLiveEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);

  // Same two-step as the read above, and deliberately identical: a guest who got 403 reading
  // and 404 writing would learn from the difference that what they were refused is real.
  if (eventRole === null) throw new ApiError('not_found', 'That event does not exist.');
  if (!can('event:update', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('forbidden', 'Only the host keeps the plan.');
  }
  if (!entitlementsFor(event.plan).eventPlanning) {
    throw new ApiError('forbidden', 'Working the planning list is part of a paid plan.');
  }

  // Not audited. The audit log is for things done *to* other people — sends, exports, code
  // rotations, deletions. A host writing "order the cake" on their own list is none of those,
  // and logging it would bulk the trail with noise that hides the entries that matter.
  return ok({ milestone: await addMilestone(event, input) });
});
