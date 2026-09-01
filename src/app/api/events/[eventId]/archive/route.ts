import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { recordAudit } from '@/lib/audit';
import { buildArchive } from '@/lib/services/archive';
import { requireEvent } from '@/lib/services/events';
import { ApiError, limitByUser, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

type Params = { params: Promise<{ eventId: string }> };

/**
 * Downloads everything as a ZIP.
 *
 * Streamed, because a wedding wall can run to several gigabytes and buffering that would
 * take the container down mid-download. Host only, and gated on the plan — this is the
 * feature that makes "your photos are deleted for real" a promise rather than a threat, so
 * it is also the one that most justifies the price.
 *
 * Rate-limited harder than it looks like it needs: each call reads every object in the
 * event, so a refresh loop here is expensive in a way a JSON endpoint is not.
 */
export const GET = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);

  const actor = await requireIdentifiedActor();
  const event = await requireEvent(id);
  assertCan('event:update', { actor, eventRole: await eventRoleFor(id, actor.uid) });

  if (!entitlementsFor(event.plan).archiveDownload) {
    throw new ApiError('forbidden', 'Downloading the archive is part of a paid plan.');
  }
  await limitByUser('archivePerUser', actor.uid);

  const { stream, filename } = await buildArchive(event);

  await recordAudit(
    actor,
    { action: 'event.archive', targetType: 'event', targetId: id, eventId: id },
    requestContext(request),
  );

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});
