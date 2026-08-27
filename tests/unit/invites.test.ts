import { describe, expect, it } from 'vitest';
import { parseContacts } from '@/components/event/invite-panel';
import { addInviteesSchema, unsubscribeSchema } from '@/lib/validation/schemas';

/**
 * Parsing is the first thing a host touches when inviting people, and it takes whatever
 * their phone or spreadsheet happened to produce. Getting it wrong silently drops guests,
 * which is the worst possible failure for this feature.
 */
describe('parseContacts', () => {
  it('takes a comma-separated list of addresses', () => {
    expect(parseContacts('a@x.com, b@x.com')).toEqual([
      { email: 'a@x.com', name: '' },
      { email: 'b@x.com', name: '' },
    ]);
  });

  it('takes newlines and semicolons too', () => {
    expect(parseContacts('a@x.com\nb@x.com;c@x.com')).toHaveLength(3);
  });

  it('understands "Name <address>"', () => {
    expect(parseContacts('Priya Sharma <priya@x.com>')).toEqual([
      { email: 'priya@x.com', name: 'Priya Sharma' },
    ]);
  });

  it('strips quotes some clients add around the name', () => {
    expect(parseContacts('"Sam Okonkwo" <sam@x.com>')[0]?.name).toBe('Sam Okonkwo');
  });

  it('lower-cases, so one person is not invited twice', () => {
    expect(parseContacts('Sam@X.com, sam@x.com')).toHaveLength(1);
  });

  it('takes phone numbers in the shapes a contacts app produces', () => {
    const result = parseContacts('+1 415 555 0123, (415) 555-0124, 415.555.0125');
    expect(result).toHaveLength(3);
    expect(result.every((entry) => entry.phone && !entry.email)).toBe(true);
  });

  it('takes a mixed paste of numbers and addresses', () => {
    const result = parseContacts('priya@x.com\n+14155550123\nLee <lee@x.com>');
    expect(result.filter((entry) => entry.email)).toHaveLength(2);
    expect(result.filter((entry) => entry.phone)).toHaveLength(1);
  });

  it('collapses an exact repeat', () => {
    expect(parseContacts('+14155550123, +14155550123')).toHaveLength(1);
  });

  it('leaves format variants for the server to collapse', () => {
    // Deciding that these are one person needs real phone metadata. Guessing here could
    // merge two different numbers and silently drop a guest, so both are sent and the
    // server — which normalises to E.164 — reports one as a duplicate.
    expect(parseContacts('+1 415 555 0123, (415) 555-0123')).toHaveLength(2);
  });

  it('drops the stray words that come with a paste rather than refusing it', () => {
    // Rejecting the whole paste over one bad token is how you infuriate someone who has
    // just pasted forty addresses.
    const result = parseContacts('a@x.com, not an address, b@x.com');
    expect(result.map((entry) => entry.email)).toEqual(['a@x.com', 'b@x.com']);
  });

  it('returns nothing for text with no contacts in it', () => {
    expect(parseContacts('please invite everyone')).toEqual([]);
    expect(parseContacts('')).toEqual([]);
  });

  it('rejects things that only look like addresses', () => {
    expect(parseContacts('a@b, @x.com, a@.com')).toEqual([]);
  });

  it('does not mistake a year or a house number for a phone number', () => {
    expect(parseContacts('2026')).toEqual([]);
    expect(parseContacts('12')).toEqual([]);
  });
});

describe('addInviteesSchema', () => {
  it('accepts a valid list', () => {
    expect(
      addInviteesSchema.safeParse({ invitees: [{ email: 'a@x.com', name: 'A' }] }).success,
    ).toBe(true);
  });

  it('rejects an empty list', () => {
    expect(addInviteesSchema.safeParse({ invitees: [] }).success).toBe(false);
  });

  it('accepts someone known only by their number', () => {
    expect(
      addInviteesSchema.safeParse({ invitees: [{ phone: '+14155550123', name: 'A' }] }).success,
    ).toBe(true);
  });

  it('rejects a malformed address', () => {
    expect(addInviteesSchema.safeParse({ invitees: [{ email: 'nope' }] }).success).toBe(false);
  });

  it('refuses a guest with no way to reach them at all', () => {
    expect(addInviteesSchema.safeParse({ invitees: [{ name: 'Nobody' }] }).success).toBe(false);
  });

  it('caps how many can arrive at once', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ email: `a${i}@x.com` }));
    expect(addInviteesSchema.safeParse({ invitees: many }).success).toBe(false);
  });
});

describe('unsubscribeSchema', () => {
  const valid = {
    eventId: 'abcdefghij1234',
    email: 'a@x.com',
    token: 'a'.repeat(32),
  };

  it('accepts a well-formed link', () => {
    expect(unsubscribeSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a token that is not the right shape', () => {
    expect(unsubscribeSchema.safeParse({ ...valid, token: 'short' }).success).toBe(false);
    expect(unsubscribeSchema.safeParse({ ...valid, token: 'z'.repeat(32) }).success).toBe(false);
  });
});
