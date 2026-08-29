import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { recordAudit } from '@/lib/audit';
import { assertWhoCanPostAllowed, eventRef, requireEvent } from '@/lib/services/events';
import { ApiError, ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema, updateEventSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Host-editable event settings. Expiry is not editable here — see /extend.
 *
 * **This used to accept far more than it applied.** The schema validated a date, a venue, a
 * dress code, who the invitation is from and every RSVP setting; the handler mapped five
 * fields and silently dropped the rest. So a host who typed the wrong date could not fix it:
 * the request succeeded, the response came back with the old value, and nothing said why.
 *
 * Everything the schema accepts is now applied, flattened onto its own path so a partial
 * update cannot clobber a sibling — patching `rsvp.autoRemind` must not blank out the
 * host's custom question.
 */
export const PATCH = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireIdentifiedActor();
  const event = await requireEvent(id);

  assertCan('event:update', { actor, eventRole: await eventRoleFor(id, actor.uid) });
  const input = await parseBody(request, updateEventSchema);
  if (input.whoCanPost !== undefined) assertWhoCanPostAllowed(input.whoCanPost);

  const update: Record<string, unknown> = {};
  const set = <T,>(path: string, value: T | undefined) => {
    if (value !== undefined) update[path] = value;
  };

  set('title', input.title);
  set('description', input.description);
  set('hostedBy', input.hostedBy);
  set('templateId', input.templateId);
  set('startsAt', input.startsAt);
  set('endsAt', input.endsAt);
  set('timeZone', input.timeZone);
  set('dressCode', input.dressCode);
  // Replace wholesale: a location is one thing, and "no venue" is a legitimate value.
  set('location', input.location);
  set('settings.whoCanPost', input.whoCanPost);
  set('settings.allowedKinds', input.allowedKinds);

  // Flattened key by key, because `rsvp` arrives partial. Writing the object would erase
  // whichever settings this particular request happened not to mention.
  for (const [key, value] of Object.entries(input.rsvp ?? {})) {
    set(`rsvp.${key}`, value);
  }

  /*
    The end must still follow the start.

    The schema's own check only fires when a request carries both, so patching just one of
    them could otherwise leave an event ending before it begins. Compared against the merged
    result rather than the request.
  */
  const startsAt = input.startsAt !== undefined ? input.startsAt : event.startsAt;
  const endsAt = input.endsAt !== undefined ? input.endsAt : event.endsAt;
  if (startsAt !== null && endsAt !== null && endsAt < startsAt) {
    throw new ApiError('bad_request', 'The end time is before the start time.');
  }

  /*
    Moving the date re-opens the reminder schedule.

    Slots are recorded by id, so an event pushed back a month would otherwise stay marked as
    "week-before already sent" and quietly never chase anybody again. Clearing is the safe
    direction: at worst a guest who has not replied is asked once more.
  */
  if (input.startsAt !== undefined && input.startsAt !== event.startsAt) {
    update.remindersSent = [];
  }

  // An empty update throws inside Firestore with a message about field/value pairs, which
  // reaches the host as a 500 for what is really a request that asked for nothing.
  if (Object.keys(update).length === 0) {
    throw new ApiError('bad_request', 'Nothing to change.');
  }

  await eventRef(id).update(update);
  await recordAudit(
    actor,
    {
      action: 'event.update',
      targetType: 'event',
      targetId: id,
      eventId: id,
      metadata: { fields: Object.keys(update).join(',') },
    },
    requestContext(request),
  );

  return ok({ event: await requireEvent(id) });
});
