import { NextResponse } from 'next/server';
import { appConfig, calendarConfig, calendarFilename } from '@/config';
import { buildIcs } from '@/lib/calendar/ics';
import { invitationPath } from '@/lib/codes-format';
import { findEventByCode } from '@/lib/services/events';
import { ApiError, limitByIp, route } from '@/lib/server/api';
import { joinCodeSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

/**
 * The calendar file, for readers who cannot run our JavaScript.
 *
 * The button on the invitation builds this in the browser, which is right there and free.
 * Email cannot: a message is HTML in someone else's client, so the "Add to calendar" line in
 * an invitation has to be an ordinary link to an ordinary URL. Same bytes, same builder.
 *
 * Sits beside the invitation page rather than under `/api`, keyed on the same join code,
 * because it is the same thing seen a different way: the code is the credential everywhere
 * else in this product, and the recipient is not a member yet — they have not opened the
 * invitation, which is exactly why they are being sent one. Deliberately unauthenticated for
 * the same reason, and it reveals nothing the invitation page does not already show to
 * anyone holding the same code: title, date, address.
 *
 * Ended events 404 here, matching what `/i/{code}` does, so the code stops being useful at
 * the same moment through both doors.
 */
export const GET = route(async (request, { params }: Params) => {
  const { code } = await params;
  const parsed = joinCodeSchema.parse(code);

  await limitByIp(request, 'calendarPerIp');

  const event = await findEventByCode(parsed);
  if (!event || event.status === 'ended') {
    throw new ApiError('not_found', 'That invitation is no longer available.');
  }

  const ics = buildIcs(event, {
    url: `${appConfig.siteUrl}${invitationPath(parsed)}`,
  });
  if (!ics) {
    throw new ApiError('not_found', 'This event does not have a date yet.');
  }

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // `attachment` so a browser hands it to the calendar app rather than rendering it as
      // text, which is what happens on iOS otherwise.
      'Content-Disposition': `attachment; filename="${calendarFilename(event.title)}"`,
      // Short: the host can move the venue an hour before the party, and a guest who taps
      // the link again should get the move rather than yesterday's copy.
      'Cache-Control': `public, max-age=${calendarConfig.cacheSeconds}`,
    },
  });
});
