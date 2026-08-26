import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { collections, rateLimits, type RateLimitName } from '@/config';
import { db } from '@/lib/firebase/admin';

/**
 * Fixed-window rate limiting on Firestore.
 *
 * Behind an interface because Firestore is the wrong long-term home for this: every check
 * is a document write. It is correct, atomic and free of extra infrastructure, which is
 * the right trade for v1. Swapping in Memorystore later means implementing `RateLimiter`
 * and changing one line in `rateLimiter()`.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
  limit: number;
}

export interface RateLimiter {
  consume(name: RateLimitName, subject: string): Promise<RateLimitResult>;
}

/** Windows are aligned to wall-clock so the bucket id is derivable without a read. */
function bucketId(name: RateLimitName, subject: string, windowMs: number, now: number): string {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  // `subject` can contain characters Firestore forbids in ids (an IPv6 colon, a slash).
  const safeSubject = Buffer.from(subject).toString('base64url');
  return `${name}__${safeSubject}__${windowStart}`;
}

const firestoreRateLimiter: RateLimiter = {
  async consume(name: RateLimitName, subject: string): Promise<RateLimitResult> {
    const rule = rateLimits[name];
    const now = Date.now();
    const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
    const resetAt = windowStart + rule.windowMs;
    const reference = db()
      .collection(collections.rateLimits)
      .doc(bucketId(name, subject, rule.windowMs, now));

    const count = await db().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.exists ? Number(snapshot.get('count') ?? 0) : 0;
      const next = current + 1;
      transaction.set(
        reference,
        {
          count: next,
          name,
          windowStart,
          // Read by the Firestore TTL policy so spent buckets clean themselves up.
          expiresAt: new Date(resetAt + rule.windowMs),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return next;
    });

    return {
      allowed: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt,
      limit: rule.limit,
    };
  },
};

export function rateLimiter(): RateLimiter {
  return firestoreRateLimiter;
}

export class RateLimitError extends Error {
  readonly result: RateLimitResult;
  constructor(result: RateLimitResult) {
    super('Too many requests');
    this.name = 'RateLimitError';
    this.result = result;
  }
}

/** Consumes one token and throws when the window is exhausted. */
export async function enforceRateLimit(name: RateLimitName, subject: string): Promise<void> {
  const result = await rateLimiter().consume(name, subject);
  if (!result.allowed) throw new RateLimitError(result);
}
