import 'server-only';
import { AUDIT_ACTIONS, collections, type AuditAction } from '@/config';
import { db } from '@/lib/firebase/admin';
import type { Actor, AuditLogDoc } from '@/types/domain';

/**
 * Append-only audit trail. Written for every privileged action from v1, before the admin
 * console existed — a log that starts when its console does has nothing to show about the
 * incident that made somebody open it, and retrofitting call sites is how gaps get left
 * behind.
 *
 * Clients cannot read this collection (see firestore.rules); the console reads it through
 * `/api/admin/audit`, which records the read.
 *
 * The action names themselves live in `audit.config.ts`: this module is `server-only`, and the
 * console and its tests need the list.
 */
export { AUDIT_ACTIONS };
export type { AuditAction };

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
