import { assertCan } from '@/lib/authz/policy';
import { funnelAcrossEvents } from '@/lib/services/funnel';
import { ok, requireIdentifiedActor, route } from '@/lib/server/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The numbers across every event, for whoever is running this.
 *
 * `admin:accessConsole` is platform-only by construction — `platformOnlyPermissions` puts every
 * `admin:*` out of reach of any event role, so being the host of a hundred events grants
 * nothing here. The role comes from a custom claim, not from anything in the request.
 *
 * Nothing returned names an event, a host or a guest: it is one object of integers summed
 * across everything. That is not a courtesy, it is the same constraint the counters were built
 * under — sums cannot be de-anonymised, so a rollup of them cannot either.
 *
 * Not audited. The audit log is for things done *to* people; this reads nobody's data.
 */
export const GET = route(async () => {
  const actor = await requireIdentifiedActor();
  assertCan('admin:accessConsole', { actor, eventRole: null });

  return ok(await funnelAcrossEvents());
});
