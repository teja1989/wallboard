import 'server-only';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import {
  appConfig,
  collections,
  contentLimits,
  platformRoleRank,
  serverConfig,
  type PlatformRole,
} from '@/config';
import { auth, db } from '@/lib/firebase/admin';
import type { Actor, EventRole, MemberDoc, UserDoc } from '@/types/domain';

/**
 * Session handling.
 *
 * The browser holds a Firebase session cookie, not an ID token: it is httpOnly, so XSS
 * cannot read it, and it is minted server-side from a freshly-issued ID token. Every
 * request re-verifies it and checks revocation, so signing a user out or suspending them
 * takes effect on their next request rather than whenever their token happens to expire.
 */

const SESSION_COOKIE = appConfig.session.cookieName;

export async function createSessionCookie(idToken: string): Promise<{
  value: string;
  maxAgeSeconds: number;
}> {
  const expiresIn = appConfig.session.maxAgeMs;
  const value = await auth().createSessionCookie(idToken, { expiresIn });
  return { value, maxAgeSeconds: Math.floor(expiresIn / 1000) };
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    // __Host- prefixed cookies require secure + path=/ + no domain. Browsers make an
    // exception for http://localhost, so the same name works in development.
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function clearedSessionCookieOptions() {
  return { ...sessionCookieOptions(0), maxAge: 0 };
}

/**
 * Resolves the caller. Returns null for signed-out visitors rather than throwing, so a
 * handler can decide whether anonymous access is acceptable for its own route.
 */
export async function currentActor(): Promise<Actor | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    // checkRevoked forces a lookup against the user record, which is what makes
    // suspension and forced sign-out effective immediately.
    const claims = await auth().verifySessionCookie(sessionCookie, true);
    const isAnonymous = claims.firebase?.sign_in_provider === 'anonymous';
    const profile = await ensureUserRecord({
      uid: claims.uid,
      email: typeof claims.email === 'string' ? claims.email : null,
      displayName: typeof claims.name === 'string' ? claims.name : '',
      photoUrl: typeof claims.picture === 'string' ? claims.picture : null,
      isAnonymous,
      claimedRole: readRoleClaim(claims.role),
    });

    return {
      uid: claims.uid,
      email: profile.email,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl,
      role: profile.role,
      isAnonymous,
      suspended: profile.suspendedAt !== null,
    };
  } catch {
    // Expired, revoked, or tampered-with. Indistinguishable to the caller on purpose.
    return null;
  }
}

function readRoleClaim(claim: unknown): PlatformRole {
  return typeof claim === 'string' && claim in platformRoleRank ? (claim as PlatformRole) : 'user';
}

/** Fallback display name so anonymous visitors are still addressable on the wall. */
function fallbackDisplayName(uid: string, isAnonymous: boolean): string {
  return isAnonymous ? `Guest ${uid.slice(0, 4).toUpperCase()}` : 'Someone';
}

interface EnsureUserInput {
  uid: string;
  email: string | null;
  displayName: string;
  photoUrl: string | null;
  isAnonymous: boolean;
  claimedRole: PlatformRole;
}

/**
 * Reads (and lazily creates) the user's profile document.
 *
 * The custom claim is the authority on role — the Firestore copy is a mirror kept for the
 * admin console's list views, and is never trusted for an authorization decision. Owner
 * bootstrapping is the one exception: an email listed in OWNER_EMAILS is promoted here, so
 * the app has an administrator on first run without a manual claim-setting step.
 */
async function ensureUserRecord(input: EnsureUserInput): Promise<UserDoc> {
  const reference = db().collection(collections.users).doc(input.uid);
  const snapshot = await reference.get();
  const now = Date.now();

  const role = await resolveRole(input);
  const displayName = (
    input.displayName ||
    (snapshot.exists ? String(snapshot.get('displayName') ?? '') : '') ||
    fallbackDisplayName(input.uid, input.isAnonymous)
  ).slice(0, contentLimits.displayNameMaxLength);

  if (!snapshot.exists) {
    const created: UserDoc = {
      uid: input.uid,
      email: input.email,
      displayName,
      photoUrl: input.photoUrl,
      role,
      isAnonymous: input.isAnonymous,
      createdAt: now,
      lastSeenAt: now,
      suspendedAt: null,
      suspendedReason: null,
    };
    await reference.set(created);
    return created;
  }

  const existing = snapshot.data() as UserDoc;
  // Cheap keep-alive; avoids a write on every single request.
  if (now - (existing.lastSeenAt ?? 0) > 5 * 60 * 1000) {
    await reference.update({ lastSeenAt: now, role, displayName, isAnonymous: input.isAnonymous });
  }
  return { ...existing, role, displayName, lastSeenAt: now };
}

/**
 * Promotes a configured owner email to the OWNER role, writing the custom claim so the
 * decision survives into Firestore rules. Anonymous sessions can never be promoted.
 */
async function resolveRole(input: EnsureUserInput): Promise<PlatformRole> {
  if (input.isAnonymous) return 'user';
  const email = input.email?.toLowerCase();
  const shouldBeOwner = !!email && serverConfig().ownerEmails.includes(email);

  if (shouldBeOwner && input.claimedRole !== 'owner') {
    await auth().setCustomUserClaims(input.uid, { role: 'owner' });
    return 'owner';
  }
  return input.claimedRole;
}

/** The actor's role inside one event, or null when they are not a member. */
export async function eventRoleFor(eventId: string, uid: string): Promise<EventRole | null> {
  const snapshot = await db()
    .collection(collections.events)
    .doc(eventId)
    .collection(collections.members)
    .doc(uid)
    .get();
  if (!snapshot.exists) return null;
  return (snapshot.data() as MemberDoc).role;
}

/** Marks a member as active without contending on the member document. */
export async function touchMember(eventId: string, uid: string): Promise<void> {
  await db()
    .collection(collections.events)
    .doc(eventId)
    .collection(collections.members)
    .doc(uid)
    .set({ lastSeenAt: FieldValue.serverTimestamp() }, { merge: true });
}
