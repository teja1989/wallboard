import { isEnabled } from '@/config';
import { connectBillingService } from '@/lib/billing/connect';
import { requireEvent } from '@/lib/services/events';
import { ApiError, ok, requireActor, route } from '@/lib/server/api';
import { eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/**
 * Checks Stripe Connect payout readiness for the event host.
 */
export const GET = route(async (request, { params }: Params) => {
  if (!isEnabled('cashFunds')) {
    throw new ApiError('not_found', 'Cash pots are not available.');
  }

  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  const event = await requireEvent(id);

  if (event.hostUid !== actor.uid) {
    throw new ApiError('forbidden', 'Only the event host can check payout status.');
  }

  const status = await connectBillingService.getAccountStatus(event.hostUid);
  return ok(status);
});
