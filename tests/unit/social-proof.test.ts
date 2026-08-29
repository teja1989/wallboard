import { describe, expect, it } from 'vitest';
import { formatSocialProofCaption } from '@/components/event/social-proof';

describe('formatSocialProofCaption', () => {
  it('returns empty string when count is zero', () => {
    expect(formatSocialProofCaption([], 0)).toBe('');
  });

  it('formats single attendee correctly', () => {
    expect(formatSocialProofCaption([{ displayName: 'Priya', photoUrl: null }], 1)).toBe(
      'Priya is attending',
    );
    expect(formatSocialProofCaption([], 1)).toBe('1 person is attending');
  });

  it('formats two attendees correctly', () => {
    expect(
      formatSocialProofCaption(
        [
          { displayName: 'Priya', photoUrl: null },
          { displayName: 'Sam', photoUrl: null },
        ],
        2,
      ),
    ).toBe('Priya and Sam are attending');

    expect(formatSocialProofCaption([{ displayName: 'Priya', photoUrl: null }], 2)).toBe(
      'Priya and 1 other are attending',
    );

    expect(formatSocialProofCaption([], 2)).toBe('2 people are attending');
  });

  it('formats 3 or more attendees correctly with pluralization', () => {
    const attendees = [
      { displayName: 'Priya', photoUrl: null },
      { displayName: 'Sam', photoUrl: null },
      { displayName: 'Alex', photoUrl: null },
    ];

    // 3 total: 2 named + 1 other
    expect(formatSocialProofCaption(attendees, 3)).toBe('Priya, Sam, and 1 other are attending');

    // 15 total: 2 named + 13 others
    expect(formatSocialProofCaption(attendees, 15)).toBe('Priya, Sam, and 13 others are attending');

    // Only 1 name known, 5 total
    expect(formatSocialProofCaption([{ displayName: 'Priya', photoUrl: null }], 5)).toBe(
      'Priya and 4 others are attending',
    );

    // No names known, 10 total
    expect(formatSocialProofCaption([], 10)).toBe('10 people are attending');
  });
});
