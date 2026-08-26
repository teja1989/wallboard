import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { joinCodeConfig } from '@/config';
import { normalizeJoinCode } from '@/lib/codes-format';

export { formatJoinCode, isWellFormedJoinCode, normalizeJoinCode } from '@/lib/codes-format';

/**
 * Join codes.
 *
 * The code is the credential for viewing an event, so it is treated like one: generated
 * from a CSPRNG, never logged, and looked up by hash. Firestore stores the plaintext only
 * inside `events/{id}/private/joinCode`, which no client rule can reach — hosts re-read it
 * through an audited API call.
 */

const { alphabet, length } = joinCodeConfig;

/**
 * ~30^8 ≈ 6.5e11 codes. Combined with the per-IP redemption rate limit, guessing a live
 * code is not a practical attack.
 */
export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }
  return code;
}

/**
 * Hashes with a server-side pepper so a Firestore dump does not hand over working codes.
 * The digest is used directly as a document id, making lookup a single `get` — no query,
 * and no way to enumerate the collection.
 */
export function hashJoinCode(code: string, pepper: string): string {
  return createHash('sha256')
    .update(`${pepper}:${normalizeJoinCode(code)}`)
    .digest('hex');
}

/** Constant-time comparison, for the rare path that compares two hashes directly. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
