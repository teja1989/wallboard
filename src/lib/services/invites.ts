import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { appConfig, collections, emailConfig, serverConfig } from '@/config';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { db } from '@/lib/firebase/admin';
import { mailer } from '@/lib/email';
import { renderEmail } from '@/lib/email/render';
import { ApiError } from '@/lib/server/api';
import { eventRef } from '@/lib/services/events';
import type { EventDoc, InviteeDoc, InviteeStatus } from '@/types/domain';

/**
 * The invitee list, and sending to it.
 *
 * Two rules shape everything here, and both exist because an invitation product that sends
 * mail is a spam relay if you let it be one:
 *
 *  1. **A host can only send to their own list.** There is no endpoint that takes an
 *     address and a message. You add addresses to an event, and you send *that event's*
 *     invitation to *that list*. The body is generated, never supplied.
 *  2. **Nobody is emailed twice by accident.** Address is the document id (hashed), sends
 *     are recorded, reminders have a cooldown, and an unsubscribe is permanent.
 *
 * A blocked sending domain means nobody's invitations arrive, paying customers included.
 * That is the failure these rules are protecting against.
 */

/**
 * The address is the identity, so it is the document id — which makes "have we already got
 * this person?" a single get and makes double-adding impossible rather than merely
 * unlikely. Hashed because a raw address is not a safe Firestore id, and lower-cased
 * because `Sam@x.com` and `sam@x.com` are one guest.
 */
export function inviteeId(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 32);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function inviteesRef(eventId: string) {
  return eventRef(eventId).collection(collections.invitees);
}

/**
 * Unsubscribe tokens are derived from the address and event, not stored.
 *
 * Nothing extra to leak, nothing to keep in sync, and a token cannot be guessed without the
 * server pepper. Rotating the pepper invalidates every outstanding link, which is the
 * correct behaviour if it ever leaks.
 */
export function unsubscribeToken(eventId: string, email: string): string {
  return createHmac('sha256', serverConfig().joinCodePepper)
    .update(`unsubscribe:${eventId}:${normalizeEmail(email)}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyUnsubscribeToken(eventId: string, email: string, presented: string): boolean {
  const expected = Buffer.from(unsubscribeToken(eventId, email));
  const given = Buffer.from(presented);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export function unsubscribeUrl(eventId: string, email: string): string {
  const params = new URLSearchParams({
    e: eventId,
    a: normalizeEmail(email),
    t: unsubscribeToken(eventId, email),
  });
  return `${appConfig.siteUrl}/unsubscribe?${params.toString()}`;
}

export interface AddInviteesResult {
  added: number;
  duplicates: number;
  /** Addresses refused because the guest previously unsubscribed. */
  blocked: number;
  total: number;
}

/**
 * Adds addresses to an event's list. Idempotent: re-pasting the same block adds nobody
 * twice and reports how many were already there.
 */
export async function addInvitees(
  event: EventDoc,
  entries: { email: string; name: string }[],
): Promise<AddInviteesResult> {
  if (entries.length > emailConfig.maxInviteesPerRequest) {
    throw new ApiError(
      'bad_request',
      `That is more than ${emailConfig.maxInviteesPerRequest} addresses at once. Add them in smaller batches.`,
    );
  }

  const existing = await inviteesRef(event.id).count().get();
  const cap = Math.min(entitlementsFor(event.plan).maxGuests, emailConfig.maxInviteesPerEvent);

  // Deduplicate within the request before counting against the cap, so pasting the same
  // address three times does not consume three slots.
  const unique = new Map<string, { email: string; name: string }>();
  for (const entry of entries) {
    const normalized = normalizeEmail(entry.email);
    if (!unique.has(normalized)) unique.set(normalized, { email: normalized, name: entry.name });
  }

  if (existing.data().count + unique.size > cap) {
    throw new ApiError(
      'conflict',
      `That would take the list past ${cap} guests, which is this event's limit.`,
    );
  }

  let added = 0;
  let duplicates = 0;
  let blocked = 0;
  const now = Date.now();
  const batch = db().batch();

  for (const entry of unique.values()) {
    const reference = inviteesRef(event.id).doc(inviteeId(entry.email));
    const snapshot = await reference.get();

    if (snapshot.exists) {
      // Someone who opted out stays opted out. Re-adding them must not undo that.
      if ((snapshot.data() as InviteeDoc).status === 'unsubscribed') blocked += 1;
      else duplicates += 1;
      continue;
    }

    const invitee: InviteeDoc = {
      id: reference.id,
      email: entry.email,
      name: entry.name,
      status: 'pending',
      addedAt: now,
      lastSentAt: null,
      sendCount: 0,
      lastError: null,
    };
    batch.set(reference, invitee);
    added += 1;
  }

  await batch.commit();
  return { added, duplicates, blocked, total: existing.data().count + added };
}

export async function listInvitees(eventId: string): Promise<InviteeDoc[]> {
  const snapshot = await inviteesRef(eventId)
    .orderBy('addedAt', 'asc')
    .limit(emailConfig.maxInviteesPerEvent)
    .get();
  return snapshot.docs.map((doc) => doc.data() as InviteeDoc);
}

export async function removeInvitee(eventId: string, id: string): Promise<void> {
  await inviteesRef(eventId).doc(id).delete();
}

/** Marks an address as opted out. Permanent, and survives being re-added. */
export async function unsubscribe(eventId: string, email: string): Promise<void> {
  await inviteesRef(eventId)
    .doc(inviteeId(email))
    .set(
      { status: 'unsubscribed' satisfies InviteeStatus, unsubscribedAt: Date.now() },
      { merge: true },
    );
}

export interface SendSummary {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Sends the invitation, or a reminder, to everyone eligible.
 *
 * "Eligible" is doing real work: never someone who unsubscribed, never someone who already
 * replied when it is a reminder, and never someone nudged within the cooldown. A reminder
 * that arrives twice in a morning costs a guest's goodwill and our sending reputation.
 *
 * Sends are sequential rather than parallel. A batch of two hundred fired at once is what
 * rate-limits at the provider look like, and the difference to the host is a few seconds.
 */
export async function sendToInvitees(
  event: EventDoc,
  kind: 'invitation' | 'reminder',
  repliedAddresses: ReadonlySet<string>,
): Promise<SendSummary> {
  const invitees = await listInvitees(event.id);
  const now = Date.now();
  const summary: SendSummary = { attempted: 0, sent: 0, failed: 0, skipped: 0 };

  for (const invitee of invitees) {
    if (!isEligible(invitee, kind, repliedAddresses, now)) {
      summary.skipped += 1;
      continue;
    }

    const rendered = renderEmail(kind, {
      event,
      unsubscribeUrl: unsubscribeUrl(event.id, invitee.email),
      guestName: invitee.name || undefined,
    });

    summary.attempted += 1;
    const result = await mailer().send({
      to: invitee.email,
      fromName: `${event.hostedBy} ${emailConfig.fromNameSuffix}`,
      replyTo: undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      unsubscribeUrl: unsubscribeUrl(event.id, invitee.email),
      kind,
      eventId: event.id,
    });

    // Loosely typed because sendCount is a FieldValue increment, not a number.
    const update: Record<string, unknown> = result.ok
      ? {
          status: 'sent' satisfies InviteeStatus,
          lastSentAt: now,
          sendCount: FieldValue.increment(1),
          lastError: null,
        }
      : { status: 'failed' satisfies InviteeStatus, lastError: result.error ?? 'Send failed.' };

    await inviteesRef(event.id).doc(invitee.id).update(update);
    if (result.ok) summary.sent += 1;
    else summary.failed += 1;
  }

  return summary;
}

function isEligible(
  invitee: InviteeDoc,
  kind: 'invitation' | 'reminder',
  repliedAddresses: ReadonlySet<string>,
  now: number,
): boolean {
  if (invitee.status === 'unsubscribed') return false;

  if (kind === 'invitation') {
    // The invitation goes once. Sending it again is what the reminder is for.
    return invitee.status === 'pending' || invitee.status === 'failed';
  }

  if (repliedAddresses.has(invitee.email)) return false;
  if (invitee.lastSentAt !== null && now - invitee.lastSentAt < emailConfig.reminderCooldownMs) {
    return false;
  }
  return true;
}

/**
 * Sends the "you're on the list" confirmation.
 *
 * Best-effort and fire-and-forget from the caller's point of view: a guest who has just
 * tapped "Going" should see that succeed even if our mail provider is having a bad minute.
 */
export async function sendRsvpConfirmation(
  event: EventDoc,
  email: string,
  guestName: string,
): Promise<void> {
  const rendered = renderEmail('rsvpConfirmation', { event, guestName });
  await mailer().send({
    to: normalizeEmail(email),
    fromName: `${event.hostedBy} ${emailConfig.fromNameSuffix}`,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    kind: 'rsvpConfirmation',
    eventId: event.id,
  });
}
