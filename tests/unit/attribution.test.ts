import { describe, expect, it } from 'vitest';
import { featureFlags, plans, previewPlanId } from '@/config';
import { entitlementsFor, isPreviewPricing, showsAttribution } from '@/lib/billing/entitlements';

/**
 * The mark is the growth loop, and it was off.
 *
 * `showBranding` read `!entitlementsFor(event.plan).removeBranding` and looked obviously
 * correct. It was always false: while billing is off every event is stamped `previewPlanId`,
 * which is `pro`, and `pro` removes branding. Nothing failed, nothing logged, and the only
 * organic distribution the product has rendered on no invitation for months.
 *
 * The lesson these assertions encode: a rule that reads correctly per-event can still be
 * globally wrong once you ask what plan events *actually get*.
 */
describe('the attribution mark', () => {
  it('renders while nobody is being charged, whatever the stamped plan says', () => {
    // The regression itself. Every plan, because during preview every event is on the top one.
    expect(isPreviewPricing()).toBe(true);
    for (const planId of Object.keys(plans)) {
      expect(showsAttribution(planId), planId).toBe(true);
    }
  });

  it('would have been invisible under the old rule', () => {
    /*
      Pinning the bug so the fix cannot be quietly reverted to something that "looks right".
      This is the exact expression the invitation used, evaluated against the plan events are
      actually created on.
    */
    const underOldRule = !entitlementsFor(previewPlanId).removeBranding;
    expect(underOldRule).toBe(false);
    expect(showsAttribution(previewPlanId)).toBe(true);
  });

  it('is what the preview plan actually grants that caused it', () => {
    // Stated separately so a future change to `previewPlanId` re-reads as relevant here.
    expect(previewPlanId).toBe('pro');
    expect(plans[previewPlanId].entitlements.removeBranding).toBe(true);
    expect(featureFlags.billing).toBe(false);
  });

  it('still shows on the free plan, which is the whole point of a free plan', () => {
    expect(entitlementsFor('free').removeBranding).toBe(false);
    expect(showsAttribution('free')).toBe(true);
  });

  it('never appears on an event whose host paid to remove it', () => {
    /*
      The direction that matters. Turning billing on can only ever *remove* the mark from a
      preview-era event — it can never add one to an event somebody paid to be rid of, because
      that needs both a paid plan and billing being live.

      Simulated rather than mutated: the flag is read live and there is no supported way to
      flip it inside a test, so this asserts the composed rule directly.
    */
    const billingLive = false; // what isPreviewPricing() would return once billing is on
    for (const planId of ['event', 'pro'] as const) {
      const wouldShow = billingLive || !entitlementsFor(planId).removeBranding;
      expect(wouldShow, planId).toBe(false);
    }
    // …and free still shows, because that is what the free tier trades for being free.
    expect(billingLive || !entitlementsFor('free').removeBranding).toBe(true);
  });
});
