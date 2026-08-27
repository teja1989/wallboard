import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { commsConfig } from '@/config';

/**
 * Phone numbers, normalised to E.164 or refused.
 *
 * No `server-only` import, deliberately: the host's browser formats numbers back for
 * display, and the rule below is worth unit-testing without standing up Firestore.
 *
 * Everything stored is E.164 — `+14155550123`, no spaces, no punctuation, country code
 * always present. A number stored the way somebody typed it is a number that cannot be
 * dialled, deduplicated, or compared against an opt-out list, and all three of those matter
 * the moment we start sending.
 */

/**
 * The country assumed for a number typed without one.
 *
 * This is a guess and it is sometimes wrong, which is why `describePhone` exists: the host
 * is shown what we made of their input rather than being left to discover months later that
 * a guest was never reachable.
 */
function defaultCountry(): CountryCode {
  return commsConfig.defaultCountry as CountryCode;
}

/**
 * E.164, or null when the input is not a real number.
 *
 * Rejecting is the right behaviour rather than storing a best guess. A malformed number is
 * a guest who silently never hears anything, and the host has no way to notice.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry());
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** True when this could be stored and one day dialled. */
export function isDialable(input: string): boolean {
  return normalizePhone(input) !== null;
}

/**
 * How a stored number should be shown back.
 *
 * International format — `+1 415 555 0123` — because the country code is the part a host
 * needs to see to catch the default-country guess going wrong.
 */
export function describePhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.formatInternational() ?? e164;
}

/**
 * Whether a string was even meant to be a number.
 *
 * Used to tell "this pasted line is a bad phone number" apart from "this pasted line is a
 * name". A block pasted out of a contacts app is full of both, and refusing the whole paste
 * over a stray word would be infuriating — but silently dropping something that was clearly
 * meant to be a number would be worse.
 */
export function looksLikePhone(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.includes('@')) return false;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;

  // Anything left over after digits and the punctuation people put in phone numbers means
  // this was a sentence, not a number.
  return /^[+()\-.\s\d]+$/.test(trimmed);
}
