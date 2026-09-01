import 'server-only';
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { collections, occasionById, registryHostLabel, registryLimits } from '@/config';
import { ApiError } from '@/lib/server/api';
import { eventRef } from '@/lib/services/events';
import type { EventDoc, RegistryLinkDoc } from '@/types/domain';

/**
 * The gift list.
 *
 * Links only — no prices, no catalogue, no money. See `src/config/registry.config.ts` for the
 * reasoning; the short version is that this exists to answer one question cheaply before
 * anybody builds payments to answer it expensively.
 */

function registryCollection(eventId: string) {
  return eventRef(eventId).collection(collections.registry);
}

/**
 * Whether this event may have a gift list at all.
 *
 * A property of the occasion, not of the host's plan. Deliberately so: putting a gift list
 * behind a paywall would mean the only invitations that ask guests for money are the ones
 * where we were already paid, which is a worse product and a worse look. It is also the one
 * surface whose whole purpose is measurement, and a measurement you only take from paying
 * customers tells you about paying customers.
 */
export function registryAllowedFor(event: EventDoc): boolean {
  return occasionById(event.occasion).giftsExpected;
}

/** Ordered as the host arranged them, with the oldest first as a stable tiebreak. */
export async function listRegistry(eventId: string): Promise<RegistryLinkDoc[]> {
  const snapshot = await registryCollection(eventId).orderBy('order').get();
  return snapshot.docs.map((doc) => doc.data() as RegistryLinkDoc);
}

export async function addRegistryLink(
  event: EventDoc,
  input: { url: string; label: string; note: string },
): Promise<RegistryLinkDoc> {
  if (!registryAllowedFor(event)) {
    throw new ApiError('bad_request', 'This kind of event does not carry a gift list.');
  }

  const existing = await listRegistry(event.id);
  if (existing.length >= registryLimits.maxLinksPerEvent) {
    throw new ApiError(
      'bad_request',
      `You can add up to ${registryLimits.maxLinksPerEvent} links.`,
    );
  }

  const link: RegistryLinkDoc = {
    id: randomBytes(9).toString('base64url'),
    // Naming it after the host it points at beats an empty row: a guest reading "Amazon" knows
    // where the tap goes, and the host who could not think of a name still gets a usable list.
    label: input.label || registryHostLabel(input.url),
    url: input.url,
    note: input.note,
    // Append. `length` rather than max+1 is safe because removal is the only other writer and
    // it does not renumber — a gap in the sequence orders exactly the same way.
    order: existing.length,
    addedAt: Date.now(),
    clickCount: 0,
  };

  await registryCollection(event.id).doc(link.id).set(link);
  return link;
}

export async function removeRegistryLink(eventId: string, linkId: string): Promise<void> {
  const ref = registryCollection(eventId).doc(linkId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError('not_found', 'That link is not on the list.');
  await ref.delete();
}

/**
 * One guest tapped one link.
 *
 * Best-effort and silent, exactly like the funnel counter beside it: a guest on their way to
 * buy somebody a present must never be stopped by our bookkeeping. A missing increment is a
 * slightly wrong number; a thrown error is a guest staring at a failure instead of a shop.
 *
 * Unlike the funnel this one can fail loudly in only one way — a link id that does not exist —
 * and even that is swallowed, because the alternative is telling a guest their tap was invalid
 * when the host has simply removed the row since the page loaded.
 */
export async function recordRegistryClick(eventId: string, linkId: string): Promise<void> {
  try {
    await registryCollection(eventId)
      .doc(linkId)
      .update({ clickCount: FieldValue.increment(1) });
  } catch (error) {
    console.error('[registry] could not count a click', eventId, linkId, error);
  }
}
