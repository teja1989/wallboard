import { contentLimits } from '@/config';

/**
 * Choosing the name shown beside everything someone does.
 *
 * Its own module, with no `server-only` import, so the precedence can be unit-tested
 * without standing up Firestore — the rule below is easy to get wrong and expensive to
 * notice, because getting it wrong looks like a settings form that works.
 */

/** What to call someone who has never told us. Derived, never blank. */
export function fallbackDisplayName(
  uid: string,
  isAnonymous: boolean,
  email: string | null,
): string {
  if (isAnonymous) return `Guest ${uid.slice(0, 4).toUpperCase()}`;

  const localPart = email?.split('@')[0] ?? '';
  const words = localPart
    .split(/[._\-+\d]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.length > 0 ? words.join(' ') : 'Someone';
}

/**
 * Which name wins.
 *
 * A name the account holder typed outranks the one on the provider's token. Without that
 * rule Google's `name` claim wins on every session mint and quietly undoes the rename they
 * just made in settings — the form would look like it worked, and then not have.
 */
export function resolveDisplayName(input: {
  fromProvider: string;
  stored: string;
  chosen: boolean;
  uid: string;
  isAnonymous: boolean;
  email: string | null;
}): string {
  const name =
    (input.chosen ? input.stored : '') ||
    input.fromProvider ||
    input.stored ||
    fallbackDisplayName(input.uid, input.isAnonymous, input.email);

  return name.slice(0, contentLimits.displayNameMaxLength);
}
