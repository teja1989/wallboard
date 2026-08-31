'use client';
import { CalendarDays, Clock, MapPin, Shirt } from 'lucide-react';
import {
  appConfig,
  brand,
  directionsUrl,
  occasionById,
  placesConfig,
  templateById,
} from '@/config';
import { showsAttribution } from '@/lib/billing/entitlements';
import { AddToCalendar } from '@/components/event/add-to-calendar';
import { invitationLayouts } from '@/components/event/layouts';
import { formatCountdownToEvent, formatEventDate } from '@/lib/utils';
import type { EventDoc } from '@/types/domain';

/**
 * The invitation.
 *
 * This component owns *what* an invitation says; the layout owns how it is arranged. That
 * split is what lets a host change template — and therefore layout, type and palette — with
 * nothing about their event needing to change, and it keeps the detail rows from being
 * reimplemented four times with four sets of bugs.
 *
 * Fields the host left blank simply do not appear. An invitation with three lines should
 * look deliberate, not unfinished.
 */
export function Invitation({
  event,
  titleAs,
}: {
  event: EventDoc;
  /**
   * `h2` wherever this card is a *sample* rather than the page's subject — the landing-page
   * showcase, a gallery preview. See `InvitationLayoutProps.titleAs`. Defaults to `h1`, so a
   * real invitation page needs to say nothing.
   */
  titleAs?: 'h1' | 'h2';
}) {
  const occasion = occasionById(event.occasion);
  const template = templateById(event.templateId);
  const Layout = invitationLayouts[template.layout];
  const showBranding = showsAttribution(event.plan);

  const details = (
    <dl className="space-y-3">
      {event.startsAt !== null && (
        <Detail icon={<CalendarDays className="size-4" aria-hidden />} label="When">
          <span>{formatEventDate(event.startsAt, event.timeZone)}</span>
          <span className="ml-2 opacity-70">({formatCountdownToEvent(event.startsAt)})</span>
          {event.endsAt !== null && (
            <span className="mt-0.5 block opacity-70">
              until {formatEventDate(event.endsAt, event.timeZone)}
            </span>
          )}
          {/*
            Directly under the date, because that is the moment someone decides whether they
            can make it — and the moment they decide is the only moment they will save it.
          */}
          <AddToCalendar event={event} />
        </Detail>
      )}

      {event.location && (
        <Detail icon={<MapPin className="size-4" aria-hidden />} label="Where">
          {event.location.name && <span className="block">{event.location.name}</span>}
          {event.location.address && (
            <span className="block opacity-80">{event.location.address}</span>
          )}
          {/*
            One tap to navigate, built from the place id when there is one so it opens the
            actual venue rather than a text search that might find a different branch of the
            same name. Falls back to whatever link the host pasted.
          */}
          {(event.location.address || event.location.url) && (
            <a
              href={
                event.location.address
                  ? directionsUrl(
                      [event.location.name, event.location.address].filter(Boolean).join(', '),
                      event.location.placeId ?? null,
                    )
                  : (event.location.url as string)
              }
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block underline underline-offset-2"
              style={{ color: 'inherit' }}
            >
              Get directions
            </a>
          )}

          {/*
            Drawn through our own route, because a static map URL carries the API key and an
            invitation is a public link. Absent when the host typed an address rather than
            picking one — most events happen somewhere unfindable, and no map is better than
            a map of the wrong street.
          */}
          {typeof event.location.lat === 'number' && typeof event.location.lng === 'number' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/places/map?lat=${event.location.lat}&lng=${event.location.lng}`}
              alt=""
              loading="lazy"
              width={placesConfig.map.width}
              height={placesConfig.map.height}
              className="mt-3 block w-full rounded-[var(--radius-card)] border border-black/5 object-cover"
              style={{ aspectRatio: `${placesConfig.map.width} / ${placesConfig.map.height}` }}
            />
          )}
        </Detail>
      )}

      {event.dressCode && (
        <Detail icon={<Shirt className="size-4" aria-hidden />} label="Dress code">
          {event.dressCode}
        </Detail>
      )}

      {event.startsAt === null && (
        <Detail icon={<Clock className="size-4" aria-hidden />} label="When">
          <span className="opacity-70">{event.hostedBy} has not set a date yet.</span>
        </Detail>
      )}
    </dl>
  );

  /*
    A link, not a line of text.

    The mark is the whole growth loop: this invitation is in front of ten to two hundred
    people who demonstrably attend events, and a few of them will host something themselves.
    As static text it asked every one of them to remember a name and go and type it into a
    search engine later, which is not a conversion path — it is a footnote.

    Opens in the same tab: a guest reading an invitation is not mid-task the way somebody
    typing a join code is, and stealing a tab from them is worse than losing the click.
  */
  const attribution = showBranding ? (
    <a
      href={appConfig.siteUrl}
      className="mt-7 inline-block text-xs underline-offset-4 opacity-60 transition-opacity hover:underline hover:opacity-100"
    >
      {brand.attribution}
    </a>
  ) : null;

  return (
    <Layout
      event={event}
      template={template}
      occasion={occasion}
      details={details}
      attribution={attribution}
      titleAs={titleAs}
    />
  );
}

/**
 * A detail row. Colours are inherited rather than set, so the same markup reads correctly
 * on the app's surfaces and reversed out of a poster gradient.
 */
function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      {/* No tinted disc behind the icon: opacity on the wrapper would fade the glyph with
          it, and a fixed background cannot sit on both a light card and a poster gradient. */}
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center opacity-60">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium tracking-wide uppercase opacity-60">{label}</dt>
        <dd className="mt-0.5 text-[15px] leading-relaxed">{children}</dd>
      </div>
    </div>
  );
}
