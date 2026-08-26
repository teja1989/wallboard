import 'server-only';
import { Storage } from '@google-cloud/storage';
import { appConfig, serverConfig } from '@/config';
import type { ObjectStat, StorageAdapter, UploadTarget, UploadTargetRequest } from './types';

/**
 * Production driver. The bucket is private: nothing is ever made public, and every read
 * is a V4 signed GET that expires. Uploads are V4 signed PUTs straight from the browser
 * to the bucket, so media bytes never pass through Cloud Run.
 *
 * This is the one module allowed to import the GCS SDK (see eslint.config.mjs).
 */

let clientCache: Storage | null = null;

function client(): Storage {
  clientCache ??= new Storage({ projectId: appConfig.firebase.projectId });
  return clientCache;
}

function bucket() {
  return client().bucket(serverConfig().storage.bucket);
}

export const gcsAdapter: StorageAdapter = {
  driver: 'gcs',

  async createUploadTarget(request: UploadTargetRequest): Promise<UploadTarget> {
    const expiresAt = Date.now() + request.ttlSeconds * 1000;
    const [url] = await bucket()
      .file(request.objectPath)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresAt,
        contentType: request.contentType,
        // Binds the signature to a declared length, so an oversized body is rejected by
        // GCS itself rather than only by our finalize check.
        extensionHeaders: { 'x-goog-content-length-range': `0,${request.maxBytes}` },
      });

    return {
      url,
      method: 'PUT',
      headers: {
        'Content-Type': request.contentType,
        'x-goog-content-length-range': `0,${request.maxBytes}`,
      },
      objectPath: request.objectPath,
      expiresAt,
    };
  },

  async createReadUrl(objectPath: string, ttlSeconds: number): Promise<string> {
    const [url] = await bucket()
      .file(objectPath)
      .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + ttlSeconds * 1000 });
    return url;
  },

  async stat(objectPath: string): Promise<ObjectStat | null> {
    const file = bucket().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    return {
      bytes: Number(metadata.size ?? 0),
      contentType: String(metadata.contentType ?? 'application/octet-stream'),
      updatedAt: metadata.updated ? Date.parse(metadata.updated) : Date.now(),
    };
  },

  async put(objectPath: string, body: Buffer, contentType: string): Promise<void> {
    await bucket().file(objectPath).save(body, { contentType, resumable: false });
  },

  async copy(fromPath: string, toPath: string): Promise<void> {
    await bucket().file(fromPath).copy(bucket().file(toPath));
  },

  async delete(objectPaths: string[]): Promise<void> {
    await Promise.all(objectPaths.map((p) => bucket().file(p).delete({ ignoreNotFound: true })));
  },

  async deletePrefix(prefix: string): Promise<number> {
    const [files] = await bucket().getFiles({ prefix });
    await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
    return files.length;
  },
};
