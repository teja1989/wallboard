import type { Permission } from './roles.config';

/**
 * The operator's console.
 *
 * This exists because eight `admin:*` permissions were declared and enforced and exactly one
 * of them had a route. `docs/SECURITY.md` told a reader that support can list events and
 * users and that an admin can read the audit log and suspend people — none of which was
 * reachable from anywhere. `Actor.suspended` was checked on every write in `server/api.ts`
 * and nothing in the product could set it, which made the abuse response for launch day
 * "open the Firestore console and edit a document by hand".
 *
 * What it deliberately is not: a place to change the product. No feature-flag switches, no
 * role granting, no pricing. Those are `admin:manageFeatureFlags` and `admin:grantRole`, and
 * both stay unreachable on purpose — a console that can rewrite authorization is a much
 * larger security surface than one that can read and suspend, and neither is needed to
 * answer a takedown request. Flags stay in a reviewed commit; the one operator arrives
 * through `OWNER_EMAILS`.
 *
 * Everything here reads. The single write is suspension, which is reversible and audited.
 */

export interface AdminSection {
  id: string;
  href: string;
  label: string;
  /** What this page is for, said in terms of the job rather than the data. */
  blurb: string;
  /** Gate for the whole page. The API re-checks it — this only decides what to offer. */
  permission: Permission;
  /**
   * Permissions the page's controls need beyond the one that opens it.
   *
   * Declared rather than implied, so a test can hold the whole `admin:*` set against this
   * config and fail on any permission that is enforced somewhere and reachable nowhere —
   * which is exactly the state five of them were in before this console existed.
   */
  alsoUses?: readonly Permission[];
}

export const adminSections: readonly AdminSection[] = [
  {
    id: 'events',
    href: '/admin/events',
    label: 'Events',
    blurb:
      'Every invitation, newest first. Open one to reach its wall, where a post can be taken down.',
    permission: 'admin:listAllEvents',
  },
  {
    id: 'users',
    href: '/admin/users',
    label: 'People',
    blurb: 'Look up an account by email or id, and suspend one that is being abused or abusive.',
    permission: 'admin:listAllUsers',
    // Listing is `support` and up; suspending is `admin` and up. Support sees the button and
    // gets the server's refusal, which is the honest answer — see `admin-nav.tsx`.
    alsoUses: ['admin:suspendUser'],
  },
  {
    id: 'audit',
    href: '/admin/audit',
    label: 'Audit',
    blurb: 'Every privileged action, in order, with who did it. Reading it is itself recorded.',
    permission: 'admin:viewAuditLog',
  },
  {
    id: 'funnel',
    href: '/admin/funnel',
    label: 'Funnel',
    blurb: 'Aggregate counters across every event. Sums only — no identifiers in any of them.',
    permission: 'admin:accessConsole',
  },
] as const;

export const adminLimits = {
  /**
   * Rows per list request.
   *
   * Small on purpose. These are incident-response screens: the answer to "which event is the
   * complaint about" is a search, not a scroll through nine hundred rows, and an unbounded
   * list of every event in the database is a page that gets slower every week it exists.
   */
  pageSize: 50,
  /** The audit log is dense and read newest-first, so it wants a longer page than a list. */
  auditPageSize: 100,
  /** A suspension reason is written down so a later reader knows why. Not optional. */
  minReasonLength: 4,
  maxReasonLength: 200,
} as const;

export const adminCopy = {
  title: 'Operations',
  intro:
    'For whoever is running this. Every screen here reads; the one thing that writes is suspension, and it is reversible.',

  /** Shown where a permission is missing, rather than a 404 that pretends the page is not there. */
  denied: 'This is an operator screen and your account does not have access to it.',

  events: {
    searchLabel: 'Search by title, or paste an event id',
    empty: 'No events match that.',
    /** Said plainly, because the console's whole reason for existing is the takedown path. */
    hint: 'Opening an event opens its wall as staff. That is where a post is removed.',
  },

  users: {
    searchLabel: 'Search by email address, or paste a user id',
    empty: 'No account matches that.',
    suspend: 'Suspend',
    unsuspend: 'Lift suspension',
    reasonLabel: 'Why',
    reasonPlaceholder: 'Reported for abuse, ticket 41',
    /**
     * The truthful description of what suspension does, checked against what the code does
     * rather than against what the docs said.
     *
     * `docs/SECURITY.md` claimed a suspended account could still read. `can()` does say that,
     * but `requireActor()` refuses a suspended caller several layers earlier, so every API
     * call fails — reads included. The copy an operator reads before pressing the button has
     * to describe the second one.
     */
    effect:
      'Every request from that account is refused from their next one onward — they cannot post, reply, create an event, or load anything through the app. It is not a delete: nothing of theirs is removed, and lifting it restores them immediately.',
    selfWarning: 'You cannot suspend your own account.',
    rankWarning: 'You cannot suspend an account at or above your own level.',
  },

  audit: {
    empty: 'Nothing recorded yet.',
    filterLabel: 'Filter by event id or actor id',
    /** The honest caveat: an audit log is a record of privileged actions, not of everything. */
    scope:
      'Privileged actions only — creating, changing, ending, deleting, sending, removing. Ordinary reads are not in here.',
  },
} as const;

/** Formats an actor or target id for a dense table without losing its usefulness. */
export function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…`;
}
