import { describe, expect, it } from 'vitest';
import { contentLimits } from '@/config';
import { fallbackDisplayName, resolveDisplayName } from '@/lib/authz/display-name';

const base = { uid: 'abcdef123456', isAnonymous: false, email: 'ada.lovelace@example.com' };

describe('fallbackDisplayName', () => {
  it('gives a guest a short, stable handle', () => {
    expect(fallbackDisplayName('abcdef123456', true, null)).toBe('Guest ABCD');
  });

  it('builds a name out of the address when there is nothing else', () => {
    expect(fallbackDisplayName('x', false, 'ada.lovelace@example.com')).toBe('Ada Lovelace');
    expect(fallbackDisplayName('x', false, 'grace_hopper@example.com')).toBe('Grace Hopper');
    expect(fallbackDisplayName('x', false, 'host-1756300000-42@example.com')).toBe('Host');
  });

  it('never returns an empty name', () => {
    expect(fallbackDisplayName('x', false, null)).toBe('Someone');
    expect(fallbackDisplayName('x', false, '12345@example.com')).toBe('Someone');
  });
});

describe('resolveDisplayName', () => {
  it('takes the provider name for an account that has never been renamed', () => {
    expect(
      resolveDisplayName({ ...base, fromProvider: 'Ada Lovelace', stored: '', chosen: false }),
    ).toBe('Ada Lovelace');
  });

  /**
   * The regression this module exists for: Google puts a `name` claim on every token, so
   * without the `chosen` flag the next session mint would overwrite the rename and the
   * settings form would silently undo itself.
   */
  it('keeps a name the account holder chose, even when the provider disagrees', () => {
    expect(
      resolveDisplayName({
        ...base,
        fromProvider: 'Ada Lovelace',
        stored: 'Ada',
        chosen: true,
      }),
    ).toBe('Ada');
  });

  it('falls back to the stored name when the provider supplies none', () => {
    expect(
      resolveDisplayName({ ...base, fromProvider: '', stored: 'Ada Lovelace', chosen: false }),
    ).toBe('Ada Lovelace');
  });

  it('derives one from the address when nothing else is known', () => {
    expect(resolveDisplayName({ ...base, fromProvider: '', stored: '', chosen: false })).toBe(
      'Ada Lovelace',
    );
  });

  it('never lets a chosen but empty name win', () => {
    expect(
      resolveDisplayName({ ...base, fromProvider: 'Ada Lovelace', stored: '', chosen: true }),
    ).toBe('Ada Lovelace');
  });

  it('truncates to the configured limit', () => {
    const long = 'A'.repeat(contentLimits.displayNameMaxLength + 40);
    expect(
      resolveDisplayName({ ...base, fromProvider: long, stored: '', chosen: false }),
    ).toHaveLength(contentLimits.displayNameMaxLength);
  });
});
