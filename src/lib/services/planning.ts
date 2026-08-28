import 'server-only';
import { randomBytes } from 'node:crypto';
import { collections, planTemplateFor, planningLimits, type MilestoneTemplate } from '@/config';
import { db } from '@/lib/firebase/admin';
import { ApiError } from '@/lib/server/api';
import { eventRef } from '@/lib/services/events';
import type { EventDoc, MilestoneDoc } from '@/types/domain';

/**
 * The host's planning list.
 *
 * The design that matters here is **nothing is written until the host touches it**.
 *
 * A read returns the saved rows if there are any, and otherwise renders the occasion's
 * template from config on the fly. Only the first mutation — a tick, an edit, a new row —
 * materialises the whole template into Firestore, and then applies the change to it.
 *
 * That buys three things worth having. Reads stay pure, so opening a tab does not write; a
 * host who never opens it never has fourteen documents created on their behalf; and the seeded
 * wording stays editable in `planning.config.ts` right up until somebody actually uses it,
 * rather than being frozen into every event at creation.
 *
 * `templateKey` is what makes materialising idempotent: a row that came from the template
 * carries the key it came from, so the seed can never run twice into duplicates.
 */

function milestonesCollection(eventId: string) {
  return eventRef(eventId).collection(collections.milestones);
}

function newMilestoneId(): string {
  return randomBytes(9).toString('base64url');
}

/**
 * When a seeded row wants doing, counted back from the event.
 *
 * Null when the host has not set a date — a suggested deadline derived from a date nobody
 * gave us would be a confident invention, and the panel says so instead.
 */
function dueFrom(event: EventDoc, leadMs: number): number | null {
  return event.startsAt === null ? null : event.startsAt - leadMs;
}

/** A template row as it looks before anybody has saved it. */
function renderTemplate(
  event: EventDoc,
  template: MilestoneTemplate,
  order: number,
  now: number,
): MilestoneDoc {
  return {
    // Prefixed so the client can tell a rendered row from a saved one, and so a stray write
    // aimed at one cannot collide with a real document id.
    id: `template:${template.key}`,
    title: template.title,
    note: template.note ?? '',
    categoryId: template.categoryId,
    done: false,
    doneAt: null,
    dueAt: dueFrom(event, template.leadMs),
    budget: null,
    order,
    templateKey: template.key,
    live: template.live ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export interface PlanView {
  milestones: MilestoneDoc[];
  /** False while the list is still the config template and nothing has been written. */
  saved: boolean;
}

export async function readPlan(event: EventDoc): Promise<PlanView> {
  const snapshot = await milestonesCollection(event.id).orderBy('order').get();

  if (!snapshot.empty) {
    return { milestones: snapshot.docs.map((doc) => doc.data() as MilestoneDoc), saved: true };
  }

  const now = Date.now();
  return {
    milestones: planTemplateFor(event.occasion).map((template, index) =>
      renderTemplate(event, template, index, now),
    ),
    saved: false,
  };
}

/**
 * Writes the template out, once, so there is something to edit.
 *
 * Returns the saved rows. Called by every mutation before it does its own work, and a no-op
 * when the collection already has anything in it — two hosts tapping at the same moment both
 * find rows on the second read, and the loser of the race does not write a duplicate set.
 */
async function materialise(event: EventDoc): Promise<MilestoneDoc[]> {
  const existing = await milestonesCollection(event.id).orderBy('order').get();
  if (!existing.empty) return existing.docs.map((doc) => doc.data() as MilestoneDoc);

  const now = Date.now();
  const rows = planTemplateFor(event.occasion).map((template, index) => ({
    ...renderTemplate(event, template, index, now),
    id: newMilestoneId(),
  }));

  const batch = db().batch();
  for (const row of rows) {
    batch.set(milestonesCollection(event.id).doc(row.id), row);
  }
  await batch.commit();

  return rows;
}

/** The saved row a `template:` id refers to, once the template has been written out. */
function resolveId(rows: MilestoneDoc[], requestedId: string): MilestoneDoc | undefined {
  if (requestedId.startsWith('template:')) {
    const key = requestedId.slice('template:'.length);
    return rows.find((row) => row.templateKey === key);
  }
  return rows.find((row) => row.id === requestedId);
}

export interface MilestonePatch {
  title?: string;
  note?: string;
  categoryId?: MilestoneDoc['categoryId'];
  done?: boolean;
  dueAt?: number | null;
  budget?: number | null;
}

export interface PatchResult {
  milestone: MilestoneDoc;
  /** True when this patch is what marked the row done, so the funnel counts it once. */
  justCompleted: boolean;
}

export async function patchMilestone(
  event: EventDoc,
  milestoneId: string,
  patch: MilestonePatch,
): Promise<PatchResult> {
  const rows = await materialise(event);
  const current = resolveId(rows, milestoneId);
  if (!current) throw new ApiError('not_found', 'That is not on the list.');

  const now = Date.now();
  const next: MilestoneDoc = {
    ...current,
    ...patch,
    // Kept in step with `done` rather than accepted from the client, so the two cannot
    // disagree and a host cannot backdate their own progress.
    doneAt: patch.done === undefined ? current.doneAt : patch.done ? now : null,
    updatedAt: now,
  };

  await milestonesCollection(event.id).doc(current.id).set(next);

  return { milestone: next, justCompleted: patch.done === true && !current.done };
}

export async function addMilestone(
  event: EventDoc,
  input: {
    title: string;
    note: string;
    categoryId: MilestoneDoc['categoryId'];
    dueAt: number | null;
    budget: number | null;
  },
): Promise<MilestoneDoc> {
  const rows = await materialise(event);

  if (rows.length >= planningLimits.maxMilestonesPerEvent) {
    throw new ApiError(
      'bad_request',
      `A plan can hold ${planningLimits.maxMilestonesPerEvent} things. Tick some off, or remove what does not apply.`,
    );
  }

  const now = Date.now();
  const milestone: MilestoneDoc = {
    id: newMilestoneId(),
    title: input.title,
    note: input.note,
    categoryId: input.categoryId,
    done: false,
    doneAt: null,
    dueAt: input.dueAt,
    budget: input.budget,
    // Appended by count rather than max+1: removal does not renumber, and a gap sorts the
    // same way. What matters is that a new row lands at the bottom.
    order: rows.length,
    templateKey: null,
    // Only a template row can carry one; a host cannot ask for a live number.
    live: null,
    createdAt: now,
    updatedAt: now,
  };

  await milestonesCollection(event.id).doc(milestone.id).set(milestone);
  return milestone;
}

export async function removeMilestone(event: EventDoc, milestoneId: string): Promise<void> {
  const rows = await materialise(event);
  const current = resolveId(rows, milestoneId);
  if (!current) throw new ApiError('not_found', 'That is not on the list.');

  await milestonesCollection(event.id).doc(current.id).delete();
}
