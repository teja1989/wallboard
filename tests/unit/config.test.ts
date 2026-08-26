import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  eventRolePermissions,
  expiryPresets,
  maxEventLifetimeMs,
  mediaRules,
  platformOnlyPermissions,
  platformRolePermissions,
  rateLimits,
} from '@/config';

/**
 * Config is the contract between the client and the server, so these guard against the
 * kind of drift that would otherwise only show up as a confusing runtime rejection.
 */

describe('media rules', () => {
  it('declare a non-empty MIME allowlist for every kind', () => {
    for (const [kind, rule] of Object.entries(mediaRules)) {
      expect(rule.mimeTypes.length, kind).toBeGreaterThan(0);
      expect(rule.maxBytes, kind).toBeGreaterThan(0);
    }
  });

  it('do not let one kind claim another kind’s MIME type', () => {
    const seen = new Map<string, string>();
    for (const [kind, rule] of Object.entries(mediaRules)) {
      for (const mime of rule.mimeTypes) {
        expect(seen.has(mime), `${mime} claimed by both ${seen.get(mime)} and ${kind}`).toBe(false);
        seen.set(mime, kind);
      }
    }
  });

  it('cap duration for time-based media only', () => {
    expect(mediaRules.image.maxDurationSeconds).toBeNull();
    expect(mediaRules.video.maxDurationSeconds).toBeGreaterThan(0);
    expect(mediaRules.audio.maxDurationSeconds).toBeGreaterThan(0);
  });
});

describe('expiry presets', () => {
  it('are ordered shortest to longest', () => {
    const durations = expiryPresets.map((preset) => preset.ms);
    expect([...durations].sort((a, b) => a - b)).toEqual(durations);
  });

  it('never exceed the hard lifetime cap', () => {
    for (const preset of expiryPresets) {
      expect(preset.ms, preset.id).toBeLessThanOrEqual(maxEventLifetimeMs);
    }
  });

  it('have unique ids', () => {
    const ids = expiryPresets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('rate limits', () => {
  it('are all positive and bounded', () => {
    for (const [name, rule] of Object.entries(rateLimits)) {
      expect(rule.limit, name).toBeGreaterThan(0);
      expect(rule.windowMs, name).toBeGreaterThan(0);
    }
  });

  it('keep code guessing meaningfully constrained', () => {
    // The per-IP join limit is the only thing standing between an attacker and the code
    // space, so a change that loosens it should fail here and be argued for explicitly.
    expect(rateLimits.joinAttemptPerIp.limit).toBeLessThanOrEqual(20);
  });
});

describe('permission tables', () => {
  it('reference only declared permissions', () => {
    const declared = new Set<string>(PERMISSIONS);
    for (const table of [platformRolePermissions, eventRolePermissions]) {
      for (const [role, permissions] of Object.entries(table)) {
        for (const permission of permissions) {
          expect(declared.has(permission), `${role} → ${permission}`).toBe(true);
        }
      }
    }
  });

  it('keep every admin permission out of reach of event roles', () => {
    for (const permissions of Object.values(eventRolePermissions)) {
      for (const permission of permissions) {
        expect(platformOnlyPermissions).not.toContain(permission);
      }
    }
  });

  it('treat every admin:* permission as platform-only', () => {
    for (const permission of PERMISSIONS) {
      if (permission.startsWith('admin:')) {
        expect(platformOnlyPermissions).toContain(permission);
      }
    }
  });
});
