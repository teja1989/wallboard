/**
 * Every action the audit trail knows how to record.
 *
 * A closed union rather than a free-form string, for the same reason the funnel's event names
 * are: an action nobody can spell wrong is an action a console can filter on, and a log with
 * `post.delete` and `post.deleted` in it answers no question correctly.
 *
 * It lives in config rather than beside `recordAudit` because the writer is `server-only` and
 * the readers are not: the console renders these names, and a test wants to assert that a new
 * privileged action arrived with an entry for it. A list of constants is not a server secret.
 */
export const AUDIT_ACTIONS = [
  'event.create',
  'event.update',
  'event.end',
  'event.extend',
  'event.delete',
  'event.archive',
  'event.join',
  'event.joinFailed',
  'event.codeViewed',
  'event.codeRotated',
  'rsvp.respond',
  'rsvp.change',
  'rsvp.export',
  'invite.add',
  'invite.remove',
  'invite.send',
  'invite.remind',
  'invite.unsubscribe',
  'registry.add',
  'registry.remove',
  'billing.checkoutStarted',
  'billing.eventUnlocked',
  'billing.subscriptionActive',
  'billing.subscriptionEnded',
  'post.create',
  'post.delete',
  'member.mute',
  'member.remove',
  'member.roleAssigned',
  'user.renamed',
  'user.roleGranted',
  'user.suspended',
  'user.unsuspended',
  /*
    Reading the log is itself in the log.

    Every other action here is something done *to* somebody. This one is a read, and it is
    recorded anyway because the audit trail contains the shape of what every host and guest has
    been doing, so an operator paging through it should leave the same trace as an operator
    suspending an account. `docs/SECURITY.md` has said so since v1; this is the entry it was
    describing.
  */
  'admin.auditViewed',
  'system.cleanup',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
