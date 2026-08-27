import { contentLimits } from '@/config';
import { effectiveStatus, listEventsForHost } from '@/lib/services/events';
import { ok, requireIdentifiedActor, route } from '@/lib/server/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The events the caller hosts.
 *
 * Scoped to the caller by their own session — there is no uid parameter, because a route
 * that took one would be a route for reading someone else's events. Anonymous sessions are
 * refused: an event belongs to an account, and this is the list that account exists for.
 *
 * Deliberately thin. The join code is not here, and neither is the guest list; both are
 * separate, audited reads. This answers one question — what have I made — and a summary
 * that a host recognises is the whole job.
 */
export const GET = route(async () => {
  const actor = await requireIdentifiedActor();
  const events = await listEventsForHost(actor.uid, contentLimits.hostEventPageSize);

  return ok({
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      occasion: event.occasion,
      templateId: event.templateId,
      startsAt: event.startsAt,
      expiresAt: event.expiresAt,
      createdAt: event.createdAt,
      status: effectiveStatus(event),
      postCount: event.postCount,
      rsvpTally: event.rsvpTally,
    })),
  });
});
