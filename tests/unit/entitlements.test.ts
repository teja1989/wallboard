import { afterEach, describe, expect, it, vi } from 'vitest';
import { plans, previewPlanId } from '@/config';
import {
  allowedExpiryPresets,
  canUseExpiryPreset,
  canUseTheme,
  cheapestPlanReaching,
  cheapestPlanWith,
  effectivePlanId,
  entitlementsFor,
  isPreviewPricing,
} from '@/lib/billing/entitlements';
import { upgradeForFlag, upgradeForLimit } from '@/lib/billing/upgrade';

/**
 * Entitlements decide what someone has paid for. Getting these wrong either gives away the
 * product or blocks a paying customer, so both directions are tested.
 */

/** The flag is read through isEnabled(), so it is stubbed at that boundary. */
async function withBilling(enabled: boolean, run: () => void | Promise<void>) {
  const config = await import('@/config');
  const spy = vi.spyOn(config, 'isEnabled').mockImplementation((flag) => {
    if (flag === 'billing') return enabled;
    return config.defaultFeatureFlags[flag];
  });
  try {
    await run();
  } finally {
    spy.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe('while billing is off', () => {
  it('runs every event on the preview plan, whatever it was created as', async () => {
    await withBilling(false, () => {
      expect(effectivePlanId('free')).toBe(previewPlanId);
      expect(effectivePlanId('event')).toBe(previewPlanId);
    });
  });

  it('says so, so the pricing page can be honest about it', async () => {
    await withBilling(false, () => expect(isPreviewPricing()).toBe(true));
  });

  it('lets a free event use a premium theme', async () => {
    await withBilling(false, () => expect(canUseTheme('free', 'midnight')).toBe(true));
  });
});

describe('once billing is on', () => {
  it('honours the plan the event was created with', async () => {
    await withBilling(true, () => {
      expect(effectivePlanId('free')).toBe('free');
      expect(effectivePlanId('pro')).toBe('pro');
    });
  });

  it('falls back to free for an unrecognised plan rather than the most generous one', async () => {
    // Corrupt data should cost the platform nothing, not hand out a Pro account.
    await withBilling(true, () => expect(effectivePlanId('enterprise-mega')).toBe('free'));
  });

  it('keeps premium themes behind the paywall', async () => {
    await withBilling(true, () => {
      expect(canUseTheme('free', 'midnight')).toBe(false);
      expect(canUseTheme('event', 'midnight')).toBe(true);
      // Free themes stay free on every plan.
      expect(canUseTheme('free', 'sunset')).toBe(true);
    });
  });

  it('limits how long a free wall can stay up', async () => {
    await withBilling(true, () => {
      expect(canUseExpiryPreset('free', '7d')).toBe(true);
      expect(canUseExpiryPreset('free', '30d')).toBe(false);
      expect(canUseExpiryPreset('event', '30d')).toBe(true);
      expect(canUseExpiryPreset('pro', '90d')).toBe(true);
    });
  });

  it('offers only the presets a plan can actually pick', async () => {
    await withBilling(true, () => {
      const free = allowedExpiryPresets('free').map((p) => p.id);
      expect(free).toContain('7d');
      expect(free).not.toContain('90d');
      expect(allowedExpiryPresets('pro').length).toBeGreaterThan(free.length);
    });
  });
});

describe('entitlement ceilings', () => {
  it('never promise more than the platform will serve', async () => {
    await withBilling(true, () => {
      const pro = entitlementsFor('pro');
      expect(pro.maxGuests).toBeLessThanOrEqual(plans.pro.entitlements.maxGuests);
      expect(pro.maxEventLifetimeMs).toBeLessThanOrEqual(plans.pro.entitlements.maxEventLifetimeMs);
    });
  });
});

describe('pointing at the right upgrade', () => {
  it('names the cheapest plan that unlocks a feature, not the dearest', () => {
    expect(cheapestPlanWith('premiumThemes')).toBe('event');
    expect(cheapestPlanWith('guestListExport')).toBe('event');
  });

  it('names the cheapest plan that reaches a number', () => {
    expect(cheapestPlanReaching('maxGuests', 20)).toBe('free');
    expect(cheapestPlanReaching('maxGuests', 100)).toBe('event');
    expect(cheapestPlanReaching('maxGuests', 400)).toBe('pro');
  });

  it('returns nothing when no plan is big enough, rather than guessing', () => {
    expect(cheapestPlanReaching('maxGuests', 10_000_000)).toBeNull();
  });

  it('builds a message that says both what was refused and what fixes it', () => {
    const prompt = upgradeForFlag('premiumThemes', 'That theme is part of a paid plan.');
    expect(prompt.planId).toBe('event');
    expect(prompt.message).toContain('That theme is part of a paid plan.');
    expect(prompt.message).toContain(plans.event.label);
  });

  it('does not promise a fix that does not exist', () => {
    const prompt = upgradeForLimit('maxGuests', 10_000_000, 'Too many guests.');
    expect(prompt.planId).toBeNull();
    expect(prompt.message).toBe('Too many guests.');
  });
});
