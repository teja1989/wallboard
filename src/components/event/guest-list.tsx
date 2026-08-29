'use client';
import { useEffect, useState } from 'react';
import { Download, Loader2, MessageSquareQuote, Shield } from 'lucide-react';
import { rsvpLabels, type RsvpStatus } from '@/config';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { cn } from '@/lib/utils';
import type { RsvpTally } from '@/types/domain';

interface Guest {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  role: string;
  status: RsvpStatus;
  partySize: number;
  adults: number;
  children: number;
  respondedAt: number | null;
  isAnonymous: boolean;
  note?: string;
  answer?: string;
}

interface GuestListProps {
  eventId: string;
  canExport: boolean;
  canAssignRole?: boolean;
  onMemberRoleChanged?: () => void;
  /** Bumped by the parent when a reply lands, so the list refetches. */
  refreshKey: number;
}

const STATUS_STYLE: Record<RsvpStatus, string> = {
  yes: 'bg-[var(--accent-soft)] text-[var(--text-primary)]',
  no: 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
  maybe: 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]',
  pending: 'bg-transparent text-[var(--text-muted)]',
};

/**
 * Who is coming.
 *
 * Led by the headcount rather than the reply count, because that is the number a host is
 * actually trying to find out — how many people to cater for, not how many tapped a button.
 */
export function GuestList({
  eventId,
  canExport,
  canAssignRole = false,
  onMemberRoleChanged,
  refreshKey,
}: GuestListProps) {
  const { notify } = useToast();
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [tally, setTally] = useState<RsvpTally | null>(null);
  const [canSeeNotes, setCanSeeNotes] = useState(false);
  const [changingUid, setChangingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(uid: string, nextRole: 'cohost' | 'member') {
    setChangingUid(uid);
    try {
      await api.post(`/api/events/${eventId}/members/${uid}/role`, { role: nextRole });
      notify(
        nextRole === 'cohost' ? 'Promoted to co-host.' : 'Removed co-host privileges.',
        'success',
      );
      setGuests((current) =>
        current ? current.map((g) => (g.uid === uid ? { ...g, role: nextRole } : g)) : null,
      );
      onMemberRoleChanged?.();
    } catch (caught) {
      notify(errorMessage(caught, 'Could not update role.'), 'error');
    } finally {
      setChangingUid(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await api.get<{
          guests: Guest[];
          tally: RsvpTally;
          canSeeNotes: boolean;
        }>(`/api/events/${eventId}/guests`);
        if (cancelled) return;
        setGuests(result.guests);
        setTally(result.tally);
        setCanSeeNotes(result.canSeeNotes);
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught, 'Could not load the guest list.'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, refreshKey]);

  if (error) {
    return (
      <p role="alert" className="py-12 text-center text-sm text-[var(--danger)]">
        {error}
      </p>
    );
  }

  if (!guests || !tally) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" aria-label="Loading" />
      </div>
    );
  }

  const replied = guests.filter((guest) => guest.status !== 'pending');
  const awaiting = guests.filter((guest) => guest.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <p className="text-3xl font-semibold tracking-tight">{tally.attending}</p>
        <p className="text-sm text-[var(--text-secondary)]">
          {tally.attending === 1 ? 'person coming' : 'people coming'}
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Tally label={rsvpLabels.yes} value={tally.yes} />
          <Tally label={rsvpLabels.maybe} value={tally.maybe} />
          <Tally label={rsvpLabels.no} value={tally.no} />
          <Tally label="Not replied" value={tally.pending} />
        </div>

        {canExport && (
          <Button
            variant="soft"
            size="sm"
            className="mt-4"
            onClick={() => window.open(`/api/events/${eventId}/guests?format=csv`, '_blank')}
          >
            <Download className="size-4" aria-hidden />
            Export the list
          </Button>
        )}
      </div>

      <GuestGroup
        title="Replied"
        guests={replied}
        canSeeNotes={canSeeNotes}
        canAssignRole={canAssignRole}
        changingUid={changingUid}
        onRoleChange={handleRoleChange}
      />
      <GuestGroup
        title="Waiting to hear"
        guests={awaiting}
        canSeeNotes={false}
        canAssignRole={canAssignRole}
        changingUid={changingUid}
        onRoleChange={handleRoleChange}
      />
    </div>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-3 py-1">
      <span className="font-semibold">{value}</span>
      <span className="text-[var(--text-secondary)]">{label}</span>
    </span>
  );
}

function GuestGroup({
  title,
  guests,
  canSeeNotes,
  canAssignRole,
  changingUid,
  onRoleChange,
}: {
  title: string;
  guests: Guest[];
  canSeeNotes: boolean;
  canAssignRole?: boolean;
  changingUid?: string | null;
  onRoleChange?: (uid: string, nextRole: 'cohost' | 'member') => Promise<void>;
}) {
  if (guests.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
        {title} · {guests.length}
      </h3>
      <ul className="card divide-y divide-[var(--border-subtle)] overflow-hidden">
        {guests.map((guest) => (
          <li key={guest.uid} className="flex items-start gap-3 px-4 py-3">
            <Avatar name={guest.displayName} photoUrl={guest.photoUrl} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate font-medium">{guest.displayName}</span>
                {guest.role === 'host' && (
                  <span className="rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)]">
                    Host
                  </span>
                )}
                {guest.role === 'cohost' && (
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
                    <Shield className="size-3" aria-hidden />
                    Co-host
                  </span>
                )}
                {guest.status === 'yes' && guest.partySize > 1 && (
                  <span className="text-xs text-[var(--text-muted)]">
                    +{guest.partySize - 1}
                    {guest.children > 0 &&
                      ` (${guest.children} ${guest.children === 1 ? 'child' : 'children'})`}
                  </span>
                )}
                {canAssignRole && guest.role !== 'host' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn(
                      'ml-auto h-6 px-2 text-xs',
                      guest.role === 'cohost'
                        ? 'text-[var(--text-muted)] hover:text-[var(--danger)]'
                        : 'text-[var(--accent)] hover:bg-[var(--accent-soft)]',
                    )}
                    disabled={guest.isAnonymous || changingUid === guest.uid}
                    loading={changingUid === guest.uid}
                    onClick={() =>
                      onRoleChange?.(guest.uid, guest.role === 'cohost' ? 'member' : 'cohost')
                    }
                    title={
                      guest.isAnonymous
                        ? 'Guest must sign in before becoming a co-host'
                        : guest.role === 'cohost'
                          ? 'Remove co-host permissions'
                          : 'Grant co-host permissions'
                    }
                  >
                    {guest.role === 'cohost' ? 'Remove Co-host' : 'Make Co-host'}
                  </Button>
                )}
              </div>

              {canSeeNotes && guest.note && (
                <p className="mt-1 flex gap-1.5 text-sm text-[var(--text-secondary)]">
                  <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="italic">{guest.note}</span>
                </p>
              )}
              {canSeeNotes && guest.answer && (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{guest.answer}</p>
              )}
            </div>

            <span
              className={cn(
                'shrink-0 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium',
                STATUS_STYLE[guest.status],
              )}
            >
              {rsvpLabels[guest.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
