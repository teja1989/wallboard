import { assertCan } from '@/lib/authz/policy';
import { listAllUsers } from '@/lib/services/admin';
import { adminLimits } from '@/config';
import { limitByUser, ok, requireIdentifiedActor, route } from '@/lib/server/api';
import { adminQuerySchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Accounts, for whoever is running this.
 *
 * Deliberately thin: id, name, address, role, when they were last seen, and whether they are
 * suspended. Not their events, not their photos, not their replies. An operator looking up an
 * account in response to a complaint needs to identify it and act on it; everything past that
 * is reading a stranger's party, and a console makes that too easy to do idly.
 */
export const GET = route(async (request) => {
  const actor = await requireIdentifiedActor();
  assertCan('admin:listAllUsers', { actor, eventRole: null });
  await limitByUser('adminReadPerUser', actor.uid);

  const query = adminQuerySchema.parse(request.nextUrl.searchParams.get('q') ?? '');
  const users = await listAllUsers(query);

  return ok({ users, scanned: adminLimits.pageSize, query });
});
