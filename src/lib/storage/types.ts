/**
 * Storage abstraction. Application code depends on this interface, never on a cloud SDK,
 * which is what lets the same code run against the Storage emulator with no GCP account
 * and against a private GCS bucket in production.
 */

export interface UploadTargetRequest {
  objectPath: string;
  contentType: string;
  /** Advisory cap echoed into the signed URL where the backend supports it. */
  maxBytes: number;
  ttlSeconds: number;
}

export interface UploadTarget {
  /** Where the browser PUTs the bytes. */
  url: string;
  method: 'PUT' | 'POST';
  /** Headers the browser must send verbatim, or the signature will not match. */
  headers: Record<string, string>;
  objectPath: string;
  expiresAt: number;
}

export interface ObjectStat {
  bytes: number;
  contentType: string;
  updatedAt: number;
}

export interface StorageAdapter {
  readonly driver: 'emulator' | 'gcs';
  /** Issues a target the browser can upload to directly, bypassing the app server. */
  createUploadTarget(request: UploadTargetRequest): Promise<UploadTarget>;
  /** Short-lived read URL. Objects are never public. */
  createReadUrl(objectPath: string, ttlSeconds: number): Promise<string>;
  /** Returns null when the object does not exist. */
  stat(objectPath: string): Promise<ObjectStat | null>;
  /** Writes bytes server-side. Used for generated posters, not user uploads. */
  put(objectPath: string, body: Buffer, contentType: string): Promise<void>;
  /** Copies within the bucket, used to promote a pending upload to its final path. */
  copy(fromPath: string, toPath: string): Promise<void>;
  delete(objectPaths: string[]): Promise<void>;
  /** Deletes everything under a prefix. Used when an event's bytes are swept. */
  deletePrefix(prefix: string): Promise<number>;
}
