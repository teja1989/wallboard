'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { api, errorMessage } from '@/lib/client/api-client';

interface DangerSectionProps {
  eventId: string;
  title: string;
  plan: string;
}

/**
 * Keeping a copy, and throwing it all away.
 *
 * These two belong together and in this order, because the honest thing to put next to a
 * delete button is the download button. Someone reaching for one should see the other
 * first.
 */
export function DangerSection({ eventId, title, plan }: DangerSectionProps) {
  const router = useRouter();
  const { notify } = useToast();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const canArchive = entitlementsFor(plan).archiveDownload;
  const matches = confirm.trim().toLowerCase() === title.trim().toLowerCase();

  async function remove() {
    setDeleting(true);
    try {
      await api.post(`/api/events/${eventId}/delete`, { confirm });
      notify('Deleted. Everything is gone.', 'success');
      router.push('/');
    } catch (caught) {
      notify(errorMessage(caught, 'Could not delete that.'), 'error');
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Keep a copy</h3>
        {canArchive ? (
          <>
            {/*
              An anchor rather than a fetch or a router push: the response is a streamed ZIP
              that can run to gigabytes, and the browser's own download manager handles that
              far better than anything we would build.
            */}
            <a
              href={`/api/events/${eventId}/archive`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-5 text-sm font-medium transition-colors hover:bg-[var(--accent-soft)]"
            >
              <Download className="size-4" aria-hidden />
              Download everything
            </a>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              A ZIP with every photo and video at full quality, plus a page you can open offline and
              the guest list as a spreadsheet. Large walls take a minute.
            </p>
          </>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            Downloading the archive is part of a paid plan. Upgrade above and you can keep
            everything before the wall closes.
          </p>
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-4">
        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="text-sm text-[var(--text-muted)] underline underline-offset-4 transition-colors hover:text-[var(--danger)]"
          >
            Delete this event permanently
          </button>
        ) : (
          <div className="rounded-2xl bg-[var(--danger-soft)] p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--danger)]">
              <Trash2 className="size-4" aria-hidden />
              Delete permanently
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              This erases the invitation, every reply, and every photo and video your guests posted
              — theirs as well as yours. It happens immediately and it cannot be undone. Download a
              copy first if you want one.
            </p>

            <label
              htmlFor="delete-confirm"
              className="mt-3 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Type <strong className="font-semibold">{title}</strong> to confirm
            </label>
            <input
              id="delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm focus:border-[var(--danger)] focus:outline-none"
            />

            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={deleting}
                disabled={!matches}
                onClick={remove}
              >
                Delete it all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDelete(false);
                  setConfirm('');
                }}
              >
                Keep it
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
