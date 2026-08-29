import { describe, expect, it } from 'vitest';
import { rsvpCopy } from '@/config';
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

/**
 * The caption the *confirmation panel* uses is not this one.
 *
 * `formatSocialProofCaption` names attendees, which is right on an invitation somebody has not
 * answered yet. Right after they reply it is wrong: with one attendee it reads their own name
 * back at them. `rsvpCopy.othersComing` counts other people and is phrased so it cannot, which
 * is why `SocialProof` takes a caption override and `rsvp-confirmed.tsx` passes that one.
 *
 * These pin the distinction, because the regression was silent — the facepile shipped, the
 * caption changed underneath it, and only an e2e assertion noticed.
 */
describe('the two captions are different on purpose', () => {
  it('counts others rather than naming them, and never says "1 person"', () => {
    expect(rsvpCopy.othersComing(1)).toBe('1 other person is coming');
    expect(rsvpCopy.othersComing(3)).toBe('3 others are coming');

    for (const others of [1, 2, 5, 40]) {
      expect(rsvpCopy.othersComing(others)).toContain('other');
    }
  });

  it('has a first-replier line, so nobody is told that nobody is coming', () => {
    expect(rsvpCopy.firstToReply.length).toBeGreaterThan(0);
    expect(rsvpCopy.firstToReply.toLowerCase()).not.toContain('0 ');
  });
});
