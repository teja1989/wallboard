'use client';
import { eventDraft } from '@/config';
import type { PostKind } from '@/config';

/**
 * The invitation someone is part-way through writing.
 *
 * Hosting needs an account — the host is the only person who can delete the event, read
 * private replies or rotate the code, and that power has to attach to an identity that
 * survives a cleared browser. But asking for it *before* the form is a wall in front of a
 * product nobody has seen yet. So the account is asked for at publish, which means the
 * draft has to survive the sign-in.
 *
 * That is the whole reason this exists. A Google popup keeps the page alive, but an email
 * link does not: the host leaves for their inbox and comes back through a different tab,
 * with every field they filled in gone. Persisting here is what makes the later gate
 * possible without costing anyone their work.
 *
 * Only ever used to prefill a form. The server revalidates the whole payload on create, so
 * a draft that has been edited by hand buys nothing beyond a rejected request.
 */

export interface EventDraft {
  occasionId: string;
  title: string;
  hostedBy: string;
  description: string;
  startsAt: string;
  locationName: string;
  locationAddress: string;
  dressCode: string;
  templateId: string;
  templateTouched: boolean;
  expiryPresetId: string;
  allowedKinds: PostKind[];
  allowPlusOnes: boolean;
  /** Set when the host pressed publish and was sent to sign in. Drives the auto-resume. */
  pendingPublish: boolean;
  savedAt: number;
}

const isString = (v: unknown): v is string => typeof v === 'string';

/**
 * Defensive rather than trusting: localStorage is the visitor's own to edit, and a draft
 * with the wrong shape would otherwise crash the page it is supposed to restore.
 */
function parse(raw: string): EventDraft | null {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) return null;

  const d = value as Record<string, unknown>;
  if (!isString(d.occasionId) || !isString(d.title) || !isString(d.templateId)) return null;
  if (typeof d.savedAt !== 'number') return null;
  if (Date.now() - d.savedAt > eventDraft.ttlMs) return null;

  return {
    occasionId: d.occasionId,
    title: d.title,
    hostedBy: isString(d.hostedBy) ? d.hostedBy : '',
    description: isString(d.description) ? d.description : '',
    startsAt: isString(d.startsAt) ? d.startsAt : '',
    locationName: isString(d.locationName) ? d.locationName : '',
    locationAddress: isString(d.locationAddress) ? d.locationAddress : '',
    dressCode: isString(d.dressCode) ? d.dressCode : '',
    templateId: d.templateId,
    templateTouched: d.templateTouched === true,
    expiryPresetId: isString(d.expiryPresetId) ? d.expiryPresetId : '',
    allowedKinds: Array.isArray(d.allowedKinds)
      ? (d.allowedKinds.filter(isString) as PostKind[])
      : [],
    allowPlusOnes: d.allowPlusOnes !== false,
    pendingPublish: d.pendingPublish === true,
    savedAt: d.savedAt,
  };
}

export function saveDraft(draft: Omit<EventDraft, 'savedAt'>): void {
  try {
    const payload: EventDraft = { ...draft, savedAt: Date.now() };
    window.localStorage.setItem(eventDraft.storageKey, JSON.stringify(payload));
  } catch {
    // Private browsing, a full quota, or storage disabled outright. The host keeps their
    // work in the form they are looking at; only the trip through an inbox would lose it,
    // and that is better than refusing to let them continue.
  }
}

export function loadDraft(): EventDraft | null {
  try {
    const raw = window.localStorage.getItem(eventDraft.storageKey);
    return raw ? parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(eventDraft.storageKey);
  } catch {
    // Nothing to do: an unclearable draft expires on its own.
  }
}
