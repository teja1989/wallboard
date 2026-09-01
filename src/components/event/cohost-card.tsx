'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Shield, Trash2, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';

interface CoHostItem {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  role: string;
}

interface CohostCardProps {
  eventId: string;
  joinCode?: string | null;
  hostedBy: string;
  onCoHostChanged?: () => void;
}

export function CohostCard({ eventId, joinCode, hostedBy, onCoHostChanged }: CohostCardProps) {
  const { notify } = useToast();
  const [cohosts, setCohosts] = useState<CoHostItem[]>([]);
  const [code, setCode] = useState<string | null>(joinCode ?? null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  const loadCohosts = useCallback(async () => {
    try {
      const [guestsRes, invitesRes] = await Promise.all([
        api
          .get<{ guests: CoHostItem[] }>(`/api/events/${eventId}/guests`)
          .catch(() => ({ guests: [] })),
        api
          .get<{ joinCode: string | null }>(`/api/events/${eventId}/invites`)
          .catch(() => ({ joinCode: null })),
      ]);
      setCohosts(guestsRes.guests.filter((g) => g.role === 'cohost'));
      if (invitesRes.joinCode) setCode(invitesRes.joinCode);
    } catch {
      // Quiet fail
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void (async () => {
      await loadCohosts();
    })();
  }, [loadCohosts]);

  const copyCohostLink = async () => {
    const activeCode = code || joinCode;
    if (!activeCode) return;
    const url = `${window.location.origin}/i/${activeCode}?role=cohost`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    notify('Co-host invite link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2200);
  };

  const removeCohost = async (uid: string) => {
    setRemovingUid(uid);
    try {
      await api.post(`/api/events/${eventId}/members/${uid}/role`, { role: 'member' });
      notify('Removed co-host privileges.', 'success');
      setCohosts((prev) => prev.filter((c) => c.uid !== uid));
      onCoHostChanged?.();
    } catch (caught) {
      notify(errorMessage(caught, 'Could not remove co-host.'), 'error');
    } finally {
      setRemovingUid(null);
    }
  };

  return (
    <section className="card space-y-4 border border-[var(--border-subtle)] p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
            <Shield className="size-4.5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Event Co-Hosts</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Co-hosts can manage guests, moderate live photos, and edit party details.
            </p>
          </div>
        </div>

        {(joinCode || code) && (
          <Button
            size="sm"
            variant="soft"
            onClick={copyCohostLink}
            className="hidden items-center gap-1.5 rounded-full text-xs font-bold sm:inline-flex"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <UserPlus className="size-3.5" />
                <span>Invite Co-Host</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Host & Co-Hosts Roster */}
      <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]/60 p-4">
        {/* Primary Host */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-300">
              👑
            </span>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">{hostedBy} (You)</p>
              <span className="text-[0.7rem] font-semibold text-amber-700 dark:text-amber-400">
                Primary Event Host
              </span>
            </div>
          </div>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/15 px-2.5 py-0.5 text-[0.7rem] font-bold text-amber-800 dark:text-amber-300">
            Owner
          </span>
        </div>

        {/* Co-Hosts List */}
        {cohosts.length > 0 && (
          <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
            {cohosts.map((cohost) => (
              <div key={cohost.uid} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <Avatar name={cohost.displayName} photoUrl={cohost.photoUrl} size={32} />
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      {cohost.displayName}
                    </p>
                    <span className="text-[0.7rem] font-semibold text-purple-600 dark:text-purple-400">
                      Co-Host · Full Moderation
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeCohost(cohost.uid)}
                  disabled={removingUid === cohost.uid}
                  aria-label={`Remove co-host ${cohost.displayName}`}
                  className="inline-flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  title="Remove Co-Host privileges"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {cohosts.length === 0 && !loading && (
          <p className="text-xs text-[var(--text-muted)] italic">
            No co-hosts added yet. Send your co-host invite link to partners or friends so they can
            help host.
          </p>
        )}
      </div>

      {/* Mobile Invite Button */}
      {(joinCode || code) && (
        <div className="sm:hidden">
          <Button
            size="sm"
            variant="soft"
            onClick={copyCohostLink}
            className="flex w-full items-center justify-center gap-1.5 rounded-full text-xs font-bold"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <UserPlus className="size-3.5" />
                <span>Invite Co-Host</span>
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
