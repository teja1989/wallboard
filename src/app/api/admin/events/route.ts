import { assertCan } from '@/lib/authz/policy';
import { listAllEvents } from '@/lib/services/admin';
import { adminLimits } from '@/config';
import { limitByUser, ok, requireIdentifiedActor, route } from '@/lib/server/api';
import { adminQuerySchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Every event, for whoever is running this.
 *
 * The takedown path starts here. A complaint arrives naming an invitation; this turns that
 * into an event id, and the event's own wall — which a platform role can already open, since
 * `event:view` and `post:deleteAny` sit on `support` and `admin` — is where a post comes down.
 * Without this route those permissions were unreachable in practice: enforcement with no way
 * to find the thing being enforced against.
 *
 * `admin:*` is platform-only by construction, so hosting a hundred events grants nothing here.
 *
 * Not audited. It is a list of titles and counts, it names no guest, and auditing every
 * keystroke of a search box would bury the entries that matter under noise. Suspension and
 * reading the audit log — the two that touch a person — are audited.
 */
export const GET = route(async (request) => {
  const actor = await requireIdentifiedActor();
  assertCan('admin:listAllEvents', { actor, eventRole: null });
  await limitByUser('adminReadPerUser', actor.uid);

  const query = adminQuerySchema.parse(request.nextUrl.searchParams.get('q') ?? '');
  const events = await listAllEvents(query);

  return ok({
    events,
    /*
      The page says out loud that a text search only covers the most recent page. An operator
      who does not know that would read an empty result as "no such event" when the truth is
      "not in the last fifty", and act on it.
    */
    scanned: adminLimits.pageSize,
    query,
  });
});
