import 'server-only';
import { collections } from '@/config';
import { db } from '@/lib/firebase/admin';
import type { Actor, AuditLogDoc } from '@/types/domain';

/**
 * Append-only audit trail. Written for every privileged action from v1, before the admin
 * console exists — a log that starts when the console ships would have no history to show,
 * and retrofitting call sites is how gaps get left behind.
 *
 * Clients cannot read this collection (see firestore.rules); the phase-2 console reads it
 * through an admin API so that reading the log is itself an auditable action.
 */

export const AUDIT_ACTIONS = [
  'event.create',
  'event.update',
  'event.end',
  'event.extend',
  'event.delete',
  'event.join',
  'event.joinFailed',
  'event.codeViewed',
  'event.codeRotated',
  'rsvp.respond',
  'rsvp.change',
  'rsvp.export',
  'post.create',
  'post.delete',
  'member.mute',
  'member.remove',
  'user.roleGranted',
  'user.suspended',
  'system.cleanup',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  action: AuditAction;
  targetType: AuditLogDoc['targetType'];
  targetId: string;
  eventId?: string | null;
  metadata?: AuditLogDoc['metadata'];
}

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

/**
 * Never throws. An audit write failing must not take a user's action down with it — the
 * failure is surfaced on the server console and the request continues.
 */
export async function recordAudit(
  actor: Pick<Actor, 'uid' | 'role'>,
  entry: AuditEntry,
  request: RequestContext,
): Promise<void> {
  try {
    const document: Omit<AuditLogDoc, 'id'> = {
      actorUid: actor.uid,
      actorRole: actor.role,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      eventId: entry.eventId ?? null,
      metadata: entry.metadata ?? {},
      ip: request.ip,
      userAgent: request.userAgent ? request.userAgent.slice(0, 400) : null,
      at: Date.now(),
    };
    await db().collection(collections.auditLogs).add(document);
  } catch (error) {
    console.error('[audit] failed to record entry', entry.action, error);
  }
}
