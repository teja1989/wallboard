'use client';
import { CalendarDays, Clock, MapPin, Shirt } from 'lucide-react';
import { brand, occasionById, themeById } from '@/config';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { formatEventDate, formatCountdownToEvent } from '@/lib/utils';
import type { EventDoc } from '@/types/domain';

/**
 * The invitation itself.
 *
 * This is the first thing a guest sees and, for most of them, the only thing they will
 * look at properly — so it reads top to bottom as a card someone would be pleased to
 * receive, not as a settings summary. Fields the host left blank simply do not appear;
 * an invitation with three lines should look deliberate, not unfinished.
 */
export function Invitation({ event }: { event: EventDoc }) {
  const occasion = occasionById(event.occasion);
  const theme = themeById(event.themeId);
  const showBranding = !entitlementsFor(event.plan).removeBranding;

  return (
    <article className="card overflow-hidden">
      <div
        aria-hidden
        className="h-28 w-full"
        style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
      />

      <div className="px-6 pb-6">
        <span
          aria-hidden
          className="-mt-7 mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-[var(--surface-raised)] text-2xl shadow-[var(--shadow-soft)] ring-1 ring-[var(--border-subtle)]"
        >
          {occasion.glyph}
        </span>

        {/*
          "From" rather than "invites you to": a verb here has to agree with both "Priya"
          and "Priya & Sam", so it would be wrong half the time — and an invitation is the
          wrong word for a memorial notice regardless.
        */}
        <p className="text-sm font-medium tracking-wide text-[var(--text-muted)] uppercase">
          From {event.hostedBy}
        </p>

        <h1 className="mt-1 text-3xl leading-tight font-semibold tracking-tight text-balance">
          {event.title}
        </h1>

        {event.description && (
          <p className="mt-3 leading-relaxed text-pretty whitespace-pre-wrap text-[var(--text-secondary)]">
            {event.description}
          </p>
        )}

        <dl className="mt-6 space-y-3">
          {event.startsAt !== null && (
            <Detail icon={<CalendarDays className="size-4" aria-hidden />} label="When">
              <span>{formatEventDate(event.startsAt)}</span>
              <span className="ml-2 text-[var(--text-muted)]">
                ({formatCountdownToEvent(event.startsAt)})
              </span>
              {event.endsAt !== null && (
                <span className="mt-0.5 block text-[var(--text-muted)]">
                  until {formatEventDate(event.endsAt)}
                </span>
              )}
            </Detail>
          )}

          {event.location && (
            <Detail icon={<MapPin className="size-4" aria-hidden />} label="Where">
              {event.location.name && <span className="block">{event.location.name}</span>}
              {event.location.address && (
                <span className="block text-[var(--text-secondary)]">{event.location.address}</span>
              )}
              {event.location.url && (
                <a
                  href={event.location.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[var(--accent)] underline underline-offset-2"
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
              <span className="text-[var(--text-muted)]">
                {event.hostedBy} has not set a date yet.
              </span>
            </Detail>
          )}
        </dl>

        {showBranding && (
          <p className="mt-6 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-muted)]">
            {brand.attribution}
          </p>
        )}
      </div>
    </article>
  );
}

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
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase">
          {label}
        </dt>
        <dd className="mt-0.5 text-[15px] leading-relaxed">{children}</dd>
      </div>
    </div>
  );
}
