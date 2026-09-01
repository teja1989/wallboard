import { describe, expect, it } from 'vitest';
import { joinCodeConfig } from '@/config';
import { generateJoinCode, hashJoinCode, safeEqual } from '@/lib/codes';
import { formatJoinCode, isWellFormedJoinCode, normalizeJoinCode } from '@/lib/codes-format';

const PEPPER = 'a-pepper-that-is-long-enough-0123';

describe('generateJoinCode', () => {
  it('produces codes of the configured shape', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateJoinCode();
      expect(code).toHaveLength(joinCodeConfig.length);
      expect(isWellFormedJoinCode(code)).toBe(true);
    }
  });

  it('avoids characters that are ambiguous when read aloud', () => {
    const alphabet = joinCodeConfig.alphabet;
    for (const character of ['I', 'O', 'U', 'L', '0', '1']) {
      expect(alphabet).not.toContain(character);
    }
  });

  it('does not repeat within a large sample', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) seen.add(generateJoinCode());
    expect(seen.size).toBe(5000);
  });
});

describe('hashJoinCode', () => {
  it('is stable for the same code and pepper', () => {
    const code = generateJoinCode();
    expect(hashJoinCode(code, PEPPER)).toBe(hashJoinCode(code, PEPPER));
  });

  it('changes completely when the pepper changes', () => {
    const code = generateJoinCode();
    expect(hashJoinCode(code, PEPPER)).not.toBe(hashJoinCode(code, 'a-different-pepper-value-99'));
  });

  it('is insensitive to how the code was typed', () => {
    const code = 'ABCD2345';
    const canonical = hashJoinCode(code, PEPPER);
    expect(hashJoinCode('abcd2345', PEPPER)).toBe(canonical);
    expect(hashJoinCode('ABCD-2345', PEPPER)).toBe(canonical);
    expect(hashJoinCode('  abcd 2345 ', PEPPER)).toBe(canonical);
  });

  it('produces a value usable as a Firestore document id', () => {
    expect(hashJoinCode(generateJoinCode(), PEPPER)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('normalizeJoinCode', () => {
  it('strips the display hyphen, spaces and case', () => {
    expect(normalizeJoinCode('ab cd-2345')).toBe('ABCD2345');
  });
});

describe('formatJoinCode', () => {
  it('groups for readability', () => {
    expect(formatJoinCode('ABCD2345')).toBe('ABCD-2345');
  });

  it('round-trips through normalize', () => {
    const code = generateJoinCode();
    expect(normalizeJoinCode(formatJoinCode(code))).toBe(code);
  });

  it('handles a partially typed code', () => {
    expect(formatJoinCode('ABC')).toBe('ABC');
    expect(formatJoinCode('ABCDE')).toBe('ABCD-E');
  });
});

describe('isWellFormedJoinCode', () => {
  it('rejects the wrong length', () => {
    expect(isWellFormedJoinCode('ABCD234')).toBe(false);
    expect(isWellFormedJoinCode('ABCD23456')).toBe(false);
  });

  it('rejects excluded characters', () => {
    expect(isWellFormedJoinCode('ABCD2340')).toBe(false);
    expect(isWellFormedJoinCode('ABCDI345')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isWellFormedJoinCode('')).toBe(false);
  });
});

describe('safeEqual', () => {
  it('matches identical values', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
  });

  it('rejects different values without throwing on length mismatch', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcdef')).toBe(false);
  });
});
