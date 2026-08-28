'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { matchesEventTitle } from '@/lib/utils';

/**
 * Throwing an event away.
 *
 * One implementation, used from the host panel and from the account list. Destructive flows
 * are the last place to have two of anything: a second copy is a second chance to get the
 * confirmation, the wording, or the error handling subtly wrong, and only one of the two
 * would ever be tested.
 */
export function DeleteEventForm({
  eventId,
  title,
  onDeleted,
  onCancel,
}: {
  eventId: string;
  title: string;
  /** Called once the server confirms. The caller decides where to go or what to remove. */
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const { notify } = useToast();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const matches = matchesEventTitle(confirm, title);
  const inputId = `delete-confirm-${eventId}`;

  async function remove() {
    setDeleting(true);
    try {
      await api.post(`/api/events/${eventId}/delete`, { confirm });
      notify('Deleted. Everything is gone.', 'success');
      onDeleted();
    } catch (caught) {
      // The message matters here. A storage sweep that could not finish comes back as "try
      // again" rather than a bare failure, and the host needs to read that rather than a
      // generic apology — nothing was deleted, and retrying genuinely works.
      notify(errorMessage(caught, 'Could not delete that.'), 'error');
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[var(--danger-soft)] p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--danger)]">
        <Trash2 className="size-4" aria-hidden />
        Delete permanently
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
        This erases the invitation, every reply, and every photo and video your guests posted —
        theirs as well as yours. It happens immediately and it cannot be undone. Download a copy
        first if you want one.
      </p>

      <label
        htmlFor={inputId}
        className="mt-3 block text-xs font-medium text-[var(--text-secondary)]"
      >
        Type <strong className="font-semibold">{title}</strong> to confirm
      </label>
      <input
        id={inputId}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        autoComplete="off"
        aria-describedby={`${inputId}-hint`}
        className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm focus:border-[var(--danger)] focus:outline-none"
      />
      {/*
        Say why the button is grey. A disabled control with no explanation is the most common
        way a working feature reads as a broken one — and a title autocorrected to a curly
        apostrophe on a phone will not match one typed on a laptop, which is exactly the case
        `matchesEventTitle` exists to absorb.
      */}
      <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-[var(--text-muted)]">
        {confirm.trim().length === 0
          ? 'Type the name above to enable the button.'
          : matches
            ? 'That matches. This cannot be undone.'
            : 'That does not match yet — it has to be the name exactly.'}
      </p>

      <div className="mt-3 flex gap-2">
        <Button variant="danger" size="sm" loading={deleting} disabled={!matches} onClick={remove}>
          Delete it all
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
