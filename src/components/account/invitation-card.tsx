'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  Eye,
  MessageSquare,
  Sparkles,
  Trash2,
  Tv,
  Users,
} from 'lucide-react';
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

export function InvitationCard({
  event,
  onDeleted,
}: {
  event: HostedEventSummary;
  onDeleted: (eventId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const canArchive = entitlementsFor(event.plan ?? 'free').archiveDownload;
  const occ = occasionById(event.occasion);
  const isLive = event.status === 'live';

  return (
    <div className="card overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-sm transition-all hover:border-[var(--border-strong)] hover:shadow-md">
      {/* Event Header & Link */}
      <div className="space-y-3 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-base shadow-xs">
              {occ.glyph}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-[var(--text-primary)] sm:text-lg">
                {event.title}
              </h2>
              <p className="truncate text-xs font-medium text-[var(--text-muted)]">
                {occ.label}
                {event.startsAt ? ` · ${formatEventDate(event.startsAt, event.timeZone)}` : ''}
              </p>
            </div>
          </div>

          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold tracking-wider uppercase',
              isLive
                ? 'animate-pulse border border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
            )}
          >
            {isLive ? '🟢 Live Now' : event.status}
          </span>
        </div>

        {/* Quick Metrics */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-semibold text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-sunken)] px-3 py-1">
            <Users className="size-3.5 text-[var(--accent)]" />
            {event.rsvpTally?.attending ?? 0} Confirmed Guests
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-sunken)] px-3 py-1">
            <MessageSquare className="size-3.5 text-purple-500" />
            {event.postCount} Photos & Toasts
          </span>
        </div>
      </div>

      {/* Action Bar */}
      {confirming ? (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)]/40 p-4">
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)]/50 px-4 py-2.5">
          {/* Main Direct Navigation Shortcuts */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/e/${event.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-bold text-[var(--text-primary)] shadow-xs transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Eye className="size-3.5" />
              <span>Invitation</span>
            </Link>

            <Link
              href={`/e/${event.id}?tab=guests`}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-bold text-[var(--text-primary)] shadow-xs transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Users className="size-3.5" />
              <span>Guests & WhatsApp</span>
            </Link>

            <Link
              href={`/e/${event.id}?tab=wall`}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-bold text-[var(--text-primary)] shadow-xs transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Tv className="size-3.5" />
              <span>Live Wall</span>
            </Link>
          </div>

          {/* Secondary Actions: Download & Delete */}
          <div className="flex items-center gap-1">
            {canArchive && (
              <a
                href={`/api/events/${event.id}/archive`}
                title="Download full event photos & guestbook archive"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              >
                <Download className="size-3.5" />
                <span>Archive</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setConfirming(true)}
              title="Delete event"
              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
