import { runScheduledReminders } from '@/lib/services/reminders';
import { ok, route } from '@/lib/server/api';
import { assertInternalTask } from '@/lib/server/internal-task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Nudges guests who have not replied, on a schedule, so the host does not have to remember.
 *
 * Driven by Cloud Scheduler in production. Idempotency lives in the service rather than here:
 * each reminder slot is claimed in a transaction before anything is sent, so a retried run —
 * or two runs overlapping — sends nothing twice. That matters more than the usual "the job is
 * safe to re-run" line, because the side effect here is email to other people's guests.
 *
 * Deliberately does nothing clever with failures. A slot that was claimed and then failed to
 * send stays claimed: re-sending to everyone who *did* receive it is the outcome being
 * avoided, and a missed reminder is the cheaper error.
 */
export const POST = route(async (request) => {
  assertInternalTask(request.headers.get('authorization'));
  return ok(await runScheduledReminders());
});
