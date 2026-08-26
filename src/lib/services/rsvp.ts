import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { collections, occasionById, type RsvpStatus } from '@/config';
import { entitlementsFor } from '@/lib/billing/entitlements';
import { db } from '@/lib/firebase/admin';
import { ApiError } from '@/lib/server/api';
import { eventRef } from '@/lib/services/events';
import type { Actor, EventDoc, MemberDoc, RsvpNoteDoc, RsvpTally } from '@/types/domain';
import type { RsvpInput } from '@/lib/validation/schemas';

/**
 * RSVPs.
 *
 * A reply is two pieces of data with two different audiences. The answer and the headcount
 * are public to the guest list — that is the point of a guest list. The note and the answer
 * to the host's custom question are addressed to the host, so they live in a separate
 * subcollection no other guest can read. Firestore rules cannot restrict a single field,
 * so the split has to be structural.
 *
 * The tally on the event is maintained transactionally rather than counted on read: a host
 * refreshing the guest list during a party should not trigger a scan of five hundred
 * member documents.
 */

export function rsvpNoteRef(eventId: string, uid: string) {
  return eventRef(eventId).collection(collections.rsvpNotes).doc(uid);
}

function memberRef(eventId: string, uid: string) {
  return eventRef(eventId).collection(collections.members).doc(uid);
}

/** Tally deltas for a status change. Returns the fields to increment. */
function tallyDelta(
  previous: RsvpStatus,
  next: RsvpStatus,
  previousParty: number,
  nextParty: number,
): Record<string, FirebaseFirestore.FieldValue> {
  const delta: Record<string, FirebaseFirestore.FieldValue> = {};

  if (previous !== next) {
    delta[`rsvpTally.${previous}`] = FieldValue.increment(-1);
    delta[`rsvpTally.${next}`] = FieldValue.increment(1);
  }

  // "attending" counts heads, not replies, so it moves when either the answer or the
  // party size changes.
  const previousHeads = previous === 'yes' ? previousParty : 0;
  const nextHeads = next === 'yes' ? nextParty : 0;
  if (previousHeads !== nextHeads) {
    delta['rsvpTally.attending'] = FieldValue.increment(nextHeads - previousHeads);
  }

  return delta;
}

export interface RsvpOutcome {
  status: RsvpStatus;
  partySize: number;
  /** True when the guest was changing an answer rather than giving a first one. */
  changed: boolean;
}

/**
 * Records a reply.
 *
 * Idempotent and re-runnable: a guest who changes their mind three times leaves a correct
 * tally each time, because the delta is computed from what their member document currently
 * says rather than from what the client claims it said.
 */
export async function submitRsvp(
  actor: Actor,
  event: EventDoc,
  input: RsvpInput,
): Promise<RsvpOutcome> {
  if (!event.rsvp.enabled) {
    throw new ApiError('forbidden', 'This invitation is not taking replies.');
  }
  if (event.rsvp.deadline !== null && Date.now() > event.rsvp.deadline) {
    throw new ApiError('gone', 'The date for replies has passed. Message the host directly.');
  }

  const allowedParty = event.rsvp.allowPlusOnes ? event.rsvp.maxPartySize : 1;
  if (input.partySize > allowedParty) {
    throw new ApiError(
      'bad_request',
      allowedParty === 1
        ? 'This invitation is for one person.'
        : `This invitation covers up to ${allowedParty} people.`,
    );
  }

  // Someone who says no or maybe is not bringing anyone, whatever the form submitted.
  const status = input.status as Exclude<RsvpStatus, 'pending'>;
  const partySize = status === 'yes' ? input.partySize : 1;
  const entitlements = entitlementsFor(event.plan);
  const now = Date.now();

  const outcome = await db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(memberRef(event.id, actor.uid));
    if (!snapshot.exists) throw new ApiError('forbidden', 'Open the invitation first.');

    const member = snapshot.data() as MemberDoc;
    const previous = member.rsvp?.status ?? 'pending';
    const previousParty = member.rsvp?.partySize ?? 1;

    transaction.update(memberRef(event.id, actor.uid), {
      'rsvp.status': status,
      'rsvp.partySize': partySize,
      'rsvp.respondedAt': now,
      ...(input.displayName ? { displayName: input.displayName } : {}),
    });

    const delta = tallyDelta(previous, status, previousParty, partySize);
    if (Object.keys(delta).length > 0) transaction.update(eventRef(event.id), delta);

    return { previous, changed: previous !== 'pending' };
  });

  // Notes are written outside the transaction: they are not part of any count, and a
  // failure here should not roll back a reply the guest has already been thanked for.
  const note = entitlements.rsvpNotes ? input.note : '';
  const answer = entitlements.rsvpCustomQuestion && event.rsvp.question ? input.answer : '';

  if (note || answer) {
    const document: RsvpNoteDoc = {
      uid: actor.uid,
      displayName: input.displayName || actor.displayName,
      note,
      answer,
      updatedAt: now,
    };
    await rsvpNoteRef(event.id, actor.uid).set(document);
  } else {
    await rsvpNoteRef(event.id, actor.uid)
      .delete()
      .catch(() => undefined);
  }

  return { status, partySize, changed: outcome.changed };
}

export interface GuestEntry {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  role: MemberDoc['role'];
  status: RsvpStatus;
  partySize: number;
  respondedAt: number | null;
  isAnonymous: boolean;
  /** Present only for hosts, moderators and staff. */
  note?: string;
  answer?: string;
}

/**
 * The guest list.
 *
 * `includePrivate` is decided by the caller's permissions, never by a request parameter —
 * the notes are fetched only when it is true, so an ordinary guest's response does not
 * even contain the field to leak.
 */
export async function listGuests(eventId: string, includePrivate: boolean): Promise<GuestEntry[]> {
  const snapshot = await eventRef(eventId)
    .collection(collections.members)
    .orderBy('joinedAt', 'asc')
    .limit(500)
    .get();

  const notes = includePrivate ? await loadNotes(eventId) : new Map<string, RsvpNoteDoc>();

  return snapshot.docs.map((doc) => {
    const member = doc.data() as MemberDoc;
    const entry: GuestEntry = {
      uid: member.uid,
      displayName: member.displayName,
      photoUrl: member.photoUrl,
      role: member.role,
      status: member.rsvp?.status ?? 'pending',
      partySize: member.rsvp?.partySize ?? 1,
      respondedAt: member.rsvp?.respondedAt ?? null,
      isAnonymous: member.isAnonymous,
    };

    if (includePrivate) {
      const note = notes.get(member.uid);
      entry.note = note?.note ?? '';
      entry.answer = note?.answer ?? '';
    }
    return entry;
  });
}

async function loadNotes(eventId: string): Promise<Map<string, RsvpNoteDoc>> {
  const snapshot = await eventRef(eventId).collection(collections.rsvpNotes).limit(500).get();
  return new Map(snapshot.docs.map((doc) => [doc.id, doc.data() as RsvpNoteDoc]));
}

/** Recomputes the tally from scratch. For repair, not for the read path. */
export async function recomputeTally(eventId: string): Promise<RsvpTally> {
  const snapshot = await eventRef(eventId).collection(collections.members).get();
  const tally: RsvpTally = { yes: 0, no: 0, maybe: 0, pending: 0, attending: 0 };

  for (const doc of snapshot.docs) {
    const member = doc.data() as MemberDoc;
    const status = member.rsvp?.status ?? 'pending';
    tally[status] += 1;
    if (status === 'yes') tally.attending += member.rsvp?.partySize ?? 1;
  }

  await eventRef(eventId).update({ rsvpTally: tally });
  return tally;
}

/** CSV of the guest list. A paid entitlement, checked by the caller. */
export function guestsToCsv(guests: GuestEntry[], event: EventDoc): string {
  const occasion = occasionById(event.occasion);
  const header = ['Name', 'Reply', 'Party size', 'Replied at', 'Note', occasion.label + ' answer'];

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = guests.map((guest) =>
    [
      guest.displayName,
      guest.status,
      String(guest.partySize),
      guest.respondedAt ? new Date(guest.respondedAt).toISOString() : '',
      guest.note ?? '',
      guest.answer ?? '',
    ]
      .map(escape)
      .join(','),
  );

  return [header.map(escape).join(','), ...rows].join('\n');
}
