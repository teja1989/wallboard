import 'server-only';
import { adminLimits, collections } from '@/config';
import { db } from '@/lib/firebase/admin';
import type { AuditLogDoc, EventDoc, UserDoc } from '@/types/domain';

/**
 * Reads for the operator console, plus the one write it has.
 *
 * There is no search engine here and there should not be one. These are incident-response
 * queries — somebody has forwarded a complaint with a link or an email address in it, and the
 * job is to turn that into the right document. That is a lookup by id or by exact address,
 * which Firestore does natively, not a relevance-ranked search over a corpus.
 *
 * Free-text over titles is the one place that breaks down, and it is handled by fetching a
 * page and filtering in memory rather than by adding a search product. It is honest about its
 * own limit: it searches the most recent `pageSize` events, and says so on the page. A
 * console that silently searched only part of the data would be worse than one that admits it.
 */

/** Trimmed and lowercased once, so every caller compares the same way. */
function normalise(query: string): string {
  return query.trim().toLowerCase();
}

export interface EventRow {
  id: string;
  title: string;
  occasion: string;
  status: string;
  hostUid: string;
  hostName: string;
  plan: string;
  createdAt: number;
  expiresAt: number;
  memberCount: number;
  postCount: number;
  storageBytes: number;
}

/**
 * A console screen must survive the data being wrong, because a console is the tool somebody
 * reaches for *when* the data is wrong.
 *
 * Two ways a document here is not what the type says. **Phantom parents**: Firestore lists a
 * document id in a collection query when the document itself does not exist but has
 * subcollections underneath it — which is exactly what a deleted event leaves behind while its
 * `funnel` counters are still there. `snapshot.data()` is `undefined` for one of those, and
 * casting it to `EventDoc` and reading `.title` took the whole screen down with a 500. The
 * smoke run caught it on the first pass, and it would have happened in production the first
 * time anyone deleted an event.
 *
 * **Old shapes**: a document written before a field existed simply lacks it. Coercing beats
 * throwing — an operator wants to see the row and its id, not a stack trace.
 */
function toEventRow(id: string, data: Partial<EventDoc> | undefined): EventRow | null {
  if (!data) return null;

  return {
    id,
    title: data.title ?? '(untitled)',
    occasion: data.occasion ?? '—',
    status: data.status ?? '—',
    hostUid: data.hostUid ?? '',
    hostName: data.hostName ?? '—',
    plan: data.plan ?? '—',
    createdAt: data.createdAt ?? 0,
    expiresAt: data.expiresAt ?? 0,
    memberCount: data.memberCount ?? 0,
    postCount: data.postCount ?? 0,
    storageBytes: data.storageBytes ?? 0,
  };
}

/**
 * Events, newest first, optionally narrowed by a query.
 *
 * An exact id match short-circuits to a single document read: the common case is somebody
 * pasting the id out of a URL, and answering that with a fifty-document scan would be silly.
 */
export async function listAllEvents(query = ''): Promise<EventRow[]> {
  const needle = normalise(query);

  if (needle) {
    const direct = await db().collection(collections.events).doc(query.trim()).get();
    const row = direct.exists ? toEventRow(direct.id, direct.data() as EventDoc) : null;
    if (row) return [row];
  }

  const snapshot = await db()
    .collection(collections.events)
    .orderBy('createdAt', 'desc')
    .limit(adminLimits.pageSize)
    .get();

  const rows = snapshot.docs
    .map((document) => toEventRow(document.id, document.data() as EventDoc | undefined))
    .filter((row): row is EventRow => row !== null);
  if (!needle) return rows;

  return rows.filter(
    (row) =>
      row.title.toLowerCase().includes(needle) ||
      row.hostName.toLowerCase().includes(needle) ||
      row.id.toLowerCase().includes(needle),
  );
}

export interface UserRow {
  uid: string;
  email: string | null;
  displayName: string;
  role: string;
  isAnonymous: boolean;
  createdAt: number;
  lastSeenAt: number;
  suspendedAt: number | null;
  suspendedReason: string | null;
}

/** Coerced for the same reason events are — see `toEventRow`. */
function toUserRow(uid: string, data: Partial<UserDoc> | undefined): UserRow | null {
  if (!data) return null;

  return {
    uid,
    email: data.email ?? null,
    displayName: data.displayName ?? '—',
    role: data.role ?? 'user',
    isAnonymous: data.isAnonymous ?? false,
    createdAt: data.createdAt ?? 0,
    lastSeenAt: data.lastSeenAt ?? 0,
    suspendedAt: data.suspendedAt ?? null,
    suspendedReason: data.suspendedReason ?? null,
  };
}

/**
 * Accounts, most recently seen first, optionally narrowed.
 *
 * Email is matched exactly rather than by prefix. A complaint arrives with a whole address on
 * it, and a prefix search over addresses is a feature whose main use is browsing other
 * people's email — which is not a thing this console should make easy even for an operator.
 */
export async function listAllUsers(query = ''): Promise<UserRow[]> {
  const needle = normalise(query);

  if (needle) {
    const byId = await db().collection(collections.users).doc(query.trim()).get();
    const row = byId.exists ? toUserRow(byId.id, byId.data() as UserDoc) : null;
    if (row) return [row];

    if (needle.includes('@')) {
      const byEmail = await db()
        .collection(collections.users)
        .where('email', '==', needle)
        .limit(adminLimits.pageSize)
        .get();
      return byEmail.docs
        .map((document) => toUserRow(document.id, document.data() as UserDoc | undefined))
        .filter((found): found is UserRow => found !== null);
    }
  }

  const snapshot = await db()
    .collection(collections.users)
    .orderBy('lastSeenAt', 'desc')
    .limit(adminLimits.pageSize)
    .get();

  const rows = snapshot.docs
    .map((document) => toUserRow(document.id, document.data() as UserDoc | undefined))
    .filter((row): row is UserRow => row !== null);
  if (!needle) return rows;

  return rows.filter(
    (row) =>
      row.displayName.toLowerCase().includes(needle) ||
      (row.email ?? '').toLowerCase().includes(needle) ||
      row.uid.toLowerCase().includes(needle),
  );
}

export async function getUser(uid: string): Promise<UserRow | null> {
  const snapshot = await db().collection(collections.users).doc(uid).get();
  if (!snapshot.exists) return null;
  return toUserRow(snapshot.id, snapshot.data() as UserDoc | undefined);
}

/**
 * Suspends an account, or lifts a suspension.
 *
 * Two fields and nothing else. Suspension is deliberately not a delete and not a sign-out:
 * `currentActor` re-reads the profile on every request, so this takes effect on the account's
 * very next call without revoking their session — which means they get "this account has been
 * suspended" rather than being silently logged out and left to guess.
 *
 * The reason is stored because a suspension with no reason is unreviewable six weeks later,
 * and lifting one is a normal thing to have to do.
 */
export async function setSuspended(
  uid: string,
  suspended: boolean,
  reason: string,
): Promise<UserRow> {
  const reference = db().collection(collections.users).doc(uid);

  await reference.update({
    suspendedAt: suspended ? Date.now() : null,
    // The reason for the *current* state. Kept on lift as well, so "why was this lifted"
    // has an answer too; the audit log holds the history of both.
    suspendedReason: reason,
  });

  const after = await getUser(uid);
  if (!after) throw new Error(`user ${uid} vanished mid-suspension`);
  return after;
}

export interface AuditQuery {
  /** Narrows to one event, or to one actor. Both use a composite index. */
  eventId?: string;
  actorUid?: string;
}

/**
 * The audit trail, newest first.
 *
 * Written since v1 precisely so that this read would have history behind it the day it
 * shipped rather than starting from empty. Reading it is itself recorded — see the route.
 */
export async function listAudit(filter: AuditQuery = {}): Promise<AuditLogDoc[]> {
  let query = db().collection(collections.auditLogs).orderBy('at', 'desc');

  if (filter.eventId) query = query.where('eventId', '==', filter.eventId);
  else if (filter.actorUid) query = query.where('actorUid', '==', filter.actorUid);

  const snapshot = await query.limit(adminLimits.auditPageSize).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as AuditLogDoc);
}
