'use client';
import { adminCopy, adminLimits, shortId } from '@/config';
import { ConsoleList } from '@/components/admin/console-list';
import { formatRelativeTime } from '@/lib/utils';
import type { AuditLogDoc } from '@/types/domain';

/**
 * The audit trail, newest first.
 *
 * Reading this writes an entry of its own, which means the top row of a fresh load is very
 * often the load before it. That is the design rather than a bug — the log is a record of who
 * looked at what, and an operator paging through everyone's activity is exactly the kind of
 * thing it should be recording.
 *
 * IP and user agent are stored on each entry and are deliberately not rendered. They are for
 * an actual investigation, read out of Firestore by someone who has decided to run one, not
 * for a screen anybody with the permission can idly scroll.
 */
export function AuditTable() {
  return (
    <ConsoleList<AuditLogDoc>
      path="/api/admin/audit"
      searchLabel={adminCopy.audit.filterLabel}
      emptyLabel={adminCopy.audit.empty}
      note={`${adminCopy.audit.scope} The most recent ${adminLimits.auditPageSize} are shown.`}
      extract={(payload) => (payload as { entries: AuditLogDoc[] }).entries}
    >
      {(rows) => (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">On</th>
                <th className="px-4 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--text-muted)]">
                    {formatRelativeTime(row.at)}
                  </td>
                  <td className="px-4 py-3 font-medium">{row.action}</td>
                  <td className="px-4 py-3">
                    {shortId(row.actorUid)}
                    <span className="block text-xs text-[var(--text-muted)]">{row.actorRole}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.targetType}
                    <span className="block text-xs text-[var(--text-muted)]">
                      {shortId(row.targetId)}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-[var(--text-secondary)]">
                    {Object.entries(row.metadata ?? {})
                      .map(([key, value]) => `${key}: ${String(value)}`)
                      .join(' · ')}
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
