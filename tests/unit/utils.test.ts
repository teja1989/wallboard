import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE } from '@/config';
import {
  formatBytes,
  formatDuration,
  formatRelativeTime,
  formatTimeRemaining,
  initialsOf,
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
