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
