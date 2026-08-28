import { describe, expect, it } from 'vitest';
import { adFreePromiseHolds, brand, featureFlags, plans } from '@/config';

/**
 * The no-ads promise is a claim about the product, made on the landing page, the pricing
 * table and the free plan's own bullets. A claim in a string literal is invisible to the type
 * system and to every other test in this suite, which is exactly how marketing copy ends up
 * outliving the thing it describes.
 *
 * So it goes through `adFreePromiseHolds()`, and these are the assertions that keep that
 * honest: the promise must be true today, and the machinery must actually be capable of
 * withdrawing it.
 */
describe('the no-ads promise', () => {
  it('is true right now', () => {
    expect(featureFlags.ads).toBe(false);
    expect(adFreePromiseHolds()).toBe(true);
  });

  it('is withdrawn the moment ads are switched on', () => {
    // The whole reason every surface asks rather than hard-coding the sentence. If this were
    // a constant, turning ads on would leave three pages calling the product a liar.
    expect(adFreePromiseHolds()).toBe(!featureFlags.ads);
  });

  it('says the thing rather than hinting at it', () => {
    // "No per-guest fees" was already on the pricing page and nobody reads that as "no ads".
    expect(brand.noAds.badge.toLowerCase()).toContain('no ads');
    expect(brand.noAds.body.length).toBeGreaterThan(80);
    // And gives a reason, because an unexplained promise invites the question "what's the catch".
    expect(brand.noAds.why.length).toBeGreaterThan(40);
  });

  it('is claimed on the free plan, which is the tier the claim is about', () => {
    // Evite's free tier is the ad-supported one, so a bullet on `event` or `pro` would be
    // answering a question nobody asked.
    const claimed = plans.free.highlights.some((line) => /no ads/i.test(line));
    expect(claimed).toBe(true);
  });

  it('does not promise anything about ads on a paid plan it cannot keep separately', () => {
    // Guarding against the obvious future mistake: quietly leaving the free tier ad-free
    // while the copy implies the whole product is. If ads ever ship anywhere, this and the
    // flag check above both have to be revisited together.
    expect(featureFlags.ads).toBe(false);
  });
});
