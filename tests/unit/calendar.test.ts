import { describe, expect, it } from 'vitest';
import { calendarConfig, calendarFilename, googleCalendarUrl, icsTimestamp } from '@/config';
import { buildIcs, calendarEnd } from '@/lib/calendar/ics';
import type { EventDoc } from '@/types/domain';

/**
 * The calendar file.
 *
 * Worth testing thoroughly for an unusual reason: nothing here fails loudly. A malformed
 * `.ics` is not a stack trace, it is a guest tapping a button and their calendar shrugging —
 * on their phone, days later, where nobody will ever tell us. The escaping and folding rules
 * are the parts that break on real data (an apostrophe, a comma in an address, an emoji in a
 * title) and they are exactly the parts a smoke test cannot see.
 */

// 14 June 2026, 19:00 in California — a time deliberately on the other side of UTC midnight,
// so a timezone mistake shows up as the wrong *day* rather than a subtle hour.
const STARTS_AT = Date.parse('2026-06-15T02:00:00.000Z');
const NOW = Date.parse('2026-06-01T09:00:00.000Z');

function event(overrides: Partial<EventDoc> = {}): EventDoc {
  return {
    id: 'evt_abc123',
    title: 'Ada & Grace',
    description: 'Drinks on the roof.',
    occasion: 'party',
    hostUid: 'uid_host',
    hostName: 'Ada',
    hostedBy: 'Ada & Grace',
    templateId: 'sunset',
    status: 'live',
    startsAt: STARTS_AT,
    endsAt: null,
    timeZone: 'America/Los_Angeles',
    location: { name: 'The Fillmore', address: '1805 Geary Blvd', url: null },
    dressCode: '',
    rsvp: {
      enabled: true,
      deadline: null,
      allowPlusOnes: true,
      maxPartySize: 4,
      askNote: false,
      question: null,
    },
    rsvpTally: { yes: 0, no: 0, maybe: 0, pending: 0, attending: 0 },
    settings: { whoCanPost: 'members', allowedKinds: ['text'] },
    plan: 'free',
    createdAt: NOW,
    expiresAt: NOW + 30 * 24 * 60 * 60 * 1000,
    endedAt: null,
    memberCount: 1,
    postCount: 0,
    storageBytes: 0,
    ...overrides,
  } as EventDoc;
}

/** Unfolds continuation lines so an assertion can look at a property as one string. */
function properties(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
}

describe('buildIcs', () => {
  it('produces a file a calendar will accept', () => {
    const lines = properties(buildIcs(event(), { now: NOW }) as string);

    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines).toContain('END:VEVENT');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
  });

  it('ends every line with CRLF, including the last', () => {
    // Bare newlines are tolerated by the clients you have, and not by the ones you do not.
    const ics = buildIcs(event(), { now: NOW }) as string;
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('writes the instant in UTC, so it lands at 7pm for a guest in any timezone', () => {
    // The regression that matters: a guest in New York must get the same *moment*, not 7pm
    // their time and not the wrong day.
    const lines = properties(buildIcs(event(), { now: NOW }) as string);
    expect(lines).toContain('DTSTART:20260615T020000Z');
    // A TZID without an accompanying VTIMEZONE block is what Outlook rejects outright.
    expect(lines.join('\n')).not.toContain('TZID');
  });

  it('gives an event with no stated end a sensible duration', () => {
    const lines = properties(buildIcs(event(), { now: NOW }) as string);
    expect(lines).toContain(`DTEND:${icsTimestamp(STARTS_AT + calendarConfig.defaultDurationMs)}`);
  });

  it('uses the stated end when there is one', () => {
    const endsAt = STARTS_AT + 5 * 60 * 60 * 1000;
    const lines = properties(buildIcs(event({ endsAt }), { now: NOW }) as string);
    expect(lines).toContain(`DTEND:${icsTimestamp(endsAt)}`);
  });

  it('ignores an end that is before the start rather than emitting a negative event', () => {
    const endsAt = STARTS_AT - 60_000;
    expect(calendarEnd({ startsAt: STARTS_AT, endsAt })).toBe(
      STARTS_AT + calendarConfig.defaultDurationMs,
    );
  });

  it('has nothing to offer a save-the-date with no time yet', () => {
    expect(buildIcs(event({ startsAt: null }), { now: NOW })).toBeNull();
  });

  it('keeps the same UID so a re-download updates the entry instead of duplicating it', () => {
    const first = properties(buildIcs(event(), { now: NOW }) as string);
    const later = properties(
      buildIcs(event({ title: 'Moved!' }), { now: NOW + 86_400_000 }) as string,
    );
    const uid = (lines: string[]) => lines.find((line) => line.startsWith('UID:'));
    expect(uid(first)).toBe(uid(later));
    expect(uid(first)).toContain('evt_abc123@');
  });

  it('marks an ended event cancelled, so a guest who already saved it sees it struck through', () => {
    const lines = properties(buildIcs(event({ status: 'ended' }), { now: NOW }) as string);
    expect(lines).toContain('STATUS:CANCELLED');
  });

  it('carries a reminder for each configured alarm', () => {
    const ics = buildIcs(event(), { now: NOW }) as string;
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(calendarConfig.alarms.length);
    for (const trigger of calendarConfig.alarms) {
      expect(properties(ics)).toContain(`TRIGGER:${trigger}`);
    }
  });

  it('never names an organizer, which would invite a reply to an address we do not run', () => {
    expect(buildIcs(event(), { now: NOW })).not.toContain('ORGANIZER');
  });

  it('says who it is from, in the description', () => {
    const lines = properties(buildIcs(event(), { now: NOW }) as string);
    expect(lines.find((line) => line.startsWith('DESCRIPTION:'))).toContain(
      'Hosted by Ada & Grace',
    );
  });

  it('includes coordinates when the host picked a real place', () => {
    const located = event({
      location: {
        name: 'The Fillmore',
        address: '1805 Geary Blvd',
        url: null,
        placeId: 'ChIJabc',
        lat: 37.784,
        lng: -122.433,
      },
    });
    expect(properties(buildIcs(located, { now: NOW }) as string)).toContain('GEO:37.784;-122.433');
  });

  it('omits coordinates for an address somebody typed', () => {
    expect(buildIcs(event(), { now: NOW })).not.toContain('GEO:');
  });
});

describe('escaping', () => {
  it('escapes the commas and semicolons that would otherwise end the property early', () => {
    const ics = buildIcs(
      event({
        title: 'Drinks, dinner; dancing',
        location: { name: 'Ada, Grace & Co', address: '', url: null },
      }),
      { now: NOW },
    ) as string;
    const lines = properties(ics);

    expect(lines).toContain('SUMMARY:Drinks\\, dinner\\; dancing');
    expect(lines).toContain('LOCATION:Ada\\, Grace & Co');
  });

  it('escapes a backslash without eating the escapes added after it', () => {
    const lines = properties(buildIcs(event({ title: 'A\\B' }), { now: NOW }) as string);
    expect(lines).toContain('SUMMARY:A\\\\B');
  });

  it('turns a newline in the description into the escape sequence, not an actual break', () => {
    // An unescaped newline here ends the property and makes everything after it garbage.
    const ics = buildIcs(event({ description: 'One\nTwo' }), { now: NOW }) as string;
    const description = properties(ics).find((line) => line.startsWith('DESCRIPTION:')) as string;
    expect(description).toContain('One\\nTwo');
  });
});

describe('line folding', () => {
  it('folds a long line and unfolds back to exactly what went in', () => {
    const title = 'A very long celebration of something '.repeat(6).trim();
    const ics = buildIcs(event({ title }), { now: NOW }) as string;

    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(properties(ics)).toContain(`SUMMARY:${title}`);
  });

  it('never splits a multi-byte character in half', () => {
    // An emoji is one string index and four octets; folding by index corrupts the file.
    const title = `${'🎉'.repeat(40)}`;
    const ics = buildIcs(event({ title }), { now: NOW }) as string;

    expect(ics).not.toContain('�');
    expect(properties(ics)).toContain(`SUMMARY:${title}`);
  });
});

describe('calendarFilename', () => {
  it('makes a title into something a filesystem will take', () => {
    expect(calendarFilename("Ada & Grace's 40th!")).toBe('ada-grace-s-40th.ics');
  });

  it('falls back rather than producing a bare extension', () => {
    expect(calendarFilename('🎉🎉')).toBe('invitation.ics');
  });
});

describe('googleCalendarUrl', () => {
  it('agrees with the .ics about when the event is', () => {
    const endsAt = calendarEnd(event()) as number;
    const url = googleCalendarUrl({
      title: 'Ada & Grace',
      details: '',
      location: '',
      startsAt: STARTS_AT,
      endsAt,
    });
    expect(url).toContain(`dates=${icsTimestamp(STARTS_AT)}%2F${icsTimestamp(endsAt)}`);
    expect(url).toContain('action=TEMPLATE');
  });
});
