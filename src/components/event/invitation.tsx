'use client';
import { CalendarDays, Clock, MapPin, Shirt } from 'lucide-react';
import { brand, occasionById, templateById } from '@/config';
import { entitlementsFor } from '@/lib/billing/entitlements';
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
export function Invitation({ event }: { event: EventDoc }) {
  const occasion = occasionById(event.occasion);
  const template = templateById(event.templateId);
  const Layout = invitationLayouts[template.layout];
  const showBranding = !entitlementsFor(event.plan).removeBranding;

  const details = (
    <dl className="space-y-3">
      {event.startsAt !== null && (
        <Detail icon={<CalendarDays className="size-4" aria-hidden />} label="When">
          <span>{formatEventDate(event.startsAt)}</span>
          <span className="ml-2 opacity-70">({formatCountdownToEvent(event.startsAt)})</span>
          {event.endsAt !== null && (
            <span className="mt-0.5 block opacity-70">until {formatEventDate(event.endsAt)}</span>
          )}
        </Detail>
      )}

      {event.location && (
        <Detail icon={<MapPin className="size-4" aria-hidden />} label="Where">
          {event.location.name && <span className="block">{event.location.name}</span>}
          {event.location.address && (
            <span className="block opacity-80">{event.location.address}</span>
          )}
          {event.location.url && (
            <a
              href={event.location.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block underline underline-offset-2"
              style={{ color: 'inherit' }}
            >
              Open in maps
            </a>
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

  const attribution = showBranding ? (
    <p className="mt-7 text-xs opacity-60">{brand.attribution}</p>
  ) : null;

  return (
    <Layout
      event={event}
      template={template}
      occasion={occasion}
      details={details}
      attribution={attribution}
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
