'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Download, Trash2, Users } from 'lucide-react';
import { occasionById } from '@/config';
import { DeleteEventForm } from '@/components/event/delete-event-form';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { cn, formatEventDate } from '@/lib/utils';

export interface HostedEventSummary {
  id: string;
  title: string;
  occasion: string;
  startsAt: number | null;
  timeZone: string | null;
  createdAt: number;
  status: string;
  plan?: string;
  postCount: number;
  rsvpTally: { yes: number; no: number; maybe: number; pending: number; attending: number };
}

/**
 * One invitation in the account list.
 *
 * Keeping and deleting live here as well as inside the event, because this is where someone
 * goes when they are tidying up — and an event that has ended is exactly the one you want to
 * remove and the one you are least likely to open first. Previously the only delete in the
 * product was at the bottom of a scrolling drawer inside the event itself.
 *
 * The actions sit outside the link rather than inside it. A button nested in an anchor is
 * invalid markup and behaves differently in every browser, and "download" and "open" are not
 * a thing anyone wants to choose between by accident.
 */
export function InvitationCard({
  event,
  onDeleted,
}: {
  event: HostedEventSummary;
  onDeleted: (eventId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const canArchive = entitlementsFor(event.plan ?? 'free').archiveDownload;

  return (
    <div className="card overflow-hidden">
      <Link
        href={`/e/${event.id}`}
        className="block p-5 transition-colors hover:bg-[var(--accent-soft)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-medium">{event.title}</h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {occasionById(event.occasion).label}
              {event.startsAt ? ` · ${formatEventDate(event.startsAt, event.timeZone)}` : ''}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium',
              event.status === 'live'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
            )}
          >
            {event.status}
          </span>
        </div>
        <div className="mt-3 flex gap-4 text-sm text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden />
            {event.rsvpTally?.attending ?? 0} coming
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />
            {event.postCount} on the wall
          </span>
        </div>
      </Link>

      {confirming ? (
        <div className="border-t border-[var(--border-subtle)] p-4">
          <DeleteEventForm
            eventId={event.id}
            title={event.title}
            onDeleted={() => {
              setConfirming(false);
              onDeleted(event.id);
            }}
            onCancel={() => setConfirming(false)}
          />
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1 border-t border-[var(--border-subtle)] px-3 py-2">
          {canArchive && (
            <a
              href={`/api/events/${event.id}/archive`}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
            >
              <Download className="size-3.5" aria-hidden />
              Download
            </a>
          )}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
