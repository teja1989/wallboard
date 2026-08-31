import { eventIdSchema } from '@/lib/validation/schemas';
import { requireEvent } from '@/lib/services/events';
import { listVisiblePosts } from '@/lib/services/posts';
import { ok, requireActor, route } from '@/lib/server/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  await requireActor();
  await requireEvent(id);
  const posts = await listVisiblePosts(id);
  return ok({ posts });
});
