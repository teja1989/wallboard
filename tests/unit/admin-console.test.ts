import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  PERMISSIONS,
  adminCopy,
  adminLimits,
  adminSections,
  platformRolePermissions,
  platformRoleRank,
  shortId,
  type PlatformRole,
} from '@/config';
import { can } from '@/lib/authz/policy';
import { adminQuerySchema, suspendUserSchema } from '@/lib/validation/schemas';
import type { Actor } from '@/types/domain';

/**
 * The operator console.
 *
 * The bug this whole area existed to fix was not a broken rule, it was a *missing route*:
 * eight `admin:*` permissions were declared and enforced, and one of them had somewhere to be
 * used. `Actor.suspended` gated every write in the product and nothing could set it.
 *
 * So the first test here is the one that would have caught that — every permission the roles
 * config hands out is either reachable from a console section or is deliberately, namedly
 * unreachable. A permission with no route and no note is a promise nobody kept.
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

/**
 * The two that stay unreachable on purpose.
 *
 * `manageFeatureFlags` — flags belong in a reviewed commit, not a 2am toggle; that is the
 * same argument `promos.config.ts` makes about promos.
 * `grantRole` — a console that can rewrite authorization is a far larger security surface
 * than one that can read and suspend, and the single operator arrives via `OWNER_EMAILS`.
 * `purgeStorage` — destructive, unreviewable, and served by the existing delete flow.
 */
const DELIBERATELY_UNREACHABLE = [
  'admin:manageFeatureFlags',
  'admin:grantRole',
  'admin:purgeStorage',
] as const;

describe('every admin permission is accounted for', () => {
  const adminPermissions = PERMISSIONS.filter((p) => p.startsWith('admin:'));

  it('is either wired to a console section or named as unreachable', () => {
    const wired = new Set(
      adminSections.flatMap((section) => [section.permission, ...(section.alsoUses ?? [])]),
    );
    const parked = new Set<string>(DELIBERATELY_UNREACHABLE);

    const orphans = adminPermissions.filter((p) => !wired.has(p) && !parked.has(p));

    // This is the assertion that was failing silently before the console existed: five of
    // these were orphans, including the one that suspends an abusive account.
    expect(orphans).toEqual([]);
  });

  it('leaves nothing in the parked list that has quietly grown a route', () => {
    const wired = new Set(
      adminSections.flatMap((section) => [section.permission, ...(section.alsoUses ?? [])]),
    );
    for (const parked of DELIBERATELY_UNREACHABLE) {
      expect(wired.has(parked)).toBe(false);
    }
  });
});

describe('who can reach the console', () => {
  it('refuses an ordinary account every section', () => {
    for (const section of adminSections) {
      expect(can(section.permission, { actor: actor(), eventRole: null })).toBe(false);
    }
  });

  it('refuses a host of the event they are hosting, which is the point of platform-only', () => {
    for (const section of adminSections) {
      expect(can(section.permission, { actor: actor(), eventRole: 'host' })).toBe(false);
    }
  });

  it('refuses an anonymous visitor even with a platform role on the actor', () => {
    // A code-only visitor cannot hold a platform role in practice — `resolveRole` returns
    // 'user' for anonymous sessions — but the matrix should not be the only thing standing
    // between an anonymous session and the audit log.
    const ghost = actor({ isAnonymous: true, role: 'owner' });
    expect(can('admin:viewAuditLog', { actor: ghost, eventRole: null })).toBe(false);
  });

  it('gives support the two lists and nothing that writes', () => {
    const staff = actor({ role: 'support' });
    expect(can('admin:listAllEvents', { actor: staff, eventRole: null })).toBe(true);
    expect(can('admin:listAllUsers', { actor: staff, eventRole: null })).toBe(true);
    expect(can('admin:suspendUser', { actor: staff, eventRole: null })).toBe(false);
    expect(can('admin:viewAuditLog', { actor: staff, eventRole: null })).toBe(false);
  });

  it('gives an owner every section', () => {
    const boss = actor({ role: 'owner' });
    for (const section of adminSections) {
      expect(can(section.permission, { actor: boss, eventRole: null })).toBe(true);
    }
  });

  it('refuses a suspended operator, because suspension outranks the role', () => {
    const fallen = actor({ role: 'owner', suspended: true });
    // Reads survive — a suspended account can still read, by design — but the write cannot.
    expect(can('admin:suspendUser', { actor: fallen, eventRole: null })).toBe(false);
  });
});

describe('the rank guard on suspension', () => {
  /**
   * The route refuses a target at or above the actor's own rank. Re-derived here from the
   * shipped table rather than restated, so adding a role between `admin` and `owner` cannot
   * quietly make this pass while the ordering it depends on has changed.
   */
  function maySuspend(by: PlatformRole, target: PlatformRole): boolean {
    return (
      can('admin:suspendUser', { actor: actor({ role: by }), eventRole: null }) &&
      platformRoleRank[target] < platformRoleRank[by]
    );
  }

  it('lets an admin suspend an ordinary account', () => {
    expect(maySuspend('admin', 'user')).toBe(true);
  });

  it('stops an admin suspending the owner above them', () => {
    expect(maySuspend('admin', 'owner')).toBe(false);
  });

  it('stops two admins suspending each other', () => {
    expect(maySuspend('admin', 'admin')).toBe(false);
  });

  it('stops support suspending anybody at all, having no permission to begin with', () => {
    expect(maySuspend('support', 'user')).toBe(false);
  });

  it('leaves an owner able to suspend an admin', () => {
    expect(maySuspend('owner', 'admin')).toBe(true);
  });
});

describe('the suspend request shape', () => {
  /*
    The `.partial()`/`.default()` trap in the dev skill, applied before it can bite: the way
    this goes wrong is a default on `suspended`, which turns a mis-shaped suspend request into
    a silent *un*-suspend. So the shape is asserted, not just the happy path.
  */
  it('requires both fields — neither has a default to fall back on', () => {
    expect(suspendUserSchema.safeParse({ reason: 'reported for abuse' }).success).toBe(false);
    expect(suspendUserSchema.safeParse({ suspended: true }).success).toBe(false);
  });

  it('never invents a value for `suspended` from an empty body', () => {
    const parsed = suspendUserSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('refuses a reason too short to be reviewable later', () => {
    expect(suspendUserSchema.safeParse({ suspended: true, reason: 'x' }).success).toBe(false);
    expect(suspendUserSchema.safeParse({ suspended: true, reason: '   ' }).success).toBe(false);
  });

  it('requires a reason to lift a suspension too, not only to apply one', () => {
    expect(suspendUserSchema.safeParse({ suspended: false, reason: '' }).success).toBe(false);
    expect(suspendUserSchema.safeParse({ suspended: false, reason: 'appeal upheld' }).success).toBe(
      true,
    );
  });

  it('strips invisible characters out of a reason, like every other stored text', () => {
    const parsed = suspendUserSchema.parse({
      suspended: true,
      reason: 'spam​ from one address',
    });
    expect(parsed.reason).toBe('spam from one address');
  });

  it('refuses a reason past the stored limit rather than truncating it', () => {
    const long = 'a'.repeat(adminLimits.maxReasonLength + 1);
    expect(suspendUserSchema.safeParse({ suspended: true, reason: long }).success).toBe(false);
  });
});

describe('the console search box', () => {
  it('trims, so a pasted id with a trailing newline still matches', () => {
    expect(adminQuerySchema.parse('  abc123\n')).toBe('abc123');
  });

  it('refuses an unbounded string', () => {
    expect(adminQuerySchema.safeParse('x'.repeat(500)).success).toBe(false);
  });

  it('accepts empty, which is how an unfiltered list is asked for', () => {
    expect(adminQuerySchema.parse('')).toBe('');
  });
});

describe('the audit trail', () => {
  it('records the read of itself, which is what SECURITY.md has always promised', () => {
    expect(AUDIT_ACTIONS).toContain('admin.auditViewed');
  });

  it('distinguishes a suspension from lifting one', () => {
    // One action for both would make "how many accounts are suspended right now" unanswerable
    // from the log, and the log is the only place the history lives.
    expect(AUDIT_ACTIONS).toContain('user.suspended');
    expect(AUDIT_ACTIONS).toContain('user.unsuspended');
  });
});

describe('the console as configured', () => {
  it('offers no section whose permission is not a real one', () => {
    for (const section of adminSections) {
      expect(PERMISSIONS).toContain(section.permission);
    }
  });

  it('describes every section, because a bare noun is not an instruction', () => {
    for (const section of adminSections) {
      expect(section.blurb.length).toBeGreaterThan(20);
      expect(section.href.startsWith('/admin')).toBe(true);
    }
  });

  it('keeps pages small enough to be an incident screen rather than a data dump', () => {
    expect(adminLimits.pageSize).toBeLessThanOrEqual(100);
    expect(adminLimits.auditPageSize).toBeLessThanOrEqual(200);
  });

  it('never lets an event role satisfy an admin permission, at any rank', () => {
    const roles = ['viewer', 'member', 'moderator', 'host'] as const;
    for (const permission of PERMISSIONS.filter((p) => p.startsWith('admin:'))) {
      for (const eventRole of roles) {
        expect(can(permission, { actor: actor(), eventRole })).toBe(false);
      }
    }
  });

  it('gives support no write permission of any kind', () => {
    // Support exists to look, so that "let someone help with tickets" does not mean handing
    // them the ability to change anything.
    const writes = platformRolePermissions.support.filter(
      (p) => p.includes(':delete') || p.includes(':suspend') || p.includes(':grant'),
    );
    expect(writes).toEqual([]);
  });
});

describe('suspension, as the product actually behaves', () => {
  /*
    `can()` keeps read permissions for a suspended actor. Nothing ever asks it: `requireActor`
    refuses a suspended caller several layers earlier, so every API call fails, reads included.

    docs/SECURITY.md described the matrix rule as the observable behaviour, which read as more
    permissive than the code. These two tests pin both halves so the next person to touch
    either one finds out which is which.
  */
  it('keeps the matrix rule: reads survive, writes do not', () => {
    const stopped = actor({ suspended: true });
    expect(can('event:view', { actor: stopped, eventRole: 'host' })).toBe(true);
    expect(can('post:view', { actor: stopped, eventRole: 'viewer' })).toBe(true);
    expect(can('post:create', { actor: stopped, eventRole: 'member' })).toBe(false);
    expect(can('event:create', { actor: stopped })).toBe(false);
  });

  it('is nonetheless a full lockout at the API, which is what the console copy says', () => {
    // Asserted against the copy rather than against the handler, because the copy is the
    // thing an operator reads before pressing the button — and it is what was wrong.
    expect(adminCopy.users.effect).toContain('Every request');
    expect(adminCopy.users.effect).not.toContain('can still read');
  });
});

describe('shortId', () => {
  it('leaves a short id alone', () => {
    expect(shortId('abc')).toBe('abc');
  });

  it('keeps enough of a long one to match against a paste', () => {
    expect(shortId('abcdefghijklmnop')).toBe('abcdefgh…');
  });
});
