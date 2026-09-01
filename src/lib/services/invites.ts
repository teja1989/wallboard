import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { appConfig, collections, commsConfig, emailConfig, serverConfig } from '@/config';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { db } from '@/lib/firebase/admin';
import { mailer } from '@/lib/email';
import { renderEmail } from '@/lib/email/render';
import { ApiError } from '@/lib/server/api';
import { eventRef, readJoinCode } from '@/lib/services/events';
import { recordAttempt } from '@/lib/services/delivery';
import { normalizePhone } from '@/lib/phone';
import type { CommsChannel, DeliveryState, EventDoc, InviteeDoc, MemberDoc } from '@/types/domain';

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
 * The id an address *used* to get.
 *
 * Kept because it is the document id of every invitee added before guests could have phone
 * numbers, and because the unsubscribe link derives from the address rather than the id —
 * an opt-out link in a mail sent last month has to keep working.
 */
export function legacyInviteeId(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 32);
}

/**
 * The id a new invitee gets: opaque, and deliberately not derived from anything.
 *
 * Deriving it from the address made "do we already have this person?" a single get, which
 * was neat while an address was the only way to name someone. It also meant a guest who
 * gave you a phone number and an email was two guests, and that a host could not correct a
 * typo without losing everything recorded against it.
 */
function newInviteeId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * The credential in a guest's personal invitation link.
 *
 * Stored rather than derived, unlike the unsubscribe token, because this one has to be
 * revocable: a link that leaks into a group chat should be replaceable without invalidating
 * every other guest's, which a shared pepper cannot do.
 */
export function mintLinkToken(): string {
  return randomBytes(commsConfig.linkTokenBytes).toString('hex');
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
  /** Refused because the guest previously opted out. */
  blocked: number;
  /** Entries carrying neither a usable address nor a dialable number. */
  invalid: number;
  total: number;
}

/** What the host is asking us to add. At least one of email or phone must survive parsing. */
export interface InviteeInput {
  name: string;
  email?: string | null;
  phone?: string | null;
}

/** The channel a guest is reachable on, given what we know about them. */
function channelFor(email: string | null, phone: string | null): CommsChannel {
  if (phone) return 'relay';
  return email ? 'email' : 'relay';
}

/**
 * Adds guests to an event's list.
 *
 * Idempotent by *person*, not by address: someone already on the list by email who is now
 * pasted in with a phone number gains the number rather than becoming a second guest. That
 * is the whole reason the document id stopped being a hash of the address.
 *
 * The existing list is read once up front. The previous version did a `get` per entry
 * inside the loop, which made pasting a hundred addresses a hundred round trips.
 */
export async function addInvitees(
  event: EventDoc,
  entries: InviteeInput[],
): Promise<AddInviteesResult> {
  if (entries.length > emailConfig.maxInviteesPerRequest) {
    throw new ApiError(
      'bad_request',
      `That is more than ${emailConfig.maxInviteesPerRequest} people at once. Add them in smaller batches.`,
    );
  }

  const existing = await listInvitees(event.id);
  const cap = Math.min(entitlementsFor(event.plan).maxGuests, emailConfig.maxInviteesPerEvent);

  const byEmail = new Map(existing.filter((i) => i.email).map((i) => [i.email as string, i]));
  const byPhone = new Map(existing.filter((i) => i.phone).map((i) => [i.phone as string, i]));

  let invalid = 0;

  // Normalise and collapse the request against itself first, so pasting the same person
  // three times does not consume three slots against the cap.
  const unique = new Map<string, InviteeInput & { email: string | null; phone: string | null }>();
  for (const entry of entries) {
    const email = entry.email ? normalizeEmail(entry.email) : null;
    const phone = entry.phone ? normalizePhone(entry.phone) : null;

    if (!email && !phone) {
      invalid += 1;
      continue;
    }

    const key = email ?? (phone as string);
    const already = unique.get(key);
    if (already) {
      // Two lines for one person — take whichever detail each line carried.
      already.email ??= email;
      already.phone ??= phone;
      continue;
    }
    unique.set(key, { name: entry.name, email, phone });
  }

  let added = 0;
  let duplicates = 0;
  let blocked = 0;
  const now = Date.now();
  const batch = db().batch();
  let pendingNew = 0;

  for (const entry of unique.values()) {
    const match =
      (entry.email ? byEmail.get(entry.email) : undefined) ??
      (entry.phone ? byPhone.get(entry.phone) : undefined);

    if (match) {
      // Someone who opted out stays opted out. Re-adding them must not undo that.
      if (match.status === 'unsubscribed') {
        blocked += 1;
        continue;
      }

      // Known person, new detail — fill the gap rather than adding them again.
      const gained: Record<string, unknown> = {};
      if (entry.email && !match.email) gained.email = entry.email;
      if (entry.phone && !match.phone) gained.phone = entry.phone;
      if (entry.name && !match.name) gained.name = entry.name;

      if (Object.keys(gained).length > 0) {
        batch.update(inviteesRef(event.id).doc(match.id), gained);
      }
      duplicates += 1;
      continue;
    }

    if (existing.length + pendingNew >= cap) {
      throw new ApiError(
        'conflict',
        `That would take the list past ${cap} guests, which is this event's limit.`,
      );
    }

    const reference = inviteesRef(event.id).doc(newInviteeId());
    const invitee: InviteeDoc = {
      id: reference.id,
      name: entry.name,
      email: entry.email,
      phone: entry.phone,
      channel: channelFor(entry.email, entry.phone),
      token: mintLinkToken(),
      status: 'pending',
      statusAt: now,
      addedAt: now,
      lastSentAt: null,
      sendCount: 0,
      lastError: null,
      firstViewedAt: null,
      lastViewedAt: null,
      viewCount: 0,
      repliedAt: null,
    };
    batch.set(reference, invitee);
    added += 1;
    pendingNew += 1;
  }

  await batch.commit();
  return { added, duplicates, blocked, invalid, total: existing.length + added };
}

/**
 * The guest list, with anything a older document is missing filled in.
 *
 * Invitees added before guests had phone numbers have no link token, and without one they
 * cannot be tracked or sent a personal link. Rather than a migration script and a
 * maintenance window, the gap is closed the first time the list is read — and only written
 * back when something was actually missing, so the common case stays read-only.
 */
export async function listInvitees(eventId: string): Promise<InviteeDoc[]> {
  const snapshot = await inviteesRef(eventId)
    .orderBy('addedAt', 'asc')
    .limit(emailConfig.maxInviteesPerEvent)
    .get();

  const batch = db().batch();
  let repairs = 0;

  const invitees = snapshot.docs.map((doc) => {
    const raw = doc.data() as Partial<InviteeDoc> & { email?: string | null };
    const patch: Record<string, unknown> = {};

    if (typeof raw.token !== 'string') patch.token = mintLinkToken();
    if (raw.phone === undefined) patch.phone = null;
    if (raw.channel === undefined) patch.channel = channelFor(raw.email ?? null, null);
    if (raw.statusAt === undefined) patch.statusAt = raw.addedAt ?? Date.now();
    if (raw.viewCount === undefined) patch.viewCount = 0;
    if (raw.firstViewedAt === undefined) patch.firstViewedAt = null;
    if (raw.lastViewedAt === undefined) patch.lastViewedAt = null;
    if (raw.repliedAt === undefined) patch.repliedAt = null;

    if (Object.keys(patch).length > 0) {
      batch.update(doc.ref, patch);
      repairs += 1;
    }

    return { ...raw, ...patch, id: doc.id } as InviteeDoc;
  });

  if (repairs > 0) await batch.commit();
  return invitees;
}

/** One guest, by the token their personal link carries. */
export async function findInviteeByToken(
  eventId: string,
  token: string,
): Promise<InviteeDoc | null> {
  const snapshot = await inviteesRef(eventId).where('token', '==', token).limit(1).get();
  const doc = snapshot.docs[0];
  return doc ? { ...(doc.data() as InviteeDoc), id: doc.id } : null;
}

export async function removeInvitee(eventId: string, id: string): Promise<void> {
  await inviteesRef(eventId).doc(id).delete();
}

/**
 * Marks an address as opted out. Permanent, and survives being re-added.
 *
 * When the address is not on the list — a host who already tidied them away — a tombstone
 * is written under the legacy address-derived id anyway. Recording the decision matters
 * more than tidiness, and deriving the id keeps a second unsubscribe idempotent.
 */
export async function unsubscribe(eventId: string, email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const now = Date.now();

  const found = await inviteesRef(eventId).where('email', '==', normalized).limit(1).get();
  const reference = found.docs[0]?.ref ?? inviteesRef(eventId).doc(legacyInviteeId(normalized));

  await reference.set(
    {
      email: normalized,
      status: 'unsubscribed' satisfies DeliveryState,
      statusAt: now,
      unsubscribedAt: now,
    },
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
 * Sends the invitation, or a reminder, to everyone eligible — or to named people.
 *
 * "Eligible" is doing real work: never someone who unsubscribed, never someone who already
 * replied when it is a reminder, and never someone nudged within the cooldown. A reminder
 * that arrives twice in a morning costs a guest's goodwill and our sending reputation.
 *
 * `only` **narrows and cannot widen**. It is applied as a filter over the list this function
 * reads for itself, and `isEligible` still runs on whatever survives — so naming a guest is a
 * way of sending to fewer people, never a way of reaching somebody the rules exclude. An id
 * that is not on this event's list simply matches nothing, which is also why a host cannot use
 * it to probe for ids belonging to another event.
 *
 * Sends are sequential rather than parallel. A batch of two hundred fired at once is what
 * rate-limits at the provider look like, and the difference to the host is a few seconds.
 */
export async function sendToInvitees(
  event: EventDoc,
  kind: 'invitation' | 'reminder',
  repliedAddresses: ReadonlySet<string>,
  only?: readonly string[],
): Promise<SendSummary> {
  const all = await listInvitees(event.id);
  const wanted = only ? new Set(only) : null;
  const invitees = wanted ? all.filter((invitee) => wanted.has(invitee.id)) : all;
  const now = Date.now();
  const summary: SendSummary = { attempted: 0, sent: 0, failed: 0, skipped: 0 };

  // Read once, not per recipient. The message has to carry the code: everyone on this list
  // is by definition not a member yet, and the event itself turns non-members away.
  const joinCode = await readJoinCode(event.id);

  for (const invitee of invitees) {
    // A guest added by phone alone is reachable, just not by us and not yet — the host
    // sends them their link from the relay panel. Skipping them here is not a failure.
    if (!invitee.email || !isEligible(invitee, kind, repliedAddresses, now)) {
      summary.skipped += 1;
      continue;
    }

    const rendered = renderEmail(kind, {
      event,
      unsubscribeUrl: unsubscribeUrl(event.id, invitee.email),
      guestName: invitee.name || undefined,
      joinCode,
      // Their own link, so the view it produces has a name attached to it.
      guestToken: invitee.token,
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

    await recordAttempt(event.id, invitee, {
      channel: 'email',
      kind,
      ok: result.ok,
      providerMessageId: result.id ?? null,
      error: result.error ?? null,
    });

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

  if (invitee.email && repliedAddresses.has(invitee.email)) return false;
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
  /*
    The join code, only so the confirmation can carry an "add to calendar" link — the moment
    someone taps "Going" is the moment they will actually save the date, and the link needs a
    code because the file is served through the invitation route.

    One extra document read on a path that is already making a network call to send mail, and
    best-effort: a confirmation that arrives without the link is fine, one that fails to
    arrive is not. It reveals nothing — the recipient redeemed this very code to reply.
  */
  const joinCode = await readJoinCode(event.id).catch(() => undefined);

  const rendered = renderEmail('rsvpConfirmation', { event, guestName, joinCode });
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

/**
 * Addresses belonging to members who have answered.
 *
 * Matching is by address, which only works for guests who arrived through an emailed
 * invitation and signed in with the same address. Someone who used the code and a different
 * account will still get a nudge — annoying, but the alternative is silently not reminding
 * people who genuinely have not replied, which is worse for the host.
 *
 * Lives here rather than beside the send route because the scheduled reminder needs exactly
 * the same answer, and two copies of "who counts as having replied" is two places for the
 * definition to drift.
 */
export async function repliedAddressesFor(eventId: string): Promise<Set<string>> {
  const snapshot = await eventRef(eventId).collection(collections.members).get();
  const uids = snapshot.docs
    .map((doc) => doc.data() as MemberDoc)
    .filter((member) => (member.rsvp?.status ?? 'pending') !== 'pending')
    .map((member) => member.uid);

  if (uids.length === 0) return new Set();

  const addresses = new Set<string>();
  // Firestore caps an `in` query at 30 values, so this walks in chunks.
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    const users = await db().collection(collections.users).where('uid', 'in', chunk).get();
    for (const doc of users.docs) {
      const email = doc.get('email');
      if (typeof email === 'string' && email) addresses.add(normalizeEmail(email));
    }
  }
  return addresses;
}
