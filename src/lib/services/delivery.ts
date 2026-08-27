import 'server-only';
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { canTransition, collections, commsConfig } from '@/config';

import { eventRef } from '@/lib/services/events';
import type { CommsChannel, DeliveryDoc, DeliveryState, InviteeDoc } from '@/types/domain';

/**
 * How far each invitation got, and when.
 *
 * The shape here is a deliberate trade. The **current** state is denormalised onto the
 * invitee document, because the common read by a very long way is "draw me the guest list"
 * — and a subcollection query per guest would turn one screen into two hundred reads. The
 * **history** lives in a subcollection, because it is only ever read when a host opens one
 * guest to ask what happened to them.
 *
 * Every write goes through `advance`, which refuses to move the status backwards. Delivery
 * receipts arrive late and out of order, and without that rule a carrier acknowledging a
 * message from twenty minutes ago would overwrite "seen" with "delivered".
 */

function inviteeRef(eventId: string, inviteeId: string) {
  return eventRef(eventId).collection(collections.invitees).doc(inviteeId);
}

function deliveriesRef(eventId: string, inviteeId: string) {
  return inviteeRef(eventId, inviteeId).collection(collections.deliveries);
}

interface AttemptInput {
  channel: CommsChannel;
  kind: 'invitation' | 'reminder';
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
}

/**
 * Records one attempt to reach one guest.
 *
 * `sent` rather than `delivered` on success, and the distinction is the point: handing a
 * message to a provider is not the same as it arriving, and only a webhook can tell us the
 * difference. Claiming delivery here would make the host's dashboard confidently wrong.
 */
export async function recordAttempt(
  eventId: string,
  invitee: InviteeDoc,
  attempt: AttemptInput,
): Promise<void> {
  const now = Date.now();
  const state: DeliveryState = attempt.ok ? 'sent' : 'failed';
  const id = randomBytes(12).toString('hex');

  const delivery: DeliveryDoc = {
    id,
    channel: attempt.channel,
    kind: attempt.kind,
    state,
    history: [{ state, at: now, ...(attempt.error ? { detail: attempt.error } : {}) }],
    providerMessageId: attempt.providerMessageId,
    createdAt: now,
    updatedAt: now,
  };
  await deliveriesRef(eventId, invitee.id).doc(id).set(delivery);

  await advance(eventId, invitee, state, {
    lastSentAt: attempt.ok ? now : invitee.lastSentAt,
    sendCount: attempt.ok ? FieldValue.increment(1) : undefined,
    lastError: attempt.error,
  });
}

/**
 * Moves a guest up the ladder, or declines to.
 *
 * The caller passes the invitee it already has rather than re-reading it: every call site
 * has just listed the guests, and a read here would double the cost of a send.
 */
export async function advance(
  eventId: string,
  invitee: InviteeDoc,
  to: DeliveryState,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  if (!canTransition(invitee.status, to)) return false;

  const update: Record<string, unknown> = { status: to, statusAt: Date.now() };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) update[key] = value;
  }

  await inviteeRef(eventId, invitee.id).update(update);
  return true;
}

/**
 * Records that a human actually looked at the invitation.
 *
 * **This is only ever called from a beacon the browser fires after hydration**, and that is
 * the whole design. Corporate mail security — Outlook Safe Links, Proofpoint, Mimecast —
 * fetches every URL in every message it scans, so counting a server-side request as a view
 * would report that every guest at a company had opened their invitation within seconds of
 * it being sent. It is the same mechanism that made email open rates meaningless, and the
 * only reliable defence is to require something a scanner does not do: run JavaScript.
 *
 * Repeat views inside the dedupe window are one visit, so a guest reading the invitation,
 * tapping through to the wall and coming back does not read as three people.
 */
export async function recordView(
  eventId: string,
  invitee: InviteeDoc,
  userAgent: string | null,
): Promise<'recorded' | 'deduped' | 'ignored'> {
  if (userAgent && commsConfig.botAgentPattern.test(userAgent)) return 'ignored';

  const now = Date.now();
  if (invitee.lastViewedAt !== null && now - invitee.lastViewedAt < commsConfig.viewDedupeMs) {
    return 'deduped';
  }

  await inviteeRef(eventId, invitee.id).update({
    lastViewedAt: now,
    viewCount: FieldValue.increment(1),
    ...(invitee.firstViewedAt === null ? { firstViewedAt: now } : {}),
    ...(canTransition(invitee.status, 'seen') ? { status: 'seen', statusAt: now } : {}),
  });

  return 'recorded';
}

/**
 * Marks the guests who replied.
 *
 * Matched on address rather than on the link token: a guest may well have replied from a
 * forwarded link, or on a different device, and refusing to credit that would leave the
 * host chasing someone who already answered. Called after an RSVP lands.
 */
export async function markReplied(eventId: string, email: string | null): Promise<void> {
  if (!email) return;

  const found = await eventRef(eventId)
    .collection(collections.invitees)
    .where('email', '==', email)
    .limit(1)
    .get();

  const doc = found.docs[0];
  if (!doc) return;

  const invitee = { ...(doc.data() as InviteeDoc), id: doc.id };
  await advance(eventId, invitee, 'replied', { repliedAt: Date.now() });
}

/** The full history for one guest. Read only when a host opens them. */
export async function listDeliveries(eventId: string, inviteeId: string): Promise<DeliveryDoc[]> {
  const snapshot = await deliveriesRef(eventId, inviteeId).orderBy('createdAt', 'asc').get();
  return snapshot.docs.map((doc) => doc.data() as DeliveryDoc);
}
