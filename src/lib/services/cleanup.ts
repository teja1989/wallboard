import 'server-only';
import { cleanupGraceMs, collections, sessionConfig, storagePaths } from '@/config';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/firebase/admin';
import { storage } from '@/lib/storage';
import type { EventDoc } from '@/types/domain';

/**
 * Expiry sweep.
 *
 * Firestore TTL policies remove expired documents on their own, but object storage has no
 * knowledge of them — so without this job, an "ephemeral" event would leave its photos and
 * video in the bucket indefinitely. That would make the core promise of the product false,
 * which is why this runs on a schedule rather than being best-effort at read time.
 *
 * Idempotent by construction: an event already marked swept is skipped, and deleting an
 * object that is already gone is not an error.
 */

const SWEEP_BATCH_SIZE = 50;

/**
 * Everything hanging off an event document.
 *
 * A Firestore TTL policy deletes the document it is set on and *nothing underneath it*, so
 * when the event doc lapses its subcollections become unreachable orphans that live
 * forever. For `rsvpNotes` and `invitees` that is a privacy problem rather than a billing
 * one: a note a guest wrote for the host, and a list of the addresses the host invited,
 * would outlive the event they belong to. The sweep is what actually keeps the promise.
 */
const EVENT_SUBCOLLECTIONS = [
  collections.members,
  collections.posts,
  collections.private,
  collections.rsvpNotes,
  collections.invitees,
] as const;

export interface CleanupSummary {
  eventsSwept: number;
  objectsDeleted: number;
  pendingUploadsCleared: number;
  startedAt: number;
  finishedAt: number;
}

/** Events past their expiry plus the grace window, and not yet swept. */
async function findSweepableEvents(): Promise<EventDoc[]> {
  const cutoff = Date.now() - cleanupGraceMs;
  const snapshot = await db()
    .collection(collections.events)
    .where('expiresAt', '<=', cutoff)
    .orderBy('expiresAt', 'asc')
    .limit(SWEEP_BATCH_SIZE)
    .get();

  return snapshot.docs
    .filter((doc) => doc.get('sweptAt') === undefined || doc.get('sweptAt') === null)
    .map((doc) => ({ ...(doc.data() as Omit<EventDoc, 'id'>), id: doc.id }));
}

/**
 * Uploads that were prepared but never finalized. Without this they would sit in the
 * pending prefix forever, since no post document ever referenced them.
 */
async function clearAbandonedUploads(eventId: string): Promise<number> {
  const prefix = `${storagePaths.eventPrefix(eventId)}pending/`;
  return storage().deletePrefix(prefix);
}

export async function runCleanup(): Promise<CleanupSummary> {
  const startedAt = Date.now();
  const events = await findSweepableEvents();

  let objectsDeleted = 0;
  let pendingUploadsCleared = 0;

  for (const event of events) {
    // Everything the event ever stored lives under one prefix, so a single call is enough.
    objectsDeleted += await storage().deletePrefix(storagePaths.eventPrefix(event.id));

    const reference = db().collection(collections.events).doc(event.id);
    for (const name of EVENT_SUBCOLLECTIONS) {
      await db().recursiveDelete(reference.collection(name));
    }

    // The event document itself survives the sweep, hollowed out. Someone following an old
    // link within the grace window should read "this has ended" rather than a 404, and the
    // TTL policy on `expiresAtTtl` removes the shell shortly after.
    await reference.update({
      status: 'expired',
      sweptAt: Date.now(),
      storageBytes: 0,
      postCount: 0,
    });

    await recordAudit(
      { uid: 'system', role: 'owner' },
      {
        action: 'system.cleanup',
        targetType: 'event',
        targetId: event.id,
        eventId: event.id,
        metadata: { objectsDeleted },
      },
      { ip: null, userAgent: 'cleanup-job' },
    );
  }

  // Live events accumulate abandoned uploads too, so sweep those independently of expiry.
  const staleCutoff = Date.now() - sessionConfig.pendingUploadTtlMs;
  const liveEvents = await db()
    .collection(collections.events)
    .where('status', '==', 'live')
    .where('createdAt', '<=', staleCutoff)
    .limit(SWEEP_BATCH_SIZE)
    .get();

  for (const doc of liveEvents.docs) {
    pendingUploadsCleared += await clearAbandonedUploads(doc.id);
  }

  return {
    eventsSwept: events.length,
    objectsDeleted,
    pendingUploadsCleared,
    startedAt,
    finishedAt: Date.now(),
  };
}
