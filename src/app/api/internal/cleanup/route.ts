import { timingSafeEqual } from 'node:crypto';
import { runCleanup } from '@/lib/services/cleanup';
import { ApiError, ok, route } from '@/lib/server/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Sweeps storage for expired events and abandoned uploads.
 *
 * Firestore TTL policies delete the *documents*, but bytes in a bucket outlive them, so
 * this job is what actually makes an expired event disappear. Driven by Cloud Scheduler in
 * production and by `npm run cleanup` in development.
 *
 * Authentication is a bearer secret compared in constant time. On Cloud Run, put this
 * behind Cloud Scheduler with an OIDC token and IAM as well — the secret is the fallback,
 * not the only lock.
 */
function assertAuthorized(header: string | null): void {
  const expected = process.env.CLEANUP_TASK_SECRET;
  if (!expected) throw new ApiError('server_error', 'Cleanup is not configured.');

  const presented = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError('unauthenticated', 'Not authorized.');
  }
}

export const POST = route(async (request) => {
  assertAuthorized(request.headers.get('authorization'));
  return ok(await runCleanup());
});
