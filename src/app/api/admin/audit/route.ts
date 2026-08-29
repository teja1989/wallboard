import { assertCan } from '@/lib/authz/policy';
import { recordAudit } from '@/lib/audit';
import { listAudit } from '@/lib/services/admin';
import { limitByUser, ok, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { adminQuerySchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The audit trail.
 *
 * Written for every privileged action since v1 specifically so that this read would have
 * history behind it on the day it shipped — a log that starts when its reader does has
 * nothing to show about the incident that made someone open it.
 *
 * **Reading it is itself recorded.** This is the only read route in the product that writes an
 * audit entry, and it is deliberate: what is in here is the shape of what every host and guest
 * has been doing, so paging through it out of curiosity should leave the same trace as
 * suspending someone. `docs/SECURITY.md` has promised this since v1.
 *
 * The self-reference is finite and does not need guarding: one read records one entry, and
 * that entry is at the top of the next read. It does not compound.
 */
export const GET = route(async (request) => {
  const actor = await requireIdentifiedActor();
  assertCan('admin:viewAuditLog', { actor, eventRole: null });
  await limitByUser('adminReadPerUser', actor.uid);

  const filter = adminQuerySchema.parse(request.nextUrl.searchParams.get('q') ?? '');

  /*
    One box, two meanings. An operator pastes whatever id the complaint gave them, and it is
    an event id or an actor id — asking them which would be asking them to know something the
    console can just try. Event first: it is the id that appears in URLs, so it is the one
    that gets pasted.
  */
  const entries = filter
    ? await (async () => {
        const byEvent = await listAudit({ eventId: filter });
        return byEvent.length > 0 ? byEvent : listAudit({ actorUid: filter });
      })()
    : await listAudit();

  await recordAudit(
    actor,
    {
      action: 'admin.auditViewed',
      targetType: 'system',
      targetId: filter || 'all',
      metadata: { returned: entries.length },
    },
    requestContext(request),
  );

  return ok({ entries, filter });
});
