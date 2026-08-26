import 'server-only';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import {
  collections,
  contentLimits,
  imageVariants,
  mediaRules,
  sessionConfig,
  storagePaths,
  type ImageVariantId,
  type MediaKind,
} from '@/config';
import { db } from '@/lib/firebase/admin';
import { ApiError } from '@/lib/server/api';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { extensionForMime, storage } from '@/lib/storage';
import { signedUrl } from '@/lib/storage/signed-url-cache';
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

export interface PreparedTarget {
  url: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
}

export interface PreparedUpload {
  uploadId: string;
  original: PreparedTarget;
  /** One per derivative the browser said it could produce. */
  variants: Partial<Record<ImageVariantId, PreparedTarget>>;
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
  const original = await storage().createUploadTarget({
    objectPath: storagePaths.pending(event.id, uploadId, extensionForMime(input.mimeType)),
    contentType: input.mimeType,
    maxBytes: mediaRules[input.kind].maxBytes,
    ttlSeconds: sessionConfig.uploadUrlTtlSeconds,
  });

  // One target per derivative the browser says it has. Asking for a target it never uses
  // costs nothing: the pending object simply never appears, and the sweep ignores it.
  const variants: Partial<Record<ImageVariantId, PreparedTarget>> = {};
  for (const id of input.variants) {
    const target = await storage().createUploadTarget({
      objectPath: storagePaths.pendingVariant(event.id, uploadId, id),
      contentType: 'image/webp',
      maxBytes: imageVariants[id].maxBytes,
      ttlSeconds: sessionConfig.uploadUrlTtlSeconds,
    });
    variants[id] = { url: target.url, method: target.method, headers: target.headers };
  }

  return {
    uploadId,
    original: { url: original.url, method: original.method, headers: original.headers },
    variants,
    expiresAt: original.expiresAt,
  };
}

/**
 * Promotes the derivatives that actually landed.
 *
 * Each is re-checked against its own cap and content type before being wired up, exactly
 * like the original — a browser can claim it uploaded a 40 KB preview and have uploaded
 * something else entirely. Anything that fails is dropped rather than fatal: the wall then
 * falls back to the original, which costs egress but shows the right picture.
 */
async function promoteVariants(
  eventId: string,
  postId: string,
  uploadId: string,
  claimed: readonly ImageVariantId[],
): Promise<Partial<Record<ImageVariantId, string>>> {
  const promoted: Partial<Record<ImageVariantId, string>> = {};

  for (const id of claimed) {
    const pendingPath = storagePaths.pendingVariant(eventId, uploadId, id);
    try {
      const stat = await storage().stat(pendingPath);
      if (!stat) continue;

      const contentType = stat.contentType.split(';')[0]?.trim().toLowerCase();
      if (contentType !== 'image/webp') continue;
      if (stat.bytes <= 0 || stat.bytes > imageVariants[id].maxBytes) continue;

      const finalPath = storagePaths.variant(eventId, postId, id);
      await storage().copy(pendingPath, finalPath);
      promoted[id] = finalPath;
    } catch (error) {
      console.error(`[posts] could not promote the ${id} variant`, error);
    } finally {
      await storage()
        .delete([pendingPath])
        .catch(() => undefined);
    }
  }

  if (claimed.length > 0 && Object.keys(promoted).length === 0) {
    // Worth noticing: it means every viewer of this post downloads the full original.
    console.warn(`[posts] no derivatives survived for ${postId}; serving the original`);
  }
  return promoted;
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

      const promoted = await promoteVariants(event.id, postRef.id, uploadId, input.upload.variants);

      uploadedBytes = pending.bytes;
      media.push({
        kind,
        objectPath: finalPath,
        previewPath: promoted.preview ?? null,
        displayPath: promoted.display ?? null,
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
  // Deleting the whole prefix rather than the listed paths, so a derivative that was
  // written but never recorded cannot be left behind paying rent forever.
  if (post.media.length > 0) {
    await storage().deletePrefix(storagePaths.postPrefix(eventId, post.id));
  }

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

/**
 * Attaches read URLs. Never stored on the document — they expire, which is what makes
 * removing someone from an event actually remove their access.
 *
 * `url` stays the original because the archive and any download want it. Everything the
 * wall and the lightbox render comes from `previewUrl` and `displayUrl`, which is where
 * the egress saving lives.
 */
export async function resolveMedia(assets: MediaAsset[]): Promise<ResolvedMedia[]> {
  const ttl = sessionConfig.mediaUrlTtlSeconds;
  const expiresAt = Date.now() + ttl * 1000;

  return Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      url: await signedUrl(asset.objectPath, ttl),
      previewUrl: asset.previewPath ? await signedUrl(asset.previewPath, ttl) : null,
      displayUrl: asset.displayPath ? await signedUrl(asset.displayPath, ttl) : null,
      urlExpiresAt: expiresAt,
    })),
  );
}
