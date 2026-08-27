import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** "3 days left", "12 minutes left", "expired". Coarse on purpose — this is a chip, not a clock. */
export function formatTimeRemaining(expiresAt: number, now = Date.now()): string {
  const ms = expiresAt - now;
  if (ms <= 0) return 'expired';

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'less than a minute left';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} left`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} left`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} left`;
}

/** "just now", "4m", "2h", "3d" — compact enough to sit beside a name. */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

/**
 * Whether a string is an IANA zone this runtime knows.
 *
 * Asking the formatter is the only reliable check — the list differs by runtime and ships
 * with the ICU data, so a hardcoded set would drift.
 */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * "Saturday 14 June, 7:00 pm". Weekday included because an invitation is read days ahead
 * and the day of the week is what people actually plan around.
 *
 * **Rendered in the event's own timezone, not the reader's.** A party at 7pm in California
 * is at 7pm for everybody reading about it; showing a guest in New York "10:00 pm" because
 * that is what their laptop thinks is how people miss things. Events created before the
 * zone was recorded pass null and fall back to the reader's zone, which is the old
 * behaviour and no worse than it was.
 *
 * `showZone` decides whether the abbreviation is appended:
 *  - `auto` compares against the rendering environment and only adds it when they differ,
 *    which is right in the app — a local guest does not need to be told their own zone.
 *  - `always` is for email and link previews, where we have no idea who is reading and an
 *    unlabelled time is a guess.
 */
export function formatEventDate(
  timestamp: number | null,
  timeZone?: string | null,
  showZone: 'auto' | 'always' = 'auto',
): string {
  if (timestamp === null) return '';

  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : undefined;
  const here = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  const label = zone !== undefined && (showZone === 'always' || zone !== here);

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    ...(zone ? { timeZone: zone } : {}),
    ...(label ? { timeZoneName: 'short' as const } : {}),
  }).format(new Date(timestamp));
}

/** Date only, for a deadline where the time of day is noise. */
export function formatDateOnly(timestamp: number | null, timeZone?: string | null): string {
  if (timestamp === null) return '';
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : undefined;
  return new Intl.DateTimeFormat(undefined, {
    ...(zone ? { timeZone: zone } : {}),
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp));
}

/** "in 3 days", "tomorrow", "today", "last Tuesday" — for the countdown to the event. */
export function formatCountdownToEvent(startsAt: number | null, now = Date.now()): string {
  if (startsAt === null) return '';
  const days = Math.round((startOfDay(startsAt) - startOfDay(now)) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Value for a datetime-local input, in the viewer's own timezone. */
export function toDateTimeLocalValue(timestamp: number | null): string {
  if (timestamp === null) return '';
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return '';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/** Deterministic initials for the avatar fallback. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}
