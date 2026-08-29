import 'server-only';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import {
  absoluteMaxEventLifetimeMs,
  activePromo,
  bestPlan,
  collections,
  defaultTemplateId,
  docIds,
  expiryPresets,
  isEnabled,
  occasionById,
  previewPlanId,
  serverConfig,
  hostAssignableEventRoles,
  type EventRole,
  type TemplateId,
  type ExpiryPresetId,
  type OccasionId,
  type PlanId,
} from '@/config';
import { canUseExpiryPreset, canUseTemplate, entitlementsFor } from '@/lib/billing/entitlements';
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
  return Math.min(preset.ms, absoluteMaxEventLifetimeMs);
}

/**
 * Which plan a new event is created on — and, because that answer is written onto the event
 * and never recomputed, the only place the question is ever asked.
 *
 * Three things can raise it, and all three are resolved here, once:
 *
 *  - the host's own subscription, so a Pro subscriber's events start on Pro;
 *  - **preview pricing**, which grants everyone the preview plan while billing is off. This
 *    used to be applied at read time by `effectivePlanId()`, which meant turning billing on
 *    would have silently downgraded every event ever created. Granting it here instead makes
 *    it a fact on the document, so flipping the flag changes only what happens next;
 *  - **an active promo**, on the same terms and for the same reason.
 *
 * Always the most generous of the three: a promo must never quietly downgrade a subscriber
 * who is already paying for more than it grants.
 *
 * The promo id comes back with the plan so the caller can record it. A promo whose events
 * cannot be told apart afterwards is a cost with no way to find out whether it worked.
 */
export async function planForNewEvent(
  actor: Actor,
  occasionId: string,
): Promise<{ planId: PlanId; promoId: string | null }> {
  const { accountPlan } = await import('@/lib/services/billing');
  let planId = await accountPlan(actor.uid);

  // Nothing is being charged yet, so everything is granted the preview plan. Gating an
  // unproven product measures nothing except how quickly people leave.
  if (!isEnabled('billing')) planId = bestPlan(planId, previewPlanId);

  const promo = activePromo(occasionId);
  if (promo) planId = bestPlan(planId, promo.grantsPlanId);

  // Named only when it actually changed the outcome — a promo that granted less than the
  // host already had did not cause this event, and recording it would make the numbers lie.
  const promoId = promo && promo.grantsPlanId === planId ? promo.id : null;

  return { planId, promoId };
}

/**
 * Refuses a paid choice on an unpaid plan.
 *
 * Checked here rather than in the schema because the schema does not know whose event it
 * is. Messages name the specific thing that was refused — a host who picked a premium
 * theme should be told that, not handed a generic upgrade wall.
 */
function assertPlanAllows(
  planId: PlanId,
  choices: {
    templateId?: string;
    expiryPresetId?: string;
    askNote?: boolean;
    question?: string | null;
  },
): void {
  if (choices.templateId && !canUseTemplate(planId, choices.templateId)) {
    throw new ApiError('forbidden', 'That invitation theme is part of a paid plan.');
  }
  if (
    choices.expiryPresetId &&
    !canUseExpiryPreset(planId, choices.expiryPresetId as ExpiryPresetId)
  ) {
    throw new ApiError('forbidden', 'Keeping the wall live that long is part of a paid plan.');
  }
  const entitlements = entitlementsFor(planId);
  if (choices.askNote && !entitlements.rsvpNotes) {
    throw new ApiError('forbidden', 'Collecting notes with an RSVP is part of a paid plan.');
  }
  if (choices.question && !entitlements.rsvpCustomQuestion) {
    throw new ApiError('forbidden', 'Custom RSVP questions are part of a paid plan.');
  }
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
    templateId: event.templateId,
    occasion: event.occasion,
    status: effectiveStatus(event),
    expiresAt: event.expiresAt,
    startsAt: event.startsAt,
    timeZone: event.timeZone ?? null,
    hostedBy: event.hostedBy,
    memberCount: event.memberCount,
  };
}

/** A member document for someone who has just arrived and not yet replied. */
function newMember(actor: Actor, role: MemberDoc['role'], displayName?: string): MemberDoc {
  return {
    uid: actor.uid,
    displayName: displayName || actor.displayName,
    photoUrl: actor.photoUrl,
    role,
    joinedAt: Date.now(),
    mutedAt: null,
    isAnonymous: actor.isAnonymous,
    rsvp: { status: 'pending', partySize: 1, adults: 1, children: 0, respondedAt: null },
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
  /** The promo that decided this event's plan, if one did. For the audit trail. */
  promoId: string | null;
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

  const { planId: plan, promoId } = await planForNewEvent(actor, input.occasion);
  const entitlements = entitlementsFor(plan);
  assertPlanAllows(plan, {
    templateId: input.templateId,
    expiryPresetId: input.expiryPresetId,
    askNote: input.rsvp.askNote,
    question: input.rsvp.question,
  });

  const activeCount = await countActiveEventsForHost(actor.uid);
  if (activeCount >= entitlements.maxActiveEvents) {
    throw new ApiError(
      'conflict',
      `You already have ${entitlements.maxActiveEvents} live events. End one first, or move to a plan that allows more.`,
    );
  }

  const now = Date.now();
  const expiresAt = now + expiryMsFor(input.expiryPresetId);
  const reference = db().collection(collections.events).doc();
  const occasion = occasionById(input.occasion);

  const document: Omit<EventDoc, 'id'> = {
    title: input.title,
    description: input.description,
    occasion: input.occasion as OccasionId,
    hostUid: actor.uid,
    hostName: actor.displayName,
    hostedBy: input.hostedBy || actor.displayName,
    templateId: (input.templateId as TemplateId) ?? occasion.defaultTemplateId ?? defaultTemplateId,
    status: 'live',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timeZone: input.timeZone ?? null,
    location:
      input.location && (input.location.name || input.location.address) ? input.location : null,
    dressCode: input.dressCode,
    rsvp: {
      enabled: input.rsvp.enabled,
      deadline: input.rsvp.deadline,
      allowPlusOnes: input.rsvp.allowPlusOnes,
      maxPartySize: input.rsvp.allowPlusOnes ? input.rsvp.maxPartySize : 1,
      askNote: input.rsvp.askNote,
      question: input.rsvp.question,
      autoRemind: input.rsvp.autoRemind,
    },
    // The host counts as going: they are, after all, hosting.
    rsvpTally: { yes: 1, no: 0, maybe: 0, pending: 0, attending: 1 },
    settings: {
      whoCanPost: input.whoCanPost,
      allowedKinds: input.allowedKinds,
    },
    plan,
    createdAt: now,
    expiresAt,
    endedAt: null,
    remindersSent: [],
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
      ...newMember(actor, 'host'),
      rsvp: { status: 'yes', partySize: 1, adults: 1, children: 0, respondedAt: now },
    };
    transaction.set(reference.collection(collections.members).doc(actor.uid), hostMember);
    return code;
  });

  return { event: { ...document, id: reference.id }, joinCode, promoId };
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

/**
 * The events someone hosts, newest first.
 *
 * The whole reason an account exists: a host who comes back on a different device has to
 * find what they already made. Without this there is nothing to return to, and "sign in"
 * asks for a commitment the product never repays.
 *
 * Ordered by creation rather than by event date, because a host looking for one they made
 * is thinking about when they made it, and half of these have no date at all.
 */
export async function listEventsForHost(uid: string, limit: number): Promise<EventDoc[]> {
  const snapshot = await db()
    .collection(collections.events)
    .where('hostUid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({ ...(doc.data() as Omit<EventDoc, 'id'>), id: doc.id }));
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
    if (memberCount >= entitlementsFor(event.plan).maxGuests) {
      throw new ApiError('conflict', 'This guest list is full.');
    }

    // A signed-in visitor becomes a member and can post; an anonymous one can only watch,
    // unless the host opened posting to anyone holding the code *and* the platform allows it.
    const anonymousMayPost =
      event.settings.whoCanPost === 'anyone' && isEnabled('allowAnonymousPosting');
    const role: MemberDoc['role'] = actor.isAnonymous && !anonymousMayPost ? 'viewer' : 'member';

    transaction.set(memberRef, newMember(actor, role, displayName));
    transaction.update(eventRef(event.id), {
      memberCount: FieldValue.increment(1),
      'rsvpTally.pending': FieldValue.increment(1),
    });
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

export async function assignMemberRole(
  event: EventDoc,
  targetUid: string,
  newRole: EventRole,
  actor: Actor,
): Promise<{ previousRole: EventRole; newRole: EventRole }> {
  if (!hostAssignableEventRoles.includes(newRole)) {
    throw new ApiError('bad_request', `Cannot assign role '${newRole}'.`);
  }

  // The primary host of the event cannot be demoted
  if (targetUid === event.hostUid) {
    throw new ApiError('forbidden', 'The primary event creator cannot be demoted.');
  }

  // Caller cannot change their own role
  if (targetUid === actor.uid) {
    throw new ApiError('bad_request', 'You cannot change your own role.');
  }

  const memberDocumentRef = eventRef(event.id).collection(collections.members).doc(targetUid);
  const snap = await memberDocumentRef.get();
  if (!snap.exists) {
    throw new ApiError('not_found', 'That person is not a member of this event.');
  }

  const member = snap.data() as MemberDoc;
  if (member.isAnonymous && (newRole === 'cohost' || newRole === 'moderator')) {
    throw new ApiError(
      'bad_request',
      'An anonymous guest must sign in with an account before being made a co-host or moderator.',
    );
  }

  const previousRole = member.role;
  await memberDocumentRef.update({
    role: newRole,
    roleUpdatedAt: Date.now(),
    roleAssignedBy: actor.uid,
  });

  return { previousRole, newRole };
}
