import { isEnabled } from '@/config';
import { eventRoleFor } from '@/lib/authz/session';
import { requireEvent } from '@/lib/services/events';
import { deleteCashFund } from '@/lib/services/funds';
import { ApiError, ok, requireActor, route } from '@/lib/server/api';
import { eventIdSchema, fundIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string; fundId: string }> };

export const DELETE = route(async (_request, { params }: Params) => {
  if (!isEnabled('cashFunds')) {
    throw new ApiError('not_found', 'Cash pots are not available.');
  }

  const { eventId, fundId } = await params;
  const id = eventIdSchema.parse(eventId);
  const fid = fundIdSchema.parse(fundId);
  const actor = await requireActor();
  const event = await requireEvent(id);
  // The host may not carry a member row on their own event — see `GET /api/events/[eventId]`.
  const role = (await eventRoleFor(id, actor.uid)) ?? (actor.uid === event.hostUid ? 'host' : null);

  if (role !== 'host') {
    throw new ApiError('forbidden', 'Only the host can remove cash pots.');
  }

  await deleteCashFund(event.id, fid);
  return ok({ deleted: true });
});
