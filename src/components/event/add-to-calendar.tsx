'use client';
import { useState } from 'react';
import { CalendarPlus, Check } from 'lucide-react';
import { appConfig, calendarCopy, calendarFilename, googleCalendarUrl } from '@/config';
import { buildIcs, calendarEnd } from '@/lib/calendar/ics';
import type { EventDoc } from '@/types/domain';

/**
 * "Add to calendar."
 *
 * The single cheapest thing this product can do for attendance. An invitation is read once,
 * days ahead, and then closed; a calendar entry stays, and it brings reminders the guest's
 * own phone delivers for free — which beats paying for another round of messages to say the
 * same thing.
 *
 * The file is built here in the browser rather than fetched, because everything it needs is
 * already on this page. No round trip, no route to authorize, and it keeps working on a
 * flaky hall wifi on the day.
 *
 * Two buttons, not one, and not a menu. A `.ics` download is the only thing Apple Calendar
 * and Outlook accept, and importing one into Google's web calendar is a five-step detour —
 * so the Google link is not a nicety, it is the path for most people on a laptop. A menu
 * would hide one behind a click to save a few pixels.
 */
export function AddToCalendar({ event }: { event: EventDoc }) {
  const [downloaded, setDownloaded] = useState(false);

  const endsAt = calendarEnd(event);
  // A save-the-date with no time yet has nothing to add. No button is the honest answer.
  if (event.startsAt === null || endsAt === null) return null;

  const url = `${appConfig.siteUrl}/e/${event.id}`;

  function download() {
    const ics = buildIcs(event, { url });
    if (!ics) return;

    // A Blob rather than a `data:` URL: `data:` is size-capped in some browsers and blocked
    // outright as a top-level navigation in others, and this file carries the whole
    // description.
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = calendarFilename(event.title);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Revoked on a turn of the loop, not immediately: Safari reads the object after the
    // click returns, and revoking synchronously gives it an empty file.
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);

    setDownloaded(true);
  }

  const google = googleCalendarUrl({
    title: event.title,
    details: [event.description, url].filter(Boolean).join('\n\n'),
    location: event.location
      ? [event.location.name, event.location.address].filter(Boolean).join(', ')
      : '',
    startsAt: event.startsAt,
    endsAt,
  });

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
      <button
        type="button"
        onClick={download}
        title={calendarCopy.downloadHint}
        className="inline-flex items-center gap-1.5 underline underline-offset-2 opacity-80 transition-opacity hover:opacity-100"
        style={{ color: 'inherit' }}
      >
        {downloaded ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <CalendarPlus className="size-3.5" aria-hidden />
        )}
        {calendarCopy.download}
      </button>

      <a
        href={google}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 opacity-60 transition-opacity hover:opacity-100"
        style={{ color: 'inherit' }}
      >
        {calendarCopy.google}
      </a>
    </div>
  );
}
