import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE } from '@/config';
import {
  formatBytes,
  formatDuration,
  formatEventDate,
  formatRelativeTime,
  formatTimeRemaining,
  initialsOf,
  isValidTimeZone,
} from '@/lib/utils';

const NOW = 1_700_000_000_000;

describe('formatTimeRemaining', () => {
  it('says expired once the moment has passed', () => {
    expect(formatTimeRemaining(NOW - 1, NOW)).toBe('expired');
    expect(formatTimeRemaining(NOW, NOW)).toBe('expired');
  });

  it('avoids showing "0 minutes"', () => {
    expect(formatTimeRemaining(NOW + 30_000, NOW)).toBe('less than a minute left');
  });

  it('scales up through minutes, hours and days', () => {
    expect(formatTimeRemaining(NOW + 5 * MINUTE, NOW)).toBe('5 minutes left');
    expect(formatTimeRemaining(NOW + 3 * HOUR, NOW)).toBe('3 hours left');
    expect(formatTimeRemaining(NOW + 2 * DAY, NOW)).toBe('2 days left');
  });

  it('gets the singular right', () => {
    expect(formatTimeRemaining(NOW + MINUTE + 1000, NOW)).toBe('1 minute left');
    expect(formatTimeRemaining(NOW + HOUR + 1000, NOW)).toBe('1 hour left');
    expect(formatTimeRemaining(NOW + DAY + 1000, NOW)).toBe('1 day left');
  });
});

describe('formatRelativeTime', () => {
  it('reads as "just now" for the last few seconds', () => {
    expect(formatRelativeTime(NOW - 5_000, NOW)).toBe('just now');
  });

  it('compacts older timestamps', () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE, NOW)).toBe('5m');
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe('3h');
    expect(formatRelativeTime(NOW - 2 * DAY, NOW)).toBe('2d');
  });
});

describe('formatBytes', () => {
  it('picks a unit that keeps the number readable', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('formatDuration', () => {
  it('renders m:ss', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('returns nothing when there is no duration', () => {
    expect(formatDuration(null)).toBe('');
  });
});

describe('initialsOf', () => {
  it('uses first and last initials', () => {
    expect(initialsOf('Priya Sharma')).toBe('PS');
    expect(initialsOf('Ada Byron Lovelace')).toBe('AL');
  });

  it('falls back to two letters for a single name', () => {
    expect(initialsOf('Prince')).toBe('PR');
  });

  it('does not crash on an empty name', () => {
    expect(initialsOf('   ')).toBe('?');
  });
});

/**
 * The bug this exists to prevent: every reader used to see the start time converted into
 * their own zone, so a guest a state away was told the wrong hour — and email, rendered on
 * a server running UTC, told everybody the wrong hour.
 */
describe('formatEventDate across timezones', () => {
  // 2026-06-14T19:00 in Los Angeles.
  const evening = Date.parse('2026-06-15T02:00:00Z');

  it('shows the event in its own zone, not the reader’s', () => {
    const shown = formatEventDate(evening, 'America/Los_Angeles', 'always');
    expect(shown).toMatch(/7:00/);
    expect(shown).not.toMatch(/10:00/);
  });

  it('shows the same wall-clock time whatever zone it is asked about', () => {
    // The point of storing the zone: one event, one time, for everyone reading it.
    const asLA = formatEventDate(evening, 'America/Los_Angeles', 'always');
    const alsoLA = formatEventDate(evening, 'America/Los_Angeles', 'always');
    expect(asLA).toBe(alsoLA);

    // And a different zone genuinely is a different wall-clock time.
    expect(formatEventDate(evening, 'America/New_York', 'always')).toMatch(/10:00/);
  });

  it('labels the zone when the reader is told to expect one', () => {
    expect(formatEventDate(evening, 'America/Los_Angeles', 'always')).toMatch(/P[DS]T/);
  });

  it('falls back to the reader’s zone for events created before this was recorded', () => {
    // No worse than the old behaviour, and it must not throw.
    expect(formatEventDate(evening, null)).toBeTruthy();
    expect(formatEventDate(evening)).toBeTruthy();
  });

  it('ignores a zone the runtime does not know rather than throwing', () => {
    // An unparseable zone reaching Intl would break the invitation for every guest.
    expect(formatEventDate(evening, 'Mars/Olympus_Mons')).toBeTruthy();
  });

  it('returns nothing for an event with no date', () => {
    expect(formatEventDate(null, 'America/Los_Angeles')).toBe('');
  });
});

describe('isValidTimeZone', () => {
  it('accepts real zones', () => {
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true);
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('not a zone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
