import { looksLikePhone } from '@/lib/phone';

/**
 * Reading people out of what a host types or pastes.
 *
 * No `server-only`: the guest form uses this to classify a field as someone types, the same
 * functions parse a pasted block, and the unit tests exercise both without a running app.
 * The server still has the final say — it normalises numbers to E.164 with a real
 * phone-number library and refuses what it cannot dial.
 */

export interface Contact {
  email?: string;
  phone?: string;
  name: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What a single field holds, as far as we can tell while it is still being typed. */
export function classifyContact(value: string): 'email' | 'phone' | 'unknown' {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'unknown';
  if (EMAIL.test(trimmed)) return 'email';
  if (looksLikePhone(trimmed)) return 'phone';
  return 'unknown';
}

/** One field's worth of contact, as the shape the API takes. Null when it is neither. */
export function toContact(value: string, name: string): Contact | null {
  const trimmed = value.trim();
  switch (classifyContact(trimmed)) {
    case 'email':
      return { email: trimmed.toLowerCase(), name: name.trim() };
    case 'phone':
      return { phone: trimmed, name: name.trim() };
    default:
      return null;
  }
}

/**
 * Pulls people out of whatever was pasted.
 *
 * Handles `Name <a@b.com>`, bare addresses, and phone numbers in any of the shapes a
 * contacts app produces, separated by commas, semicolons, tabs or newlines. Anything that is
 * neither is dropped silently — pasted text is full of stray words, and refusing the whole
 * paste over one of them would be infuriating.
 *
 * Numbers are only shape-checked here. The server normalises them to E.164 and refuses what
 * it cannot dial, because a number stored as typed is a guest who never hears anything.
 */
export function parseContacts(input: string): Contact[] {
  const out = new Map<string, Contact>();

  for (const chunk of input.split(/[,;\t\n\r]+/)) {
    const piece = chunk.trim();
    if (!piece) continue;

    const angled = /^(.*?)<([^>]+)>$/.exec(piece);
    const value = (angled ? angled[2] : piece)?.trim() ?? '';
    const name = angled ? (angled[1] ?? '').trim().replace(/^["']|["']$/g, '') : '';

    const contact = toContact(value, name);
    if (!contact) continue;

    // Only exact repeats are collapsed here. The same number written two ways —
    // `+1 415 555 0123` and `(415) 555-0123` — is one person, but deciding that needs real
    // phone-number metadata, and guessing with a digit heuristic risks treating two
    // genuinely different numbers as one and silently dropping a guest. The server
    // normalises to E.164 and reports what it collapsed, which is the honest place for it.
    const key = contact.email ?? (contact.phone as string).replace(/\s+/g, '');
    if (!out.has(key)) out.set(key, contact);
  }

  return [...out.values()];
}

/**
 * Whether a pasted string carries more than one person.
 *
 * Decides whether a paste into a single field should expand into several rows or just fill
 * the one. Pasting a single address into a field should behave like pasting a single
 * address into a field.
 */
export function isMultiContactPaste(input: string): boolean {
  return parseContacts(input).length > 1;
}
