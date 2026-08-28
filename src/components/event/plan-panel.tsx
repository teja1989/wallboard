'use client';
import { useEffect, useState } from 'react';
import { Check, Loader2, Lock, Plus, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import {
  MILESTONE_CATEGORIES,
  formatBudget,
  milestoneCategoryById,
  planningCopy,
  planningLimits,
} from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { cn, formatDateOnly } from '@/lib/utils';
import type { EventDoc, MilestoneCategoryId, MilestoneDoc } from '@/types/domain';

interface LiveNumbers {
  headcount: number;
  replies: number;
  pending: number;
  venue: string;
}

interface PlanResponse {
  milestones: MilestoneDoc[];
  saved: boolean;
  entitled: boolean;
  live: LiveNumbers;
}

/**
 * The plan.
 *
 * A checklist is not worth money — everyone has one already. Two things here are not a
 * checklist, and they are the whole feature:
 *
 * It arrives written, with real lead times counted back from the date the host already gave
 * us. A host planning a fortieth does not want an empty board; they want to know what they
 * have forgotten, and "order the cake, three weeks out" is something a blank page cannot say.
 *
 * And it knows things a notes app cannot. "Confirm final numbers" sits next to the live
 * headcount; "chase anyone who has not replied" sits next to how many have not. That is only
 * possible because this list hangs off an event that already holds the date, the venue and the
 * replies — and it is the part a general-purpose planner structurally cannot copy.
 *
 * On the free tier the rows are all here and none of them move. Showing the locked thing is
 * the point: a host can read exactly what they would be buying, which is a better pitch than
 * any feature bullet, and hiding it would be selling a mystery.
 */
export function PlanPanel({ event }: { event: EventDoc }) {
  const { notify } = useToast();

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftCategory, setDraftCategory] = useState<MilestoneCategoryId>('admin');

  // Read once when the panel mounts rather than on every render. "Overdue" is a question about
  // a date, and re-reading the clock mid-render is both impure and pointless at that
  // resolution — a deadline does not pass while somebody is ticking a box.
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await api.get<PlanResponse>(`/api/events/${event.id}/plan`);
        if (!cancelled) setPlan(next);
      } catch (caught) {
        if (!cancelled) notify(errorMessage(caught, 'The plan would not load.'), 'error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [event.id, notify]);

  const milestones = plan?.milestones ?? [];
  const doneCount = milestones.filter((milestone) => milestone.done).length;
  // Not memoised: this is a sum over at most sixty numbers, and `milestones` is a fresh array
  // on every render, so a useMemo here would recompute anyway while pretending not to.
  const budgetTotal = milestones.reduce((sum, milestone) => sum + (milestone.budget ?? 0), 0);

  /** Replaces one row in place, so a tick does not cost a full reload of the list. */
  function replace(next: MilestoneDoc, previousId: string) {
    setPlan((current) =>
      current === null
        ? current
        : {
            ...current,
            saved: true,
            milestones: current.milestones.map((row) => (row.id === previousId ? next : row)),
          },
    );
  }

  async function toggle(milestone: MilestoneDoc) {
    if (!plan?.entitled || busyId !== null) return;
    setBusyId(milestone.id);
    try {
      const { milestone: next } = await api.patch<{ milestone: MilestoneDoc }>(
        `/api/events/${event.id}/plan/${milestone.id}`,
        { done: !milestone.done },
      );
      replace(next, milestone.id);
    } catch (caught) {
      notify(errorMessage(caught, 'That did not save.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(milestone: MilestoneDoc) {
    if (!plan?.entitled) return;
    try {
      await api.delete(`/api/events/${event.id}/plan/${milestone.id}`);
      setPlan((current) =>
        current === null
          ? current
          : {
              ...current,
              saved: true,
              milestones: current.milestones.filter((row) => row.id !== milestone.id),
            },
      );
    } catch (caught) {
      notify(errorMessage(caught, 'That could not be removed.'), 'error');
    }
  }

  async function add() {
    if (draft.trim() === '' || adding || !plan?.entitled) return;
    setAdding(true);
    try {
      const { milestone } = await api.post<{ milestone: MilestoneDoc }>(
        `/api/events/${event.id}/plan`,
        { title: draft, categoryId: draftCategory },
      );
      setPlan((current) =>
        current === null
          ? current
          : { ...current, saved: true, milestones: [...current.milestones, milestone] },
      );
      setDraft('');
    } catch (caught) {
      notify(errorMessage(caught, 'That could not be added.'), 'error');
    } finally {
      setAdding(false);
    }
  }

  if (plan === null) {
    return (
      <div className="card flex justify-center p-10">
        <Loader2
          className="size-5 animate-spin text-[var(--text-muted)]"
          aria-label="Loading the plan"
        />
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="plan-heading">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="plan-heading" className="font-semibold">
              {planningCopy.heading}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{planningCopy.body}</p>
          </div>
          <span className="glass shrink-0 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm tabular-nums">
            {doneCount === milestones.length && milestones.length > 0
              ? planningCopy.allDone
              : planningCopy.done(doneCount, milestones.length)}
          </span>
        </div>

        {/* Without a date there is nothing to count backwards from, and an invented deadline
            is worse than none. Said once here rather than as "—" on every row. */}
        {event.startsAt === null && (
          <p className="mt-3 rounded-2xl bg-[var(--surface-sunken)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            {planningCopy.noDate}
          </p>
        )}

        {budgetTotal > 0 && (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {planningCopy.budgetTotal(formatBudget(budgetTotal))}
          </p>
        )}
      </div>

      {!plan.entitled && <LockedNote />}

      <ul className="space-y-2">
        {milestones.map((milestone) => (
          <MilestoneRow
            key={milestone.id}
            milestone={milestone}
            live={plan.live}
            timeZone={event.timeZone}
            now={mountedAt}
            entitled={plan.entitled}
            busy={busyId === milestone.id}
            onToggle={() => void toggle(milestone)}
            onRemove={() => void remove(milestone)}
          />
        ))}
      </ul>

      {plan.entitled && milestones.length < planningLimits.maxMilestonesPerEvent && (
        <div className="card space-y-3 p-4">
          <label htmlFor="plan-add" className="sr-only">
            {planningCopy.addLabel}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="plan-add"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void add();
              }}
              maxLength={planningLimits.titleMaxLength}
              placeholder={planningCopy.addPlaceholder}
              className="min-w-0 flex-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
            <select
              aria-label="Category"
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value as MilestoneCategoryId)}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-3 text-sm"
            >
              {MILESTONE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={add} loading={adding} disabled={draft.trim() === ''} className="w-full">
            <Plus className="size-4" aria-hidden />
            {planningCopy.addLabel}
          </Button>
        </div>
      )}
    </section>
  );
}

function LockedNote() {
  return (
    <div className="card flex items-start gap-3 p-5">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <Lock className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-medium">{planningCopy.lockedTitle}</p>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{planningCopy.lockedBody}</p>
        <Link
          href="/pricing"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] underline underline-offset-4"
        >
          <Sparkles className="size-3.5" aria-hidden />
          See what is included
        </Link>
      </div>
    </div>
  );
}

function MilestoneRow({
  milestone,
  live,
  timeZone,
  now,
  entitled,
  busy,
  onToggle,
  onRemove,
}: {
  milestone: MilestoneDoc;
  live: LiveNumbers;
  timeZone: string | null;
  now: number;
  entitled: boolean;
  busy: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const category = milestoneCategoryById(milestone.categoryId);
  const liveLine = liveHint(milestone, live);

  // Only worth flagging on something still outstanding. Shouting "overdue" at a row the host
  // has already ticked is the product telling them off for work they did.
  const overdue = !milestone.done && milestone.dueAt !== null && milestone.dueAt < now;

  return (
    <li
      className={cn(
        'card flex items-start gap-3 p-4 transition-opacity',
        milestone.done && 'opacity-60',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={milestone.done}
        aria-label={milestone.title}
        disabled={!entitled || busy}
        onClick={onToggle}
        className={cn(
          'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors',
          milestone.done
            ? 'border-transparent bg-[var(--accent)] text-[var(--accent-contrast)]'
            : 'border-[var(--border-subtle)] hover:border-[var(--accent)]',
          !entitled && 'cursor-not-allowed opacity-50',
        )}
      >
        {busy ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          milestone.done && <Check className="size-3.5" aria-hidden />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', milestone.done && 'line-through')}>{milestone.title}</p>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--text-muted)]">
          <span>
            {category.glyph} {category.label}
          </span>
          {milestone.dueAt !== null && (
            <span className={cn(overdue && 'font-medium text-[var(--danger)]')}>
              · {overdue ? planningCopy.overdue : planningCopy.dueOn}{' '}
              {formatDateOnly(milestone.dueAt, timeZone)}
            </span>
          )}
          {milestone.budget !== null && milestone.budget > 0 && (
            <span>· {formatBudget(milestone.budget)}</span>
          )}
        </p>

        {milestone.note !== '' && (
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{milestone.note}</p>
        )}

        {/* The reason this beats a notes app. */}
        {liveLine !== null && (
          <p className="mt-1.5 inline-flex rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
            {liveLine}
          </p>
        )}
      </div>

      {entitled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${planningCopy.remove}: ${milestone.title}`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--danger)]"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}

/**
 * What this row can say using the event beside it.
 *
 * Returns null rather than a placeholder when there is nothing to report — a row reading
 * "0 people so far" the day the invitation goes out is discouraging and says nothing.
 */
function liveHint(milestone: MilestoneDoc, live: LiveNumbers): string | null {
  switch (milestone.live) {
    case 'headcount':
      return live.headcount > 0 ? `${live.headcount} coming so far` : null;
    case 'replies':
      return live.pending > 0 ? `${live.pending} have not replied yet` : null;
    case 'invited':
      return live.replies > 0 ? `${live.replies} have replied` : null;
    case 'venue':
      return live.venue !== '' ? `On the invitation: ${live.venue}` : null;
    default:
      return null;
  }
}
