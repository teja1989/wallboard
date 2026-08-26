import { describe, expect, it } from 'vitest';
import { parseAddresses } from '@/components/event/invite-panel';
import { addInviteesSchema, unsubscribeSchema } from '@/lib/validation/schemas';

/**
 * Address parsing is the first thing a host touches when inviting people, and it takes
 * whatever their phone or spreadsheet happened to produce. Getting it wrong silently drops
 * guests, which is the worst possible failure for this feature.
 */
describe('parseAddresses', () => {
  it('takes a comma-separated list', () => {
    expect(parseAddresses('a@x.com, b@x.com')).toEqual([
      { email: 'a@x.com', name: '' },
      { email: 'b@x.com', name: '' },
    ]);
  });

  it('takes newlines and semicolons too', () => {
    expect(parseAddresses('a@x.com\nb@x.com;c@x.com')).toHaveLength(3);
  });

  it('understands "Name <address>"', () => {
    expect(parseAddresses('Priya Sharma <priya@x.com>')).toEqual([
      { email: 'priya@x.com', name: 'Priya Sharma' },
    ]);
  });

  it('strips quotes some clients add around the name', () => {
    expect(parseAddresses('"Sam Okonkwo" <sam@x.com>')[0]?.name).toBe('Sam Okonkwo');
  });

  it('lower-cases, so one person is not invited twice', () => {
    expect(parseAddresses('Sam@X.com, sam@x.com')).toHaveLength(1);
  });

  it('drops the stray words that come with a paste rather than refusing it', () => {
    // Rejecting the whole paste over one bad token is how you infuriate someone who has
    // just pasted forty addresses.
    const result = parseAddresses('a@x.com, not an address, b@x.com');
    expect(result.map((r) => r.email)).toEqual(['a@x.com', 'b@x.com']);
  });

  it('returns nothing for text with no addresses in it', () => {
    expect(parseAddresses('please invite everyone')).toEqual([]);
    expect(parseAddresses('')).toEqual([]);
  });

  it('rejects things that only look like addresses', () => {
    expect(parseAddresses('a@b, @x.com, a@.com')).toEqual([]);
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

  it('rejects a malformed address', () => {
    expect(addInviteesSchema.safeParse({ invitees: [{ email: 'nope' }] }).success).toBe(false);
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
