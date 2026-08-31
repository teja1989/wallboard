import { z } from 'zod';
import { db } from '@/lib/firebase/admin';
import { collections } from '@/config';
import { FieldValue } from 'firebase-admin/firestore';
import { eventRef, requireLiveEvent } from '@/lib/services/events';
import { ok, parseBody, requireActor, route } from '@/lib/server/api';
import { eventIdSchema } from '@/lib/validation/schemas';
import type { MemberDoc } from '@/types/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const directJoinSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
});

type Params = { params: Promise<{ eventId: string }> };

/**
 * Allows a visitor with the direct event URL to join as a full posting member immediately.
 */
export const POST = route(async (request, { params }: Params) => {
  const { eventId } = await params;
  const id = eventIdSchema.parse(eventId);
  const actor = await requireActor();
  await requireLiveEvent(id);

  const body = await parseBody(request, directJoinSchema).catch(() => ({ displayName: undefined }));
  const displayName = body?.displayName || actor.displayName || 'Guest';

  const memberReference = eventRef(id).collection(collections.members).doc(actor.uid);

  await db().runTransaction(async (transaction) => {
    const existing = await transaction.get(memberReference);
    if (existing.exists) {
      transaction.update(memberReference, {
        displayName,
        role: 'member',
        'rsvp.status': 'yes',
      });
      return;
    }

    const memberDoc: MemberDoc = {
      uid: actor.uid,
      displayName,
      photoUrl: actor.photoUrl,
      role: 'member',
      joinedAt: Date.now(),
      mutedAt: null,
      isAnonymous: actor.isAnonymous,
      rsvp: {
        status: 'yes',
        partySize: 1,
        adults: 1,
        children: 0,
        respondedAt: Date.now(),
      },
    };

    transaction.set(memberReference, memberDoc);
    transaction.update(eventRef(id), {
      memberCount: FieldValue.increment(1),
      'rsvpTally.yes': FieldValue.increment(1),
      'rsvpTally.attending': FieldValue.increment(1),
    });
  });

  return ok({ joined: true, displayName });
});
