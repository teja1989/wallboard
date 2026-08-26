import 'server-only';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import {
  collections,
  defaultEventThemeId,
  docIds,
  eventLimits,
  expiryPresets,
  isEnabled,
  maxEventLifetimeMs,
  serverConfig,
  type EventThemeId,
  type ExpiryPresetId,
} from '@/config';
import { generateJoinCode, hashJoinCode } from '@/lib/codes';
import { db } from '@/lib/firebase/admin';
import { ApiError } from '@/lib/server/api';
import type { Actor, EventDoc, EventPreview, EventStatus, MemberDoc } from '@/types/domain';
import type { CreateEventInput } from '@/lib/validation/schemas';

/**
 * Event lifecycle. Reads and writes that more than one route needs live here rather than
 * being duplicated per handler, so invariants (counters, expiry, code uniqueness) hold
 * everywhere.
 */

export function expiryMsFor(presetId: string): number {
  const preset = expiryPresets.find((p) => p.id === presetId);
  if (!preset) throw new ApiError('bad_request', 'Unknown expiry option.');
  return Math.min(preset.ms, maxEventLifetimeMs);
}

/** Status derived from the clock, so a lapsed event reads as expired without a sweep. */
export function effectiveStatus(event: Pick<EventDoc, 'status' | 'expiresAt'>): EventStatus {
  if (event.status === 'ended') return 'ended';
  return Date.now() >= event.expiresAt ? 'expired' : event.status;
}

export function isAcceptingPosts(event: EventDoc): boolean {
  return effectiveStatus(event) === 'live';
}

export function eventRef(eventId: string) {
  return db().collection(collections.events).doc(eventId);
}

export function joinCodeRef(codeHash: string) {
  return db().collection(collections.joinCodes).doc(codeHash);
}

export function privateJoinCodeRef(eventId: string) {
  return eventRef(eventId).collection(collections.private).doc(docIds.joinCode);
}

export async function getEvent(eventId: string): Promise<EventDoc | null> {
  const snapshot = await eventRef(eventId).get();
  if (!snapshot.exists) return null;
  return { ...(snapshot.data() as Omit<EventDoc, 'id'>), id: snapshot.id };
}

export async function requireEvent(eventId: string): Promise<EventDoc> {
  const event = await getEvent(eventId);
  if (!event) throw new ApiError('not_found', 'That event does not exist.');
  return event;
}

/** Requires an event that is still accepting changes. */
export async function requireLiveEvent(eventId: string): Promise<EventDoc> {
  const event = await requireEvent(eventId);
  const status = effectiveStatus(event);
  if (status !== 'live') {
    throw new ApiError(
      'gone',
      status === 'ended' ? 'This event has ended.' : 'This event has expired.',
    );
  }
  return event;
}

/** Everything a not-yet-member may learn about an event. */
export function toPreview(event: EventDoc): EventPreview {
  return {
    id: event.id,
    title: event.title,
    themeId: event.themeId,
    status: effectiveStatus(event),
    expiresAt: event.expiresAt,
    hostName: event.hostName,
    memberCount: event.memberCount,
  };
}

/**
 * Allocates a join code, retrying on the (vanishingly unlikely) collision. The uniqueness
 * check and the reservation happen in one transaction so two concurrent creates cannot
 * claim the same code.
 */
async function reserveJoinCode(
  transaction: Transaction,
  eventId: string,
  expiresAt: number,
): Promise<string> {
  const pepper = serverConfig().joinCodePepper;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateJoinCode();
    const reference = joinCodeRef(hashJoinCode(code, pepper));
    const existing = await transaction.get(reference);
    if (existing.exists) continue;
    transaction.set(reference, { eventId, expiresAt: new Date(expiresAt), createdAt: Date.now() });
    return code;
  }
  throw new ApiError('server_error', 'Could not allocate a code. Try again.');
}

export interface CreatedEvent {
  event: EventDoc;
  joinCode: string;
}

/**
 * A host may only open posting to anonymous visitors when the platform allows it. Checked
 * on the way in so an event can never be stored in a state the policy engine would refuse
 * to honour.
 */
export function assertWhoCanPostAllowed(whoCanPost: 'members' | 'anyone'): void {
  if (whoCanPost === 'anyone' && !isEnabled('allowAnonymousPosting')) {
    throw new ApiError('forbidden', 'Posting without an account is turned off on this instance.');
  }
}

export async function createEvent(actor: Actor, input: CreateEventInput): Promise<CreatedEvent> {
  assertWhoCanPostAllowed(input.whoCanPost);
  const activeCount = await countActiveEventsForHost(actor.uid);
  if (activeCount >= eventLimits.maxActiveEventsPerHost) {
    throw new ApiError(
      'conflict',
      `You already have ${eventLimits.maxActiveEventsPerHost} live events. End one first.`,
    );
  }

  const now = Date.now();
  const expiresAt = now + expiryMsFor(input.expiryPresetId);
  const reference = db().collection(collections.events).doc();

  const document: Omit<EventDoc, 'id'> = {
    title: input.title,
    description: input.description,
    hostUid: actor.uid,
    hostName: actor.displayName,
    themeId: (input.themeId as EventThemeId) ?? defaultEventThemeId,
    status: 'live',
    settings: {
      whoCanPost: input.whoCanPost,
      allowedKinds: input.allowedKinds,
      moderated: false,
    },
    createdAt: now,
    expiresAt,
    endedAt: null,
    memberCount: 1,
    postCount: 0,
    storageBytes: 0,
  };

  const joinCode = await db().runTransaction(async (transaction) => {
    const code = await reserveJoinCode(transaction, reference.id, expiresAt);
    transaction.set(reference, { ...document, expiresAtTtl: new Date(expiresAt) });
    transaction.set(privateJoinCodeRef(reference.id), {
      code,
      codeHash: hashJoinCode(code, serverConfig().joinCodePepper),
      createdAt: now,
      rotatedAt: null,
    });
    const hostMember: MemberDoc = {
      uid: actor.uid,
      displayName: actor.displayName,
      photoUrl: actor.photoUrl,
      role: 'host',
      joinedAt: now,
      mutedAt: null,
      isAnonymous: actor.isAnonymous,
    };
    transaction.set(reference.collection(collections.members).doc(actor.uid), hostMember);
    return code;
  });

  return { event: { ...document, id: reference.id }, joinCode };
}

async function countActiveEventsForHost(uid: string): Promise<number> {
  const snapshot = await db()
    .collection(collections.events)
    .where('hostUid', '==', uid)
    .where('status', '==', 'live')
    .where('expiresAt', '>', Date.now())
    .count()
    .get();
  return snapshot.data().count;
}

/** Resolves a plaintext code to its event, or null. Never reveals which half failed. */
export async function findEventByCode(code: string): Promise<EventDoc | null> {
  const codeHash = hashJoinCode(code, serverConfig().joinCodePepper);
  const snapshot = await joinCodeRef(codeHash).get();
  if (!snapshot.exists) return null;
  const eventId = String(snapshot.get('eventId') ?? '');
  if (!eventId) return null;
  return getEvent(eventId);
}

export interface JoinOutcome {
  event: EventDoc;
  role: MemberDoc['role'];
  alreadyMember: boolean;
}

/**
 * Adds the actor to an event. Idempotent: re-entering with a code you already redeemed is
 * a no-op that returns your existing role rather than resetting it.
 */
export async function joinEvent(
  actor: Actor,
  event: EventDoc,
  displayName?: string,
): Promise<JoinOutcome> {
  const memberRef = eventRef(event.id).collection(collections.members).doc(actor.uid);

  return db().runTransaction(async (transaction) => {
    const existing = await transaction.get(memberRef);
    if (existing.exists) {
      return { event, role: (existing.data() as MemberDoc).role, alreadyMember: true };
    }

    const eventSnapshot = await transaction.get(eventRef(event.id));
    const memberCount = Number(eventSnapshot.get('memberCount') ?? 0);
    if (memberCount >= eventLimits.maxMembersPerEvent) {
      throw new ApiError('conflict', 'This event is full.');
    }

    // A signed-in visitor becomes a member and can post; an anonymous one can only watch,
    // unless the host opened posting to anyone holding the code *and* the platform allows it.
    const anonymousMayPost =
      event.settings.whoCanPost === 'anyone' && isEnabled('allowAnonymousPosting');
    const role: MemberDoc['role'] = actor.isAnonymous && !anonymousMayPost ? 'viewer' : 'member';

    const member: MemberDoc = {
      uid: actor.uid,
      displayName: displayName || actor.displayName,
      photoUrl: actor.photoUrl,
      role,
      joinedAt: Date.now(),
      mutedAt: null,
      isAnonymous: actor.isAnonymous,
    };
    transaction.set(memberRef, member);
    transaction.update(eventRef(event.id), { memberCount: FieldValue.increment(1) });
    return { event, role, alreadyMember: false };
  });
}

export async function endEvent(eventId: string): Promise<void> {
  await eventRef(eventId).update({ status: 'ended', endedAt: Date.now() });
}

export async function extendEvent(eventId: string, presetId: ExpiryPresetId): Promise<number> {
  const event = await requireEvent(eventId);
  // Extensions run from now, not from the old expiry, so a lapsed event can be revived
  // within the cleanup grace window without inheriting a past deadline.
  const expiresAt = Date.now() + expiryMsFor(presetId);
  await eventRef(eventId).update({
    expiresAt,
    expiresAtTtl: new Date(expiresAt),
    status: event.status === 'ended' ? 'ended' : 'live',
  });
  await privateJoinCodeRef(eventId).get();
  return expiresAt;
}

/** Rotates the code, invalidating the old one immediately. */
export async function rotateJoinCode(eventId: string): Promise<string> {
  const event = await requireEvent(eventId);
  const pepper = serverConfig().joinCodePepper;
  const currentSnapshot = await privateJoinCodeRef(eventId).get();
  const currentHash = currentSnapshot.exists ? String(currentSnapshot.get('codeHash') ?? '') : '';

  return db().runTransaction(async (transaction) => {
    const code = await reserveJoinCode(transaction, eventId, event.expiresAt);
    if (currentHash) transaction.delete(joinCodeRef(currentHash));
    transaction.set(privateJoinCodeRef(eventId), {
      code,
      codeHash: hashJoinCode(code, pepper),
      createdAt: Date.now(),
      rotatedAt: Date.now(),
    });
    return code;
  });
}

export async function readJoinCode(eventId: string): Promise<string> {
  const snapshot = await privateJoinCodeRef(eventId).get();
  const code = snapshot.exists ? String(snapshot.get('code') ?? '') : '';
  if (!code) throw new ApiError('not_found', 'This event has no code.');
  return code;
}
