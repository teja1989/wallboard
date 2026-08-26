/**
 * Two independent axes of authority:
 *
 *  - Platform roles live in Firebase custom claims and are granted out-of-band by CLI.
 *    They answer "what can this person do across the whole app?"
 *  - Event roles live in `events/{id}/members/{uid}` and answer "what can this person do
 *    inside this one event?"
 *
 * `can()` in src/lib/authz/policy.ts is the only consumer. Keep this file declarative.
 */

export const PLATFORM_ROLES = ['user', 'support', 'admin', 'owner'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const EVENT_ROLES = ['viewer', 'member', 'moderator', 'host'] as const;
export type EventRole = (typeof EVENT_ROLES)[number];

/** Higher wins. Used for "at least" comparisons, never for granting permissions directly. */
export const platformRoleRank: Record<PlatformRole, number> = {
  user: 0,
  support: 1,
  admin: 2,
  owner: 3,
};

export const eventRoleRank: Record<EventRole, number> = {
  viewer: 0,
  member: 1,
  moderator: 2,
  host: 3,
};

export const PERMISSIONS = [
  // Event lifecycle
  'event:create',
  'event:view',
  'event:update',
  'event:end',
  'event:extend',
  'event:delete',
  'event:viewJoinCode',
  'event:rotateJoinCode',
  // Invitation and RSVP
  'rsvp:respond',
  'rsvp:viewAll',
  'rsvp:export',
  // Sending
  'invite:manage',
  'invite:send',
  // Membership
  'member:list',
  'member:mute',
  'member:remove',
  // Posts
  'post:create',
  'post:view',
  'post:deleteOwn',
  'post:deleteAny',
  // Platform administration
  'admin:accessConsole',
  'admin:listAllEvents',
  'admin:listAllUsers',
  'admin:suspendUser',
  'admin:viewAuditLog',
  'admin:manageFeatureFlags',
  'admin:grantRole',
  'admin:purgeStorage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permissions granted purely by platform role. Cumulative: a role inherits everything
 * from the roles below it, so only list what the role *adds*.
 */
export const platformRolePermissions: Record<PlatformRole, readonly Permission[]> = {
  user: ['event:create'],
  support: ['admin:accessConsole', 'admin:listAllEvents', 'admin:listAllUsers', 'event:view'],
  admin: [
    'rsvp:viewAll',
    'admin:viewAuditLog',
    'admin:suspendUser',
    'post:deleteAny',
    'event:end',
    'event:extend',
    'member:mute',
    'member:remove',
    'member:list',
    'post:view',
  ],
  owner: ['admin:manageFeatureFlags', 'admin:grantRole', 'admin:purgeStorage', 'event:delete'],
};

/**
 * Permissions granted by membership in a specific event. Also cumulative up the rank.
 * These only apply to the event the membership belongs to.
 */
export const eventRolePermissions: Record<EventRole, readonly Permission[]> = {
  // A viewer can answer the invitation and see who else is coming — neither is a
  // privilege, they are what being invited means. The private notes that come with a
  // reply are a different matter and need `rsvp:viewAll`.
  viewer: ['event:view', 'post:view', 'rsvp:respond', 'member:list'],
  member: ['post:create', 'post:deleteOwn'],
  moderator: ['post:deleteAny', 'member:mute', 'rsvp:viewAll'],
  host: [
    'rsvp:export',
    'invite:manage',
    'invite:send',
    // Sending
    'invite:manage',
    'invite:send',
    'event:update',
    'event:end',
    'event:extend',
    'event:viewJoinCode',
    'event:rotateJoinCode',
    'member:remove',
  ],
};

/**
 * Permissions that may never be satisfied by an event role, no matter how senior.
 * A host is powerful inside their event and ordinary everywhere else.
 */
export const platformOnlyPermissions: readonly Permission[] = PERMISSIONS.filter((p) =>
  p.startsWith('admin:'),
);

/** Roles a host may assign to members of their own event. */
export const hostAssignableEventRoles: readonly EventRole[] = ['viewer', 'member', 'moderator'];
