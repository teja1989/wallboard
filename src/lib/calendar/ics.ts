import { appConfig, calendarConfig, icsTimestamp } from '@/config';
import type { EventDoc } from '@/types/domain';

/**
 * The `.ics` file.
 *
 * Deliberately free of `server-only`: the same bytes are built in the browser for the button
 * on the invitation and on the server for the link in an email, and one implementation is
 * the only way those two agree. It is also what makes the escaping and folding rules below
 * testable without a running app.
 *
 * **Times are written in UTC, never with a `TZID`.** The obvious thing — tagging the local
 * time with the event's zone — is only legal if the file also carries a `VTIMEZONE`
 * component spelling out that zone's daylight-saving rules, and a `TZID` without one is
 * rejected outright by Outlook and quietly misread by others. Hand-rolling `VTIMEZONE`
 * blocks means shipping a copy of the zone database that goes stale. A UTC instant needs
 * none of that: the calendar converts it to whatever zone the reader keeps, which lands on
 * the same moment as the event, which is the whole point. `startsAt` is already an absolute
 * epoch millisecond, so nothing is lost in the conversion.
 *
 * RFC 5545, if you need to check something: https://www.rfc-editor.org/rfc/rfc5545
 */

const CRLF = '\r\n';

/**
 * Escapes a TEXT value.
 *
 * Order matters: backslashes first, or the escapes added afterwards get escaped again. An
 * unescaped comma or semicolon in a title does not corrupt the title — it ends the property
 * and turns the rest of the line into a second value the client will not understand.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Folds a long line, per RFC 5545: split at 75 **octets** and continue with CRLF + a space.
 *
 * Octets, not characters, which is why this goes through the encoder rather than counting
 * `length`. An emoji in an event title is four bytes and one `String` index — measured as
 * characters, a line of them sails past the limit; split at a byte boundary in the middle of
 * one, the file is invalid UTF-8. Continuation lines carry a leading space that counts
 * toward their own 75, hence the smaller limit after the first.
 */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const decoder = new TextDecoder();
  const parts: string[] = [];
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Back off any UTF-8 continuation byte (10xxxxxx) so a multi-byte character stays whole.
    while (end > start && end < bytes.length && ((bytes[end] as number) & 0xc0) === 0x80) {
      end -= 1;
    }
    parts.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74;
  }

  return parts.join(`${CRLF} `);
}

/** The event's address as one line, or empty when the host never said where. */
function locationLine(event: EventDoc): string {
  if (!event.location) return '';
  return [event.location.name, event.location.address].filter(Boolean).join(', ');
}

/**
 * What the calendar entry says when you open it.
 *
 * The link is last and on its own line because that is where calendar clients look when they
 * decide what to turn into a tappable link — and on the day, that link is how a guest gets
 * back to the invitation to check the dress code or find the address again.
 */
function describe(event: EventDoc, url: string | null): string {
  return [
    event.hostedBy ? `Hosted by ${event.hostedBy}` : '',
    event.description,
    event.dressCode ? `Dress code: ${event.dressCode}` : '',
    url,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export interface IcsOptions {
  /** Where the guest goes to see the invitation again. */
  url?: string | null;
  /** Injectable so a test can assert on DTSTAMP. */
  now?: number;
}

/**
 * When the entry ends.
 *
 * Exported because the Google Calendar link needs the same answer, and two functions
 * guessing separately is how a `.ics` and a Google entry end up an hour apart.
 */
export function calendarEnd(event: Pick<EventDoc, 'startsAt' | 'endsAt'>): number | null {
  if (event.startsAt === null) return null;
  // A stored end before the start is corrupt rather than instructive; fall back to the
  // default duration instead of emitting an entry that ends before it begins.
  if (event.endsAt !== null && event.endsAt > event.startsAt) return event.endsAt;
  return event.startsAt + calendarConfig.defaultDurationMs;
}

/**
 * One event as an iCalendar file, or null when there is no date to add.
 *
 * A save-the-date with no time yet is a real and common state, and the honest response is no
 * button rather than an entry at an invented hour.
 */
export function buildIcs(event: EventDoc, options: IcsOptions = {}): string | null {
  const endsAt = calendarEnd(event);
  if (event.startsAt === null || endsAt === null) return null;

  const now = options.now ?? Date.now();
  const url = options.url ?? null;
  const where = locationLine(event);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${calendarConfig.prodId}`,
    'CALSCALE:GREGORIAN',
    // PUBLISH, not REQUEST: this is an invitation to add, not a meeting request that would
    // have the guest's calendar mail an RSVP back to an address we do not run.
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Stable per event and globally unique, so re-downloading after the host moves the venue
    // updates the entry the guest already has instead of leaving two on the same evening.
    // Hostname without the port: in development the port moves, and a UID that moves with it
    // would leave a trail of duplicate entries behind every test.
    `UID:${event.id}@${new URL(appConfig.siteUrl).hostname}`,
    `DTSTAMP:${icsTimestamp(now)}`,
    `DTSTART:${icsTimestamp(event.startsAt)}`,
    `DTEND:${icsTimestamp(endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    // Ended events are emitted as cancelled rather than withheld: a guest who already added
    // it needs their copy struck through, and silence cannot do that.
    `STATUS:${event.status === 'ended' ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
  ];

  const description = describe(event, url);
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (where) lines.push(`LOCATION:${escapeText(where)}`);
  if (url) lines.push(`URL:${url}`);

  /*
    No `ORGANIZER`. The property takes a mail address, and naming one turns the entry into
    something a guest's calendar may try to reply to — either bouncing off an address we do
    not run, or leaking the host's own into every guest's calendar. `METHOD:PUBLISH` does not
    require it, and who the invitation is from is said in the description instead.
  */

  // Coordinates when we have them, so a phone can offer directions from the entry itself
  // without re-geocoding an address string.
  if (typeof event.location?.lat === 'number' && typeof event.location?.lng === 'number') {
    lines.push(`GEO:${event.location.lat};${event.location.lng}`);
  }

  for (const trigger of calendarConfig.alarms) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.title)}`,
      `TRIGGER:${trigger}`,
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  // CRLF between every line and a trailing one: the spec requires it, and the clients that
  // tolerate bare newlines are not the ones you find out about.
  return `${lines.map(fold).join(CRLF)}${CRLF}`;
}
