import { requireEvent } from '@/lib/services/events';
import { recordContribution } from '@/lib/services/funds';
import { ok, requireActor, route } from '@/lib/server/api';
import { contributeToFundSchema, eventIdSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string; fundId: string }> };

export const POST = route(async (request, { params }: Params) => {
  const { eventId, fundId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  const event = await requireEvent(id);

  const body = await request.json();
  const input = contributeToFundSchema.parse({ ...body, fundId });

  const result = await recordContribution(event, input, actor);
  return ok(result);
});
