import { describe, expect, it } from 'vitest';
import { can, isAtLeastEventRole, isAtLeastPlatformRole } from '@/lib/authz/policy';
import type { Actor } from '@/types/domain';
import type { PlatformRole } from '@/config';

/**
 * The permission matrix is the security boundary the whole API leans on, so these tests
 * assert the *refusals* as carefully as the grants.
 */

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    uid: 'u1',
    email: 'someone@example.com',
    displayName: 'Someone',
    photoUrl: null,
    role: 'user',
    isAnonymous: false,
    suspended: false,
    ...overrides,
  };
}

describe('can()', () => {
  describe('anonymous visitors', () => {
    const guest = actor({ isAnonymous: true, uid: 'guest' });

    it('may view an event they have joined', () => {
      expect(can('event:view', { actor: guest, eventRole: 'viewer' })).toBe(true);
      expect(can('post:view', { actor: guest, eventRole: 'viewer' })).toBe(true);
    });

    it('may not post, even as a member of the event', () => {
      expect(can('post:create', { actor: guest, eventRole: 'member' })).toBe(false);
    });

    it('may not create events', () => {
      expect(can('event:create', { actor: guest })).toBe(false);
    });

    it('may post only when the host has opened the event up', () => {
      expect(
        can('post:create', { actor: guest, eventRole: 'member', anonymousPostingAllowed: true }),
      ).toBe(true);
    });

    it('never gains moderation powers, even in an opened-up event', () => {
      expect(
        can('post:deleteAny', {
          actor: guest,
          eventRole: 'moderator',
          anonymousPostingAllowed: true,
        }),
      ).toBe(false);
    });
  });

  describe('event roles', () => {
    const person = actor();

    it('grants posting to members', () => {
      expect(can('post:create', { actor: person, eventRole: 'member' })).toBe(true);
    });

    it('withholds posting from viewers', () => {
      expect(can('post:create', { actor: person, eventRole: 'viewer' })).toBe(false);
    });

    it('lets moderators remove anyone’s post', () => {
      expect(can('post:deleteAny', { actor: person, eventRole: 'moderator' })).toBe(true);
      expect(can('post:deleteAny', { actor: person, eventRole: 'member' })).toBe(false);
    });

    it('gives hosts the code and settings, and nobody below them', () => {
      expect(can('event:viewJoinCode', { actor: person, eventRole: 'host' })).toBe(true);
      expect(can('event:viewJoinCode', { actor: person, eventRole: 'moderator' })).toBe(false);
      expect(can('event:update', { actor: person, eventRole: 'host' })).toBe(true);
      expect(can('event:update', { actor: person, eventRole: 'moderator' })).toBe(false);
    });

    it('is cumulative up the rank', () => {
      // A host inherits everything a member and a moderator can do.
      expect(can('post:create', { actor: person, eventRole: 'host' })).toBe(true);
      expect(can('post:deleteAny', { actor: person, eventRole: 'host' })).toBe(true);
    });

    it('grants nothing to someone with no membership', () => {
      expect(can('event:view', { actor: person, eventRole: null })).toBe(false);
      expect(can('post:create', { actor: person, eventRole: null })).toBe(false);
    });
  });

  describe('platform-only permissions', () => {
    it('cannot be reached by being a host', () => {
      const host = actor();
      expect(can('admin:accessConsole', { actor: host, eventRole: 'host' })).toBe(false);
      expect(can('admin:viewAuditLog', { actor: host, eventRole: 'host' })).toBe(false);
      expect(can('admin:grantRole', { actor: host, eventRole: 'host' })).toBe(false);
    });

    it('follows the platform role ladder', () => {
      const grants: [PlatformRole, string[], string[]][] = [
        ['support', ['admin:accessConsole', 'admin:listAllEvents'], ['admin:viewAuditLog']],
        ['admin', ['admin:viewAuditLog', 'admin:suspendUser'], ['admin:grantRole']],
        ['owner', ['admin:grantRole', 'admin:manageFeatureFlags'], []],
      ];

      for (const [role, allowed, denied] of grants) {
        const staff = actor({ role });
        for (const permission of allowed) {
          expect(can(permission as never, { actor: staff }), `${role} → ${permission}`).toBe(true);
        }
        for (const permission of denied) {
          expect(can(permission as never, { actor: staff }), `${role} ✗ ${permission}`).toBe(false);
        }
      }
    });
  });

  describe('suspended accounts', () => {
    const suspended = actor({ suspended: true, role: 'admin' });

    it('can still read', () => {
      expect(can('event:view', { actor: suspended, eventRole: 'member' })).toBe(true);
    });

    it('cannot write anything, whatever their role', () => {
      expect(can('post:create', { actor: suspended, eventRole: 'host' })).toBe(false);
      expect(can('post:deleteAny', { actor: suspended, eventRole: 'host' })).toBe(false);
      expect(can('event:create', { actor: suspended })).toBe(false);
      expect(can('admin:suspendUser', { actor: suspended })).toBe(false);
    });
  });

  describe('own resources', () => {
    it('lets an author remove their own post', () => {
      const author = actor();
      expect(
        can('post:deleteOwn', { actor: author, eventRole: 'member', isOwnResource: true }),
      ).toBe(true);
    });

    it('does not let them remove someone else’s', () => {
      const author = actor();
      expect(can('post:deleteAny', { actor: author, eventRole: 'member' })).toBe(false);
    });
  });
});

describe('role comparison helpers', () => {
  it('compares platform roles by rank', () => {
    expect(isAtLeastPlatformRole(actor({ role: 'owner' }), 'admin')).toBe(true);
    expect(isAtLeastPlatformRole(actor({ role: 'support' }), 'admin')).toBe(false);
  });

  it('treats a missing event role as below everything', () => {
    expect(isAtLeastEventRole(null, 'viewer')).toBe(false);
    expect(isAtLeastEventRole('host', 'moderator')).toBe(true);
    expect(isAtLeastEventRole('member', 'moderator')).toBe(false);
  });
});
