import { brand } from './branding.config';

/**
 * Add to calendar.
 *
 * An invitation that is read once and closed is an invitation that gets forgotten. The
 * calendar entry is what survives the week between reading and attending, and it brings its
 * own reminders — which is the cheapest attendance lift in the product, because the guest's
 * phone does the nagging instead of us paying for another message.
 *
 * Two delivery paths, one file. In the app the browser builds it from the event it already
 * has; in email a link points at a route that serves the identical bytes, because a mail
 * client cannot run our JavaScript. Both call `buildIcs` — a second implementation is a
 * second set of escaping bugs.
 */

export const calendarConfig = {
  /**
   * Identifies what wrote the file. The `-//…//EN` shape is required by RFC 5545; some
   * clients log it, and one that looks malformed is a thing to be suspicious of.
   */
  prodId: `-//${brand.name}//Invitation//EN`,

  /**
   * How long an event runs when the host never said when it ends.
   *
   * Something has to be assumed: an entry with no end is either rejected or silently made
   * all-day, and an all-day block over a 7pm party is worse than a wrong-ish duration. Three
   * hours is about the length of the events this product is for.
   */
  defaultDurationMs: 3 * 60 * 60 * 1000,

  /**
   * Reminders, as RFC 5545 durations relative to the start.
   *
   * Written as duration literals rather than a count of minutes we convert: the conversion
   * is the part that goes wrong silently, and a reminder that fires at the wrong time is
   * indistinguishable from one that never fires.
   *
   * The day before is when someone can still rearrange their evening; two hours before is
   * when they need to leave. Both, because either alone misses one of those.
   */
  alarms: ['-P1D', '-PT2H'] as const,

  /** Cache for a short while only — the host can move the venue an hour before the party. */
  cacheSeconds: 300,
} as const;

/** `Ada's 40th` -> `adas-40th.ics`. Falls back rather than producing a bare extension. */
export function calendarFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'invitation'}.ics`;
}

/** `20260614T190000Z`. The only timestamp format in this file — see `buildIcs` for why. */
export function icsTimestamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Google Calendar's web composer, prefilled.
 *
 * Alongside the `.ics` rather than instead of it. Google is where most people on a desktop
 * keep their calendar, and importing a downloaded file into Google's web UI is a five-step
 * detour; conversely this link is useless to anyone on Apple Calendar or Outlook. Neither
 * covers everyone, so both are offered.
 *
 * Times are UTC, so the entry lands correctly whatever zone the reader's Google account is
 * set to.
 */
export function googleCalendarUrl(input: {
  title: string;
  details: string;
  location: string;
  startsAt: number;
  endsAt: number;
}): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${icsTimestamp(input.startsAt)}/${icsTimestamp(input.endsAt)}`,
  });
  if (input.details) params.set('details', input.details);
  if (input.location) params.set('location', input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Copy. Every string a guest reads lives here. */
export const calendarCopy = {
  download: 'Add to calendar',
  google: 'Google Calendar',
  /**
   * A tooltip, not an `aria-label`.
   *
   * An `aria-label` replaces the accessible name outright, so labelling the button with a
   * longer sentence would leave a screen-reader user hearing something that does not contain
   * the words on the button — the thing WCAG's "Label in Name" exists to prevent, and it
   * breaks voice control, where people say what they can see.
   */
  downloadHint: 'Works with Apple Calendar, Outlook and most calendar apps',
  /** In email, where a button is the whole affordance. */
  emailLabel: 'Add to calendar',
} as const;
