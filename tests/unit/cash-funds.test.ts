import { describe, expect, it } from 'vitest';
import { calculateContributionFees, FUND_PRESETS } from '@/config';
import { createFundSchema, contributeToFundSchema } from '@/lib/validation/schemas';

describe('Collective Cash Funds & Dream Gifting Rules', () => {
  it('calculates accurate 2.5% platform fees and host payouts', () => {
    const fee100 = calculateContributionFees(100);
    expect(fee100.giftAmount).toBe(100);
    expect(fee100.platformFee).toBe(2.5);
    expect(fee100.hostReceives).toBe(100);
    expect(fee100.totalCharged).toBeGreaterThan(100);

    const fee50 = calculateContributionFees(50);
    expect(fee50.giftAmount).toBe(50);
    expect(fee50.platformFee).toBe(1.25);
    expect(fee50.hostReceives).toBe(50);
  });

  it('contains rich starter presets for all major occasions', () => {
    expect(FUND_PRESETS.length).toBeGreaterThanOrEqual(5);

    const honeymoon = FUND_PRESETS.find((p) => p.category === 'honeymoon');
    expect(honeymoon).toBeDefined();
    expect(honeymoon?.glyph).toBe('✈️');

    const baby = FUND_PRESETS.find((p) => p.category === 'baby');
    expect(baby).toBeDefined();
    expect(baby?.glyph).toBe('🍼');
  });

  it('validates fund creation schemas correctly', () => {
    const valid = createFundSchema.safeParse({
      title: 'Amalfi Coast Honeymoon',
      description: 'Help us celebrate in Italy!',
      category: 'honeymoon',
      targetAmount: 2500,
      suggestedPresets: [50, 100, 200, 500],
    });
    expect(valid.success).toBe(true);

    const invalid = createFundSchema.safeParse({
      title: '', // Empty title rejected
      category: 'honeymoon',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates gift contribution schema rules', () => {
    const valid = contributeToFundSchema.safeParse({
      fundId: 'fund_1234567890',
      amount: 50,
      contributorName: 'Sarah & Kevin',
      message: 'Congrats on your wedding!',
      isAnonymous: false,
      postToWall: true,
    });
    expect(valid.success).toBe(true);

    const belowMin = contributeToFundSchema.safeParse({
      fundId: 'fund_1234567890',
      amount: 2, // Below $5 minimum
    });
    expect(belowMin.success).toBe(false);
  });
});
