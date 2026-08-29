import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  absoluteMaxEventLifetimeMs,
  eventRolePermissions,
  templates,
  expiryPresets,
  mediaRules,
  occasions,
  planOrder,
  plans,
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
      expect(preset.ms, preset.id).toBeLessThanOrEqual(absoluteMaxEventLifetimeMs);
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

describe('plans', () => {
  it('are ordered by what they include, cheapest first', () => {
    const guests = planOrder.map((id) => plans[id].entitlements.maxGuests);
    expect([...guests].sort((a, b) => a - b)).toEqual(guests);
  });

  it('never take an entitlement away as you pay more', () => {
    // A paid plan that silently loses a feature is the kind of thing nobody notices until
    // a customer does.
    for (let i = 1; i < planOrder.length; i += 1) {
      const lower = plans[planOrder[i - 1]!].entitlements;
      const higher = plans[planOrder[i]!].entitlements;

      for (const key of Object.keys(lower) as (keyof typeof lower)[]) {
        const before = lower[key];
        const after = higher[key];
        if (typeof before === 'boolean') {
          expect(before && !after, `${planOrder[i]} lost ${key}`).toBe(false);
        } else {
          expect(after, `${planOrder[i]} reduced ${key}`).toBeGreaterThanOrEqual(before);
        }
      }
    }
  });

  it('give the free tier something genuinely usable', () => {
    // If free is useless, nobody gets far enough to want the paid tier.
    const free = plans.free.entitlements;
    expect(free.maxGuests).toBeGreaterThanOrEqual(10);
    expect(free.maxPostsPerEvent).toBeGreaterThanOrEqual(50);
    expect(free.maxEventLifetimeMs).toBeGreaterThan(0);
  });

  it('mark exactly one plan as featured', () => {
    expect(planOrder.filter((id) => plans[id].featured)).toHaveLength(1);
  });

  it('price the paid plans and only the paid plans', () => {
    expect(plans.free.price).toBeNull();
    expect(plans.event.price).toBeGreaterThan(0);
    expect(plans.pro.price).toBeGreaterThan(0);
  });

  it('keep every plan inside the longest expiry preset the UI offers', () => {
    const longest = Math.max(...expiryPresets.map((p) => p.ms));
    for (const id of planOrder) {
      expect(plans[id].entitlements.maxEventLifetimeMs, id).toBeLessThanOrEqual(longest);
    }
  });
});

describe('occasions', () => {
  it('have unique ids and point at real themes', () => {
    const ids = occasions.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);

    const themeIds = new Set(templates.map((t) => t.id));
    for (const occasion of occasions) {
      expect(themeIds.has(occasion.defaultTemplateId), occasion.id).toBe(true);
    }
  });

  it('give every occasion its own wording', () => {
    for (const occasion of occasions) {
      expect(occasion.rsvpPrompt.length, occasion.id).toBeGreaterThan(0);
      expect(occasion.wallPrompt.length, occasion.id).toBeGreaterThan(0);
      expect(occasion.titlePlaceholder.length, occasion.id).toBeGreaterThan(0);
    }
  });

  it('keep celebratory language away from the somber ones', () => {
    const memorial = occasions.find((o) => o.id === 'memorial');
    expect(memorial?.somber).toBe(true);
    expect(memorial?.createVerb.toLowerCase()).not.toContain('celebrate');
    expect(memorial?.plusOnesByDefault).toBe(false);
  });

  it('never let the create button claim it sends something', () => {
    /*
      It said "Send the invitation" on every occasion, and creating an event sends nothing —
      guests are added afterwards and each send is a separate, deliberate act. A host who
      believed the button had every reason not to open the guest list, which is where the
      tracked path begins, and some reason to think forty emails had just gone out.

      Asserted across the whole table rather than fixed in ten places, because the next
      occasion somebody adds will be copied from one of these rows.
    */
    for (const occasion of occasions) {
      expect(occasion.createVerb.toLowerCase(), occasion.id).not.toContain('send');
      expect(occasion.createVerb.length, occasion.id).toBeGreaterThan(0);
    }
  });
});

describe('themes', () => {
  it('offer a usable free set rather than a deliberately poor one', () => {
    expect(templates.filter((t) => !t.premium).length).toBeGreaterThanOrEqual(3);
  });

  it('have something behind the paywall worth paying for', () => {
    expect(templates.filter((t) => t.premium).length).toBeGreaterThan(0);
  });

  it('have unique ids', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
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
