import 'server-only';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import {
  collections,
  contentLimits,
  mediaRules,
  sessionConfig,
  storagePaths,
  type MediaKind,
} from '@/config';
import { db } from '@/lib/firebase/admin';
import { ApiError } from '@/lib/server/api';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { extensionForMime, storage } from '@/lib/storage';
import { eventRef } from '@/lib/services/events';
import type { Actor, EventDoc, MediaAsset, PostDoc, ResolvedMedia } from '@/types/domain';
import type { CreatePostInput, UploadTargetInput } from '@/lib/validation/schemas';

/**
 * Posts and their media.
 *
 * The upload is a two-step handshake:
 *   1. `prepareUpload` issues a target for a *pending* object path.
 *   2. `createPost` verifies the object actually landed, re-reads its real size and stored
 *      content type, then promotes it to its final path and writes the post.
 *
 * Step 2 is what makes the client's declared byte count irrelevant: a client that lies is
 * caught here, the pending object is deleted, and no post is created.
 */

export interface PreparedUpload {
  uploadId: string;
  url: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  expiresAt: number;
}

export async function prepareUpload(
  event: EventDoc,
  input: UploadTargetInput,
): Promise<PreparedUpload> {
  if (!event.settings.allowedKinds.includes(input.kind)) {
    throw new ApiError('forbidden', `The host has turned off ${input.kind} for this event.`);
  }
  const entitlements = entitlementsFor(event.plan);
  if (event.postCount >= entitlements.maxPostsPerEvent) {
    throw new ApiError('conflict', 'This wall has reached its post limit.');
  }
  if (event.storageBytes + input.bytes > entitlements.maxStorageBytesPerEvent) {
    throw new ApiError('conflict', 'This event has used all of its storage.');
  }

  const uploadId = randomUUID();
  const objectPath = storagePaths.pending(event.id, uploadId, extensionForMime(input.mimeType));

  const target = await storage().createUploadTarget({
    objectPath,
    contentType: input.mimeType,
    maxBytes: mediaRules[input.kind].maxBytes,
    ttlSeconds: sessionConfig.uploadUrlTtlSeconds,
  });

  return {
    uploadId,
    url: target.url,
    method: target.method,
    headers: target.headers,
    expiresAt: target.expiresAt,
  };
}

/** Finds the pending object for an upload id, whatever extension it was stored under. */
async function locatePendingObject(
  eventId: string,
  uploadId: string,
  kind: MediaKind,
): Promise<{ objectPath: string; bytes: number; contentType: string }> {
  const candidates = mediaRules[kind].mimeTypes.map((mime) =>
    storagePaths.pending(eventId, uploadId, extensionForMime(mime)),
  );

  for (const objectPath of candidates) {
    const stat = await storage().stat(objectPath);
    if (stat) return { objectPath, bytes: stat.bytes, contentType: stat.contentType };
  }
  throw new ApiError('bad_request', 'That upload did not finish. Try again.');
}

/**
 * Server-side re-validation of what actually landed in the bucket. This is the check that
 * matters; everything before it is a hint from an untrusted client.
 */
function assertMediaWithinLimits(kind: MediaKind, bytes: number, contentType: string): void {
  const rule = mediaRules[kind];
  const normalizedType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!rule.mimeTypes.includes(normalizedType)) {
    throw new ApiError('bad_request', `${normalizedType || 'That file'} is not allowed here.`);
  }
  if (bytes <= 0) throw new ApiError('bad_request', 'That file came through empty.');
  if (bytes > rule.maxBytes) {
    throw new ApiError('bad_request', `That ${kind} is larger than the limit.`);
  }
}

function decodePosterDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) return null;
  return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] };
}

export async function createPost(
  actor: Actor,
  event: EventDoc,
  input: CreatePostInput,
): Promise<PostDoc> {
  const postRef = eventRef(event.id).collection(collections.posts).doc();
  const media: MediaAsset[] = [];
  let uploadedBytes = 0;

  if (input.upload) {
    const { uploadId, kind } = input.upload;
    if (!event.settings.allowedKinds.includes(kind)) {
      throw new ApiError('forbidden', `The host has turned off ${kind} for this event.`);
    }

    const pending = await locatePendingObject(event.id, uploadId, kind);
    try {
      assertMediaWithinLimits(kind, pending.bytes, pending.contentType);

      const rule = mediaRules[kind];
      if (
        rule.maxDurationSeconds !== null &&
        input.upload.durationSeconds !== null &&
        input.upload.durationSeconds > rule.maxDurationSeconds
      ) {
        throw new ApiError(
          'bad_request',
          `That ${kind} is longer than ${rule.maxDurationSeconds}s.`,
        );
      }

      const finalPath = storagePaths.post(
        event.id,
        postRef.id,
        extensionForMime(pending.contentType),
      );
      await storage().copy(pending.objectPath, finalPath);

      let posterPath: string | null = null;
      if (input.upload.posterDataUrl && kind !== 'image') {
        const poster = decodePosterDataUrl(input.upload.posterDataUrl);
        if (poster) {
          posterPath = storagePaths.poster(event.id, postRef.id);
          await storage().put(posterPath, poster.buffer, poster.contentType);
        }
      }

      uploadedBytes = pending.bytes;
      media.push({
        kind,
        objectPath: finalPath,
        posterPath,
        mimeType: pending.contentType,
        bytes: pending.bytes,
        durationSeconds: input.upload.durationSeconds,
        width: input.upload.width,
        height: input.upload.height,
      });
    } finally {
      // The pending copy is always cleaned up, whether or not validation passed.
      await storage()
        .delete([pending.objectPath])
        .catch(() => undefined);
    }
  }

  if (media.length > contentLimits.mediaPerPost) {
    throw new ApiError('bad_request', 'Too many attachments.');
  }

  const now = Date.now();
  const post: Omit<PostDoc, 'id'> = {
    eventId: event.id,
    kind: media[0]?.kind ?? 'text',
    authorUid: actor.uid,
    authorName: actor.displayName,
    authorPhotoUrl: actor.photoUrl,
    body: input.body,
    media,
    state: 'visible',
    createdAt: now,
    // Posts never outlive their event, even if the host later shortens it.
    expiresAt: event.expiresAt,
  };

  await db().runTransaction(async (transaction) => {
    transaction.set(postRef, { ...post, expiresAtTtl: new Date(event.expiresAt) });
    transaction.update(eventRef(event.id), {
      postCount: FieldValue.increment(1),
      storageBytes: FieldValue.increment(uploadedBytes),
    });
  });

  return { ...post, id: postRef.id };
}

/**
 * Soft-deletes a post and removes its bytes. The document is kept in a `removed` state so
 * moderation is reviewable and the audit trail points at something real; the media itself
 * is destroyed immediately, which is the part that actually matters to the person who
 * asked for it to go.
 */
export async function removePost(eventId: string, post: PostDoc): Promise<void> {
  const paths = post.media.flatMap((asset) =>
    [asset.objectPath, asset.posterPath].filter((p): p is string => !!p),
  );
  if (paths.length) await storage().delete(paths);

  const freedBytes = post.media.reduce((sum, asset) => sum + asset.bytes, 0);
  await db().runTransaction(async (transaction) => {
    transaction.update(eventRef(eventId).collection(collections.posts).doc(post.id), {
      state: 'removed',
      body: '',
      media: [],
      removedAt: Date.now(),
    });
    transaction.update(eventRef(eventId), {
      postCount: FieldValue.increment(-1),
      storageBytes: FieldValue.increment(-freedBytes),
    });
  });
}

export async function getPost(eventId: string, postId: string): Promise<PostDoc | null> {
  const snapshot = await eventRef(eventId).collection(collections.posts).doc(postId).get();
  if (!snapshot.exists) return null;
  return { ...(snapshot.data() as Omit<PostDoc, 'id'>), id: snapshot.id };
}

/** Attaches short-lived read URLs. Media URLs are minted per request, never stored. */
export async function resolveMedia(assets: MediaAsset[]): Promise<ResolvedMedia[]> {
  const ttl = sessionConfig.mediaUrlTtlSeconds;
  const expiresAt = Date.now() + ttl * 1000;
  return Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      url: await storage().createReadUrl(asset.objectPath, ttl),
      posterUrl: asset.posterPath ? await storage().createReadUrl(asset.posterPath, ttl) : null,
      urlExpiresAt: expiresAt,
    })),
  );
}
