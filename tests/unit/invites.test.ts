import { describe, expect, it } from 'vitest';
import { classifyContact, isMultiContactPaste, parseContacts, toContact } from '@/lib/contacts';
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

/**
 * What a single field holds.
 *
 * New with the row-based guest form, and the reason it exists: the old paste box had no way
 * to say "this is a phone number belonging to Priya", so a name typed next to a number was
 * dropped on the floor. Classifying one field at a time is what lets the form keep the name.
 */
describe('classifyContact', () => {
  it('knows an address', () => {
    expect(classifyContact('priya@example.com')).toBe('email');
    expect(classifyContact('  PRIYA@example.com  ')).toBe('email');
  });

  it('knows a number in the shapes a contacts app produces', () => {
    expect(classifyContact('+1 415 555 0123')).toBe('phone');
    expect(classifyContact('(415) 555-0123')).toBe('phone');
    expect(classifyContact('415.555.0123')).toBe('phone');
  });

  it('says nothing while the field is still empty', () => {
    expect(classifyContact('')).toBe('unknown');
    expect(classifyContact('   ')).toBe('unknown');
  });

  it('refuses a name, a year, and a half-typed address', () => {
    expect(classifyContact('Priya Sharma')).toBe('unknown');
    expect(classifyContact('2026')).toBe('unknown');
    expect(classifyContact('priya@')).toBe('unknown');
  });
});

describe('toContact', () => {
  it('keeps the name beside a phone number, which is the whole point', () => {
    expect(toContact('+1 415 555 0123', 'Priya')).toEqual({
      phone: '+1 415 555 0123',
      name: 'Priya',
    });
  });

  it('lowercases an address so two spellings are one person', () => {
    expect(toContact('Priya@Example.com', ' Priya ')).toEqual({
      email: 'priya@example.com',
      name: 'Priya',
    });
  });

  it('is null for something we could not reach', () => {
    expect(toContact('Priya Sharma', 'Priya')).toBeNull();
  });
});

describe('isMultiContactPaste', () => {
  it('is true for a pasted list', () => {
    expect(isMultiContactPaste('a@x.com, b@x.com, c@x.com')).toBe(true);
    expect(isMultiContactPaste('a@x.com\n+14155550123')).toBe(true);
  });

  it('is false for one address, so a normal paste stays a normal paste', () => {
    // Restructuring the form because somebody pasted a single address would be obnoxious.
    expect(isMultiContactPaste('priya@example.com')).toBe(false);
    expect(isMultiContactPaste('')).toBe(false);
  });

  it('splits on tabs, which is what a spreadsheet column pastes as', () => {
    expect(isMultiContactPaste('a@x.com\tb@x.com')).toBe(true);
  });
});
