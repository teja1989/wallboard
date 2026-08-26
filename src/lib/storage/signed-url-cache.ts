import 'server-only';
import { mediaUrlCache } from '@/config';
import { storage } from '@/lib/storage';

/**
 * Reuses signed read URLs within a window.
 *
 * This is not a micro-optimisation, it is the difference between browser caching working
 * and not working at all. A V4 signature is computed from the current time, so every mint
 * produces a *different* URL for the same object — a different cache key — and the browser
 * re-downloads a photo it already has, every time the wall is opened.
 *
 * Handing every viewer the same URL inside the window makes their cache hit, and makes a
 * CDN in front of the bucket possible later.
 *
 * In-process on purpose. Firestore would make the cache shared across instances but would
 * cost a read to save an egress byte, which is the wrong trade — reads are the cheaper
 * resource here. Multiple instances simply mean a handful of distinct URLs rather than one.
 */

interface Entry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export async function signedUrl(objectPath: string, ttlSeconds: number): Promise<string> {
  const now = Date.now();
  const hit = cache.get(objectPath);
  if (hit && hit.expiresAt > now) return hit.url;

  const url = await storage().createReadUrl(objectPath, ttlSeconds);

  // Held for comfortably less than the signature's own lifetime, so a URL handed out at
  // the very end of the window is still valid for a while after that.
  const reuseFor = Math.min(mediaUrlCache.reuseMs, ttlSeconds * 1000 * 0.75);
  cache.set(objectPath, { url, expiresAt: now + reuseFor });

  if (cache.size > mediaUrlCache.maxEntries) evictExpired(now);
  return url;
}

/**
 * Drops expired entries, then the oldest, until the cache is back under its cap. Bounded
 * so one very busy event cannot grow the process without limit.
 */
function evictExpired(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }

  if (cache.size <= mediaUrlCache.maxEntries) return;
  const surplus = cache.size - mediaUrlCache.maxEntries;
  let removed = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    if (++removed >= surplus) break;
  }
}

/** Testing seam. */
export function clearSignedUrlCache(): void {
  cache.clear();
}
