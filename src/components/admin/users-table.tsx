'use client';
import { useState } from 'react';
import { adminCopy, adminLimits, shortId } from '@/config';
import { Button } from '@/components/ui/button';
import { ConsoleList } from '@/components/admin/console-list';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { formatRelativeTime } from '@/lib/utils';
import type { UserRow } from '@/lib/services/admin';

/**
 * Accounts, and the one write the console has.
 *
 * Suspension asks for a reason before it will go through — the server enforces a minimum
 * length, and this collects it in the same gesture rather than after the fact, because a
 * reason typed later is a reason invented later.
 *
 * The two refusals the server makes (never yourself, never someone at or above your own rank)
 * are not re-implemented here. They are stated as copy where the operator can read them, and
 * the server's message is what surfaces if one is hit. A client-side rank check would be a
 * second place for the rule to live and the wrong one to trust.
 */
export function UsersTable() {
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function toggle(row: UserRow, reload: () => void) {
    const suspended = row.suspendedAt === null;
    const reason = (reasons[row.uid] ?? '').trim();

    setBusy(row.uid);
    try {
      await api.post(`/api/admin/users/${row.uid}/suspend`, { suspended, reason });
      notify(suspended ? 'Account suspended.' : 'Suspension lifted.', 'success');
      setReasons((current) => ({ ...current, [row.uid]: '' }));
      reload();
    } catch (caught) {
      notify(errorMessage(caught, 'That did not go through.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleList<UserRow>
      path="/api/admin/users"
      searchLabel={adminCopy.users.searchLabel}
      emptyLabel={adminCopy.users.empty}
      note={`${adminCopy.users.effect} An email or id matches exactly; otherwise the most recent ${adminLimits.pageSize} are searched.`}
      extract={(payload) => (payload as { users: UserRow[] }).users}
    >
      {(rows, reload) => (
        <ul className="space-y-3">
          {rows.map((row) => {
            const suspended = row.suspendedAt !== null;
            return (
              <li key={row.uid} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {row.displayName}
                      {suspended && (
                        <span className="ml-2 rounded-[var(--radius-pill)] bg-[var(--danger-soft)] px-2 py-0.5 text-xs font-medium text-[var(--danger)]">
                          Suspended
                        </span>
                      )}
                      {row.role !== 'user' && (
                        <span className="ml-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-2 py-0.5 text-xs font-medium">
                          {row.role}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                      {row.email ?? (row.isAnonymous ? 'No account — code only' : 'No address')}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {shortId(row.uid)} · seen {formatRelativeTime(row.lastSeenAt)}
                      {suspended && row.suspendedReason ? ` · “${row.suspendedReason}”` : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`reason-${row.uid}`}>
                    {adminCopy.users.reasonLabel}
                  </label>
                  <input
                    id={`reason-${row.uid}`}
                    value={reasons[row.uid] ?? ''}
                    onChange={(changeEvent) =>
                      setReasons((current) => ({ ...current, [row.uid]: changeEvent.target.value }))
                    }
                    placeholder={adminCopy.users.reasonPlaceholder}
                    maxLength={adminLimits.maxReasonLength}
                    className="min-w-0 flex-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                  />
                  <Button
                    size="sm"
                    variant={suspended ? 'soft' : 'danger'}
                    loading={busy === row.uid}
                    disabled={(reasons[row.uid] ?? '').trim().length < adminLimits.minReasonLength}
                    onClick={() => void toggle(row, reload)}
                  >
                    {suspended ? adminCopy.users.unsuspend : adminCopy.users.suspend}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ConsoleList>
  );
}
