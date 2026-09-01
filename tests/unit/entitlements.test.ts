import { afterEach, describe, expect, it, vi } from 'vitest';
import { plans, previewPlanId } from '@/config';
import {
  allowedExpiryPresets,
  canUseExpiryPreset,
  canUseTemplate,
  cheapestPlanReaching,
  cheapestPlanWith,
  effectivePlanId,
  entitlementsFor,
  grantedPlanForNewEvent,
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

/**
 * The rule these tests exist to hold.
 *
 * What an event may do is decided when it is created and written onto it. It is never
 * re-derived from whatever is true today.
 *
 * `effectivePlanId()` used to return `previewPlanId` for every event while billing was off,
 * which read plausibly and was a dated landmine: every event in the database is stamped with
 * the host's account plan — `free` for almost everyone — and was merely *behaving* as pro.
 * Flipping `features.billing` would have dropped every live event to 25 guests and a
 * seven-day wall and revoked `archiveDownload`, mid-event, with no migration.
 *
 * Preview pricing is granted at creation now, by `planForNewEvent()`.
 */
describe('the plan an event runs on', () => {
  it('does not change when billing is switched on underneath it', async () => {
    // The regression. This fails against the old implementation, which is the point of it.
    await withBilling(false, () => expect(effectivePlanId('pro')).toBe('pro'));
    await withBilling(true, () => expect(effectivePlanId('pro')).toBe('pro'));
  });

  it('is the stamp, not the global flag, in either direction', async () => {
    for (const billing of [false, true]) {
      await withBilling(billing, () => {
        expect(effectivePlanId('free')).toBe('free');
        expect(effectivePlanId('event')).toBe('event');
      });
    }
  });
});

describe('while billing is off', () => {
  it('says so, so the pricing page can be honest about it', async () => {
    await withBilling(false, () => expect(isPreviewPricing()).toBe(true));
  });

  it('creates new events on the preview plan, so nothing is locked in practice', async () => {
    // The grant moved from read time to creation time; this is where it lives now.
    await withBilling(false, () => {
      expect(grantedPlanForNewEvent('party')).toBe(previewPlanId);
      expect(canUseTemplate(grantedPlanForNewEvent('party'), 'midnight')).toBe(true);
    });
  });

  it('never offers the create form something creation would refuse', async () => {
    // The form cannot see the host's subscription, so it may under-offer. It must never
    // over-offer: the server takes the most generous of account plan, preview and promo.
    await withBilling(true, () => expect(grantedPlanForNewEvent('party')).toBe('free'));
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
      expect(canUseTemplate('free', 'midnight')).toBe(false);
      expect(canUseTemplate('event', 'midnight')).toBe(true);
      // Free themes stay free on every plan.
      expect(canUseTemplate('free', 'sunset')).toBe(true);
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
    expect(cheapestPlanWith('premiumTemplates')).toBe('event');
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
    const prompt = upgradeForFlag('premiumTemplates', 'That theme is part of a paid plan.');
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
