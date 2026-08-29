import { platformRoleRank } from '@/config';
import { assertCan } from '@/lib/authz/policy';
import { recordAudit } from '@/lib/audit';
import { getUser, setSuspended } from '@/lib/services/admin';
import { ApiError, limitByUser, ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { suspendUserSchema, uidSchema } from '@/lib/validation/schemas';
import type { PlatformRole } from '@/types/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ uid: string }> };

/**
 * Suspends an account, or lifts a suspension.
 *
 * **The one thing in this product that could not be done.** `Actor.suspended` has been checked
 * on every write since v1 — `requireActor` refuses one, and `can()` refuses every non-read
 * permission to one — and nothing anywhere could set the field. Enforcement with no trigger.
 * The launch-day answer to an abuse report was to edit a Firestore document by hand.
 *
 * Two guards beyond the permission, both about the console being unable to eat itself:
 *
 *  - **Never yourself.** A single-operator install with one address in `OWNER_EMAILS` is one
 *    misclick away from nobody being able to lift it, and the lift is behind the permission
 *    that was just taken away.
 *  - **Never someone at or above your rank.** Otherwise two operators can suspend each other,
 *    and an `admin` — who has `admin:suspendUser` — could disable the `owner` above them.
 *    Rank is read from the platform role, which comes from a custom claim rather than from
 *    anything in the request.
 *
 * Both are audited either way. A suspension nobody can explain later is a suspension nobody
 * can defend.
 */
export const POST = route(async (request, { params }: Params) => {
  const { uid } = await params;
  const targetUid = uidSchema.parse(uid);

  const actor = await requireIdentifiedActor();
  assertCan('admin:suspendUser', { actor, eventRole: null });
  await limitByUser('adminSuspendPerUser', actor.uid);

  const input = await parseBody(request, suspendUserSchema);

  if (targetUid === actor.uid) {
    throw new ApiError('bad_request', 'You cannot suspend your own account.');
  }

  const target = await getUser(targetUid);
  if (!target) throw new ApiError('not_found', 'No such account.');

  if (platformRoleRank[target.role as PlatformRole] >= platformRoleRank[actor.role]) {
    throw new ApiError('forbidden', 'You cannot suspend an account at or above your own level.');
  }

  const user = await setSuspended(targetUid, input.suspended, input.reason);

  await recordAudit(
    actor,
    {
      action: input.suspended ? 'user.suspended' : 'user.unsuspended',
      targetType: 'user',
      targetId: targetUid,
      metadata: { reason: input.reason, targetRole: target.role },
    },
    requestContext(request),
  );

  return ok({ user });
});
