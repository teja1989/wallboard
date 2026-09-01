import { joinCodeConfig } from '@/config';

/**
 * Pure join-code formatting, safe to import from client components.
 *
 * Split out from `codes.ts` deliberately: that module pulls in node:crypto for generation
 * and hashing, which must never reach the browser bundle. Anything shared between the two
 * sides lives here.
 */

const { alphabet, length, displayGroupSize } = joinCodeConfig;

/** Accepts what a human might type: lowercase, spaces, the display hyphen. */
export function normalizeJoinCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/** `A1B2C3D4` -> `A1B2-C3D4`. Display only; never stored or compared. */
export function formatJoinCode(code: string): string {
  const normalized = normalizeJoinCode(code);
  const groups: string[] = [];
  for (let i = 0; i < normalized.length; i += displayGroupSize) {
    groups.push(normalized.slice(i, i + displayGroupSize));
  }
  return groups.join('-');
}

export function isWellFormedJoinCode(input: string): boolean {
  const normalized = normalizeJoinCode(input);
  if (normalized.length !== length) return false;
  return [...normalized].every((character) => alphabet.includes(character));
}

/**
 * The link a host actually shares.
 *
 * Not `/e/{id}`: the event turns away anyone who is not already a member, which is every
 * person an invitation is sent to. Both the emailed button and the share sheet used to
 * point there, so a shared invitation was a dead end for its entire audience.
 *
 * The code is the credential everywhere else in the product, so it is the credential here
 * too — in the path rather than a query string, which keeps it out of `Referer` headers on
 * anything the page later loads, and lets the route render a real link preview.
 */
export function invitationPath(code: string, guestToken?: string): string {
  const path = `/i/${encodeURIComponent(code.replace(/-/g, '').toUpperCase())}`;
  // The token names one guest, which is what makes "who opened it?" answerable. It grants
  // nothing the code does not already grant — it only says who is holding it.
  return guestToken ? `${path}?g=${encodeURIComponent(guestToken)}` : path;
}
