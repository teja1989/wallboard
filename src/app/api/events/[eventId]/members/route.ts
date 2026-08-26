import { collections } from '@/config';
import { assertCan } from '@/lib/authz/policy';
import { eventRoleFor } from '@/lib/authz/session';
import { eventRef, requireEvent } from '@/lib/services/events';
import { ok, requireActor, route } from '@/lib/server/api';
import { eventIdSchema } from '@/lib/validation/schemas';
import type { MemberDoc } from '@/types/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ eventId: string }> };

/** Who is here. Available to any member, so the wall can show attribution and avatars. */
export const GET = route(async (_request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  await requireEvent(id);

  assertCan('member:list', { actor, eventRole: await eventRoleFor(id, actor.uid) });

  const snapshot = await eventRef(id)
    .collection(collections.members)
    .orderBy('joinedAt', 'asc')
    .limit(200)
    .get();

  const members = snapshot.docs.map((doc) => {
    const data = doc.data() as MemberDoc;
    // Emails and last-seen timestamps stay server-side; the wall only needs identity.
    return {
      uid: data.uid,
      displayName: data.displayName,
      photoUrl: data.photoUrl,
      role: data.role,
      joinedAt: data.joinedAt,
      isAnonymous: data.isAnonymous,
    };
  });

  return ok({ members });
});
