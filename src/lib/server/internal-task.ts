import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { ApiError } from '@/lib/server/api';

/**
 * The lock on every server-to-server job endpoint.
 *
 * A bearer secret compared in constant time, shared by the internal task routes rather than
 * one secret per job. That is a deliberate choice and not laziness: these endpoints all sit
 * at the same trust level — Cloud Scheduler calling the app — and a second secret would mean
 * a second Secret Manager entry, a second Terraform value and a second thing to rotate, for
 * no additional isolation between callers that are already the same caller.
 *
 * An OIDC token would be the stronger lock, but the service has to be publicly invokable —
 * it is a website — so Cloud Run IAM cannot gate one path, and the token would occupy the
 * same Authorization header the app reads. In production put IAM in front where you can; the
 * shared secret is the lock that works regardless.
 */
export function assertInternalTask(header: string | null): void {
  const expected = process.env.CLEANUP_TASK_SECRET;
  if (!expected) throw new ApiError('server_error', 'Scheduled tasks are not configured.');

  const presented = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);

  // Length is compared first because `timingSafeEqual` throws on a mismatch rather than
  // returning false — and the length of a secret is not the part worth hiding.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError('unauthenticated', 'Not authorized.');
  }
}
