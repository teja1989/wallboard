import 'server-only';
import { serverConfig } from '@/config';
import { emulatorAdapter } from './emulator.adapter';
import { gcsAdapter } from './gcs.adapter';
import type { StorageAdapter } from './types';

export type * from './types';

const adapters: Record<StorageAdapter['driver'], StorageAdapter> = {
  emulator: emulatorAdapter,
  gcs: gcsAdapter,
};

/** Selected by STORAGE_DRIVER. Application code depends on the interface, not the driver. */
export function storage(): StorageAdapter {
  return adapters[serverConfig().storage.driver];
}

/** File extension for an object path, derived from the MIME type rather than the filename. */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'audio/webm': '.weba',
  'audio/wav': '.wav',
};

export function extensionForMime(mimeType: string): string {
  const base = (mimeType.split(';')[0] ?? '').trim().toLowerCase();
  return (base ? EXTENSION_BY_MIME[base] : undefined) ?? EXTENSION_BY_MIME[mimeType] ?? '.bin';
}
