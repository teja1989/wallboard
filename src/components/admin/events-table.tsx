'use client';
import Link from 'next/link';
import { adminCopy, adminLimits, shortId } from '@/config';
import { ConsoleList } from '@/components/admin/console-list';
import { formatBytes, formatRelativeTime } from '@/lib/utils';
import type { EventRow } from '@/lib/services/admin';

/**
 * Every event, newest first.
 *
 * The point of the screen is the link on each row. A platform role already carries
 * `event:view` and `post:deleteAny`, so opening an event here lands on its wall with the
 * remove control live — which is the actual takedown path, and was unreachable until this
 * list existed because nothing could turn a complaint into an event id.
 */
export function EventsTable() {
  return (
    <ConsoleList<EventRow>
      path="/api/admin/events"
      searchLabel={adminCopy.events.searchLabel}
      emptyLabel={adminCopy.events.empty}
      note={`${adminCopy.events.hint} An id matches exactly; text searches the most recent ${adminLimits.pageSize}.`}
      extract={(payload) => (payload as { events: EventRow[] }).events}
    >
      {(rows) => (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Host</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Guests</th>
                <th className="px-4 py-3 font-medium">Posts</th>
                <th className="px-4 py-3 font-medium">Storage</th>
                <th className="px-4 py-3 font-medium">Made</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/e/${row.id}`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {row.title}
                    </Link>
                    <span className="block text-xs text-[var(--text-muted)]">{row.occasion}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.hostName}
                    <span className="block text-xs text-[var(--text-muted)]">
                      {shortId(row.hostUid)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">{row.plan}</td>
                  <td className="px-4 py-3 tabular-nums">{row.memberCount}</td>
                  <td className="px-4 py-3 tabular-nums">{row.postCount}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBytes(row.storageBytes)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--text-muted)]">
                    {formatRelativeTime(row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ConsoleList>
  );
}
