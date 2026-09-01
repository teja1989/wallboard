import { describe, expect, it } from 'vitest';
import { EVENT_ROLES, eventRoleRank, hostAssignableEventRoles } from '@/config';
import { can, isAtLeastEventRole } from '@/lib/authz/policy';
import type { Actor } from '@/types/domain';

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    uid: 'u1',
    email: 'host@example.com',
    displayName: 'Host User',
    photoUrl: null,
    role: 'user',
    isAnonymous: false,
    suspended: false,
    ...overrides,
  };
}

describe('Co-host permissions and role hierarchy', () => {
  const user = actor();

  it('includes cohost in EVENT_ROLES and hostAssignableEventRoles', () => {
    expect(EVENT_ROLES).toContain('cohost');
    expect(hostAssignableEventRoles).toContain('cohost');
    expect(eventRoleRank.cohost).toBeGreaterThan(eventRoleRank.moderator);
    expect(eventRoleRank.host).toBeGreaterThan(eventRoleRank.cohost);
  });

  it('ranks cohost higher than member and moderator but lower than host', () => {
    expect(isAtLeastEventRole('cohost', 'viewer')).toBe(true);
    expect(isAtLeastEventRole('cohost', 'member')).toBe(true);
    expect(isAtLeastEventRole('cohost', 'moderator')).toBe(true);
    expect(isAtLeastEventRole('cohost', 'cohost')).toBe(true);
    expect(isAtLeastEventRole('cohost', 'host')).toBe(false);
  });

  it('grants cohost event management, invitations, code view and moderation', () => {
    expect(can('event:update', { actor: user, eventRole: 'cohost' })).toBe(true);
    expect(can('event:viewJoinCode', { actor: user, eventRole: 'cohost' })).toBe(true);
    expect(can('invite:manage', { actor: user, eventRole: 'cohost' })).toBe(true);
    expect(can('invite:send', { actor: user, eventRole: 'cohost' })).toBe(true);
    expect(can('rsvp:export', { actor: user, eventRole: 'cohost' })).toBe(true);
    expect(can('rsvp:viewAll', { actor: user, eventRole: 'cohost' })).toBe(true);
    expect(can('post:deleteAny', { actor: user, eventRole: 'cohost' })).toBe(true);
    expect(can('member:remove', { actor: user, eventRole: 'cohost' })).toBe(true);
  });

  it('withholds destructive and ownership permissions from cohost', () => {
    // Primary host permissions only:
    expect(can('event:delete', { actor: user, eventRole: 'cohost' })).toBe(false);
    expect(can('event:rotateJoinCode', { actor: user, eventRole: 'cohost' })).toBe(false);
    expect(can('member:assignRole', { actor: user, eventRole: 'cohost' })).toBe(false);

    // Host has all of them:
    expect(can('event:delete', { actor: user, eventRole: 'host' })).toBe(true);
    expect(can('event:rotateJoinCode', { actor: user, eventRole: 'host' })).toBe(true);
    expect(can('member:assignRole', { actor: user, eventRole: 'host' })).toBe(true);
  });

  it('anonymous users never gain cohost permissions even if marked cohost', () => {
    const anonymous = actor({ isAnonymous: true });
    expect(can('event:update', { actor: anonymous, eventRole: 'cohost' })).toBe(false);
    expect(can('invite:manage', { actor: anonymous, eventRole: 'cohost' })).toBe(false);
  });
});
