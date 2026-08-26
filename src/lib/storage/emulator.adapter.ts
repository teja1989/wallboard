import 'server-only';
import { appConfig, serverConfig } from '@/config';
import type { ObjectStat, StorageAdapter, UploadTarget, UploadTargetRequest } from './types';

/**
 * Development driver, backed by the Firebase Storage emulator's GCS JSON API. Spoken over
 * plain fetch so no cloud SDK and no credentials are involved — this is what lets the whole
 * app run with no GCP account.
 *
 * The emulator cannot sign V4 URLs and does not enforce access control, so "signed" URLs
 * here are just plain emulator URLs. That is a deliberate dev-only trade-off: the object
 * paths and the client code path are identical to production, only the enforcement is
 * absent. Never point STORAGE_DRIVER=emulator at anything but a local emulator.
 */

function baseUrl(): string {
  const { host, storagePort } = appConfig.emulator;
  return `http://${host}:${storagePort}`;
}

function bucketName(): string {
  return serverConfig().storage.bucket;
}

function objectUrl(objectPath: string): string {
  return `${baseUrl()}/storage/v1/b/${bucketName()}/o/${encodeURIComponent(objectPath)}`;
}

interface GcsObjectMetadata {
  size?: string;
  contentType?: string;
  updated?: string;
  name?: string;
}

async function readMetadata(objectPath: string): Promise<GcsObjectMetadata | null> {
  const response = await fetch(objectUrl(objectPath));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Storage emulator metadata read failed (${response.status}) for ${objectPath}`);
  }
  return (await response.json()) as GcsObjectMetadata;
}

export const emulatorAdapter: StorageAdapter = {
  driver: 'emulator',

  async createUploadTarget(request: UploadTargetRequest): Promise<UploadTarget> {
    const url =
      `${baseUrl()}/upload/storage/v1/b/${bucketName()}/o` +
      `?uploadType=media&name=${encodeURIComponent(request.objectPath)}`;
    return {
      url,
      method: 'POST',
      headers: { 'Content-Type': request.contentType },
      objectPath: request.objectPath,
      expiresAt: Date.now() + request.ttlSeconds * 1000,
    };
  },

  async createReadUrl(objectPath: string): Promise<string> {
    return `${objectUrl(objectPath)}?alt=media`;
  },

  async stat(objectPath: string): Promise<ObjectStat | null> {
    const metadata = await readMetadata(objectPath);
    if (!metadata) return null;
    return {
      bytes: Number(metadata.size ?? 0),
      contentType: metadata.contentType ?? 'application/octet-stream',
      updatedAt: metadata.updated ? Date.parse(metadata.updated) : Date.now(),
    };
  },

  async put(objectPath: string, body: Buffer, contentType: string): Promise<void> {
    const url =
      `${baseUrl()}/upload/storage/v1/b/${bucketName()}/o` +
      `?uploadType=media&name=${encodeURIComponent(objectPath)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: new Uint8Array(body),
    });
    if (!response.ok) {
      throw new Error(`Storage emulator write failed (${response.status}) for ${objectPath}`);
    }
  },

  /**
   * Read-then-write rather than a server-side copy: the Storage emulator answers 501 to
   * the GCS `copyTo` call. Pulling the bytes through the process is fine at development
   * volumes, and the GCS driver does a real server-side copy in production.
   */
  async copy(fromPath: string, toPath: string): Promise<void> {
    const metadata = await readMetadata(fromPath);
    if (!metadata) throw new Error(`Storage emulator copy source missing: ${fromPath}`);

    const download = await fetch(`${objectUrl(fromPath)}?alt=media`);
    if (!download.ok) {
      throw new Error(`Storage emulator copy read failed (${download.status}) for ${fromPath}`);
    }

    const body = Buffer.from(await download.arrayBuffer());
    await emulatorAdapter.put(toPath, body, metadata.contentType ?? 'application/octet-stream');
  },

  async delete(objectPaths: string[]): Promise<void> {
    await Promise.all(
      objectPaths.map(async (objectPath) => {
        const response = await fetch(objectUrl(objectPath), { method: 'DELETE' });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Storage emulator delete failed (${response.status}) for ${objectPath}`);
        }
      }),
    );
  },

  async deletePrefix(prefix: string): Promise<number> {
    const listUrl = `${baseUrl()}/storage/v1/b/${bucketName()}/o?prefix=${encodeURIComponent(prefix)}`;
    const response = await fetch(listUrl);
    if (!response.ok) return 0;
    const body = (await response.json()) as { items?: GcsObjectMetadata[] };
    const names = (body.items ?? []).map((i) => i.name).filter((n): n is string => !!n);
    await emulatorAdapter.delete(names);
    return names.length;
  },
};
