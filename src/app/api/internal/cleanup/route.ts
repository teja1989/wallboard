import { runCleanup } from '@/lib/services/cleanup';
import { ok, route } from '@/lib/server/api';
import { assertInternalTask } from '@/lib/server/internal-task';

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
 * The bearer-secret check moved to `assertInternalTask`, shared with the reminder job — see
 * there for why one secret covers both and why it is not an OIDC token.
 */
export const POST = route(async (request) => {
  assertInternalTask(request.headers.get('authorization'));
  return ok(await runCleanup());
});
