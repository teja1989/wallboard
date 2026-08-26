import {
  eventRolePermissions,
  eventRoleRank,
  platformOnlyPermissions,
  platformRolePermissions,
  platformRoleRank,
  type EventRole,
  type Permission,
  type PlatformRole,
} from '@/config';
import type { Actor } from '@/types/domain';

/**
 * The only place a permission decision is made. Route handlers and UI both call `can()`,
 * so a button cannot appear for something the API would refuse — or vice versa.
 *
 * Pure and dependency-free on purpose: it runs on the server, in client components, and
 * in unit tests without any Firebase involvement.
 */

/** Expands a role into its own permissions plus everything the roles below it grant. */
function accumulate<R extends string>(
  role: R,
  rank: Record<R, number>,
  table: Record<R, readonly Permission[]>,
): ReadonlySet<Permission> {
  const target = rank[role];
  const out = new Set<Permission>();
  for (const key of Object.keys(table) as R[]) {
    if (rank[key] <= target) for (const permission of table[key]) out.add(permission);
  }
  return out;
}

const platformCache = new Map<PlatformRole, ReadonlySet<Permission>>();
const eventCache = new Map<EventRole, ReadonlySet<Permission>>();

export function platformPermissions(role: PlatformRole): ReadonlySet<Permission> {
  let cached = platformCache.get(role);
  if (!cached) {
    cached = accumulate(role, platformRoleRank, platformRolePermissions);
    platformCache.set(role, cached);
  }
  return cached;
}

export function eventPermissions(role: EventRole): ReadonlySet<Permission> {
  let cached = eventCache.get(role);
  if (!cached) {
    cached = accumulate(role, eventRoleRank, eventRolePermissions);
    eventCache.set(role, cached);
  }
  return cached;
}

export interface AuthzContext {
  actor: Actor;
  /** The actor's role in the event under consideration, when there is one. */
  eventRole?: EventRole | null;
  /** True when the actor authored the resource being acted on. */
  isOwnResource?: boolean;
  /**
   * Set when the event's host has opened posting to anyone holding the code. Lets an
   * anonymous member post without widening what anonymity means everywhere else.
   */
  anonymousPostingAllowed?: boolean;
}

/**
 * Decides a single permission.
 *
 * Ordering matters:
 *  1. A suspended account can do nothing but read.
 *  2. Anonymous (code-only) identities never get write or admin permissions.
 *  3. `admin:*` permissions are satisfiable only by a platform role, never by being a host.
 *  4. Otherwise platform role and event role are both consulted.
 */
export function can(permission: Permission, context: AuthzContext): boolean {
  const {
    actor,
    eventRole = null,
    isOwnResource = false,
    anonymousPostingAllowed = false,
  } = context;

  if (actor.suspended && !isReadPermission(permission)) return false;

  if (actor.isAnonymous) {
    const openedUp = anonymousPostingAllowed && ANONYMOUS_POSTING_PERMISSIONS.has(permission);
    if (!ANONYMOUS_PERMISSIONS.has(permission) && !openedUp) return false;
  }

  const fromPlatform = platformPermissions(actor.role);
  if (platformOnlyPermissions.includes(permission)) return fromPlatform.has(permission);

  if (fromPlatform.has(permission)) return true;
  if (eventRole && eventPermissions(eventRole).has(permission)) return true;

  // Deleting your own post needs nothing beyond authorship and membership.
  if (permission === 'post:deleteOwn' && isOwnResource && eventRole !== null) return true;

  return false;
}

/** Throws a typed error instead of returning false. Convenience for route handlers. */
export class ForbiddenError extends Error {
  readonly permission: Permission;
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = 'ForbiddenError';
    this.permission = permission;
  }
}

export function assertCan(permission: Permission, context: AuthzContext): void {
  if (!can(permission, context)) throw new ForbiddenError(permission);
}

const READ_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'event:view',
  'post:view',
  'member:list',
  'rsvp:viewAll',
  'admin:accessConsole',
  'admin:listAllEvents',
  'admin:listAllUsers',
  'admin:viewAuditLog',
]);

function isReadPermission(permission: Permission): boolean {
  return READ_PERMISSIONS.has(permission);
}

/**
 * What a code-only visitor may do. Posting is absent by design: the hybrid access model
 * trades a sign-in for the ability to attach your name to content. A host who opts into
 * `whoCanPost: 'anyone'` is handled at the call site, not by widening this set.
 */
const ANONYMOUS_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'event:view',
  'post:view',
  'member:list',
  // Someone who was handed the code was invited. Making them create an account before
  // they can say "yes, I'll be there" would lose replies for no security benefit.
  'rsvp:respond',
]);

/** What `anonymousPostingAllowed` adds, and nothing more. Never includes moderation. */
const ANONYMOUS_POSTING_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'post:create',
  'post:deleteOwn',
]);

export function isAtLeastPlatformRole(actor: Actor, minimum: PlatformRole): boolean {
  return platformRoleRank[actor.role] >= platformRoleRank[minimum];
}

export function isAtLeastEventRole(role: EventRole | null, minimum: EventRole): boolean {
  return role !== null && eventRoleRank[role] >= eventRoleRank[minimum];
}
