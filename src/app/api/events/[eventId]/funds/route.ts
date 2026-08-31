import { eventRoleFor } from '@/lib/authz/session';
import { requireEvent } from '@/lib/services/events';
import { createCashFund, listFundsForEvent } from '@/lib/services/funds';
import { ApiError, ok, requireActor, route } from '@/lib/server/api';
import { createFundSchema, eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  await requireActor();
  await requireEvent(id);

  const funds = await listFundsForEvent(id);
  return ok({ funds });
});

export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  const event = await requireEvent(id);
  const role = await eventRoleFor(id, actor.uid);

  if (role !== 'host') {
    throw new ApiError('forbidden', 'Only the host can create cash pots.');
  }

  const body = await request.json();
  const input = createFundSchema.parse(body);

  const fund = await createCashFund(event, input);
  return ok({ fund });
});
