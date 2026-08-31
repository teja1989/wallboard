'use client';
import { useState } from 'react';
import { ChevronDown, Eye } from 'lucide-react';
import { Invitation } from '@/components/event/invitation';
import { previewEventFromDraft, type InvitationDraft } from '@/lib/preview';
import { cn } from '@/lib/utils';

/**
 * What the host is actually making, while they are making it.
 *
 * The create form had no preview of any kind. A host chose a design from a swatch, typed a
 * title, a date and a venue, and pressed publish having never seen the card — the first sight
 * of their own invitation came after it existed and had a code attached. For a thing whose
 * entire job is to be looked at by forty people, that is the wrong order.
 *
 * It renders the **real** `Invitation` component rather than an approximation of it. That is
 * the point: a second renderer would be maintained by different edits on different days and
 * would start lying about the product almost immediately.
 *
 * Two placements, because the useful moment differs by screen. Wide enough and it sits beside
 * the form, sticky, updating as you type. Narrow and it collapses to a strip directly above
 * the publish button — on a phone there is no room to show both at once, and the moment
 * before committing is when someone actually wants to look.
 */
export function InvitationPreview({
  draft,
  className,
  /** Collapsible with a toggle, for the narrow placement where it cannot always be open. */
  collapsible = false,
}: {
  draft: InvitationDraft;
  className?: string;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const event = previewEventFromDraft(draft);

  if (!collapsible) {
    return (
      // A labelled region rather than a bare div: it gives someone on a screen reader a way
      // to skip past a card they are not editing, and it gives the tests one unambiguous
      // handle — both placements live in the DOM at once, hidden by CSS rather than by
      // JavaScript, because a media query resolved in JS would hydrate to a different tree.
      <section aria-label="Invitation preview" className={className}>
        <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
          <Eye className="size-4" aria-hidden />
          What your guests will see
        </p>
        {/*
          `inert` because this is a picture of an invitation, not one. Without it the
          "Get directions" link and the add-to-calendar button inside are reachable by tab,
          and a host keyboarding through the form would fall into a preview that navigates
          away from their half-finished draft.
        */}
        <div inert>
          <Invitation event={event} titleAs="h2" />
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Invitation preview" className={className}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl bg-[var(--surface-sunken)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--accent-soft)]"
      >
        <span className="flex items-center gap-1.5">
          <Eye className="size-4" aria-hidden />
          {open ? 'Hide the preview' : 'Preview what your guests will see'}
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div inert className="mt-4">
          <Invitation event={event} titleAs="h2" />
        </div>
      )}
    </section>
  );
}
