import { NextResponse } from 'next/server';
import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { recordAudit } from '@/lib/audit';
import { requireEvent } from '@/lib/services/events';
import { guestsToCsv, listGuests } from '@/lib/services/rsvp';
import { ApiError, ok, requireActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * The guest list.
 *
 * Every member sees who is coming — that is what a guest list is for. Only hosts,
 * moderators and staff see the private notes, and that decision is made here from the
 * caller's permissions rather than from anything in the request, so an ordinary guest's
 * response never contains the field at all.
 *
 * `?format=csv` returns the export, which is a paid entitlement.
 */
export const GET = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireActor();
  const event = await requireEvent(id);
  const eventRole = await eventRoleFor(id, actor.uid);
  const context = eventAuthzContext(actor, event, eventRole);

  if (!can('member:list', context)) {
    throw new ApiError('not_found', 'That event does not exist.');
  }

  const includePrivate = can('rsvp:viewAll', context);
  const guests = await listGuests(id, includePrivate);

  if (request.nextUrl.searchParams.get('format') === 'csv') {
    if (!can('rsvp:export', context)) {
      throw new ApiError('forbidden', 'Only the host can export the guest list.');
    }
    if (!entitlementsFor(event.plan).guestListExport) {
      throw new ApiError('forbidden', 'Exporting the guest list is part of a paid plan.');
    }

    await recordAudit(
      actor,
      { action: 'rsvp.export', targetType: 'event', targetId: id, eventId: id },
      requestContext(request),
    );

    const filename = `${event.title.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-guests.csv`;
    return new NextResponse(guestsToCsv(guests, event), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return ok({ guests, tally: event.rsvpTally, canSeeNotes: includePrivate });
});
