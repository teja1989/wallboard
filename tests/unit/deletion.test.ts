import { describe, expect, it } from 'vitest';
import { storageSweep } from '@/config';
import { StorageSweepError, deleteAll, deleteAllWithRetry } from '@/lib/storage/batch';
import { matchesEventTitle } from '@/lib/utils';

/**
 * Deleting an event.
 *
 * Both halves of this are things that worked in development and failed in production, for
 * the same underlying reason: the emulator holds four files and a real wedding holds
 * fifteen hundred, and a host's own title comes back from their phone with an autocorrected
 * apostrophe in it. Neither shows up unless it is tested directly.
 */

describe('deleteAll', () => {
  it('never has more than the configured number in flight', async () => {
    const paths = Array.from({ length: 200 }, (_, i) => `object-${i}`);
    let inFlight = 0;
    let peak = 0;

    await deleteAll(paths, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });

    // The unbounded version peaked at 200 here, which against real Cloud Storage is a
    // rate-limit rejection that took the whole delete down with it.
    expect(peak).toBeLessThanOrEqual(storageSweep.concurrency);
  });

  it('deletes everything it is given', async () => {
    const paths = Array.from({ length: 137 }, (_, i) => `object-${i}`);
    const seen = new Set<string>();

    const result = await deleteAll(paths, async (path) => {
      seen.add(path);
    });

    expect(result.deleted).toBe(137);
    expect(seen.size).toBe(137);
    expect(result.failed).toEqual([]);
  });

  it('lets the other fourteen hundred through when one object will not go', async () => {
    const paths = Array.from({ length: 100 }, (_, i) => `object-${i}`);

    const result = await deleteAll(paths, async (path) => {
      if (path === 'object-42') throw new Error('429');
    });

    expect(result.deleted).toBe(99);
    expect(result.failed).toEqual(['object-42']);
  });

  it('does nothing, successfully, with nothing to do', async () => {
    const result = await deleteAll([], async () => {
      throw new Error('should never run');
    });
    expect(result).toEqual({ deleted: 0, failed: [] });
  });
});

describe('deleteAllWithRetry', () => {
  it('clears a transient failure on the second pass', async () => {
    const attempts = new Map<string, number>();

    const result = await deleteAllWithRetry(['a', 'b', 'c'], async (path) => {
      const seen = (attempts.get(path) ?? 0) + 1;
      attempts.set(path, seen);
      // The shape of a real 429: fine the moment it is asked again.
      if (path === 'b' && seen === 1) throw new Error('429');
    });

    expect(result.failed).toEqual([]);
    expect(result.deleted).toBe(3);
  });

  it('reports what is still failing rather than pretending it is gone', async () => {
    const result = await deleteAllWithRetry(['a', 'b'], async (path) => {
      if (path === 'b') throw new Error('403');
    });

    expect(result.failed).toEqual(['b']);
  });

  it('retries only the failures, not the whole list', async () => {
    let calls = 0;
    await deleteAllWithRetry(['a', 'b', 'c'], async (path) => {
      calls += 1;
      if (path === 'c' && calls <= 3) throw new Error('429');
    });
    // Three the first time round, one retry — not six.
    expect(calls).toBe(4);
  });
});

describe('StorageSweepError', () => {
  it('says how many, in a sentence a person could read', () => {
    expect(new StorageSweepError(1).message).toContain('1 stored file.');
    expect(new StorageSweepError(12).message).toContain('12 stored files.');
  });
});

describe('matchesEventTitle', () => {
  it('accepts the name typed exactly', () => {
    expect(matchesEventTitle('Ada & Grace', 'Ada & Grace')).toBe(true);
  });

  it('accepts a straight apostrophe for a curly one', () => {
    // The actual failure: created on a phone, which autocorrects, then typed on a laptop,
    // which does not. Two different strings, one name, and a button that stayed grey.
    expect(matchesEventTitle("Ada's 40th", 'Ada’s 40th')).toBe(true);
    expect(matchesEventTitle('Ada’s 40th', "Ada's 40th")).toBe(true);
  });

  it('accepts curly double quotes for straight ones', () => {
    expect(matchesEventTitle('The "big" one', 'The “big” one')).toBe(true);
  });

  it('forgives whitespace nobody can see', () => {
    expect(matchesEventTitle('  Ada   &  Grace ', 'Ada & Grace')).toBe(true);
  });

  it('ignores case, as it always did', () => {
    expect(matchesEventTitle('ADA & GRACE', 'Ada & Grace')).toBe(true);
  });

  it('still refuses a different name', () => {
    expect(matchesEventTitle('Ada & Grace', 'Ada and Grace')).toBe(false);
    expect(matchesEventTitle('Ada', 'Ada & Grace')).toBe(false);
  });

  it('refuses to let empty match empty', () => {
    // A guard, not a nicety: an untitled event must not be one keystroke from deletion.
    expect(matchesEventTitle('', '')).toBe(false);
    expect(matchesEventTitle('   ', '')).toBe(false);
  });
});
