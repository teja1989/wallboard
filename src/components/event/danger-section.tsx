'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import { DeleteEventForm } from '@/components/event/delete-event-form';
import { entitlementsFor } from '@/lib/billing/entitlements';

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
  const [showDelete, setShowDelete] = useState(false);

  const canArchive = entitlementsFor(plan).archiveDownload;

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
        {showDelete ? (
          <DeleteEventForm
            eventId={eventId}
            title={title}
            onDeleted={() => router.push('/account')}
            onCancel={() => setShowDelete(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="text-sm text-[var(--text-muted)] underline underline-offset-4 transition-colors hover:text-[var(--danger)]"
          >
            Delete this event permanently
          </button>
        )}
      </div>
    </section>
  );
}
