import { describe, expect, it } from 'vitest';
import { calculateContributionFees, plans } from '@/config';
import { contributeToFundSchema, createFundSchema } from '@/lib/validation/schemas';

describe('Payment, Subscriptions & Cash Pot Workflow Rules', () => {
  describe('Fee calculations and take-rates', () => {
    it('calculates exact 2.5% platform take-rate and processing fees', () => {
      const fees100 = calculateContributionFees(100);
      expect(fees100.giftAmount).toBe(100);
      expect(fees100.platformFee).toBe(2.5); // 2.5% of 100
      expect(fees100.hostReceives).toBe(100); // 100% of gift to host
      expect(fees100.totalCharged).toBeGreaterThan(100);

      const fees50 = calculateContributionFees(50);
      expect(fees50.platformFee).toBe(1.25); // 2.5% of 50
      expect(fees50.hostReceives).toBe(50);
    });

    it('enforces contribution boundaries ($5 to $5000)', () => {
      const valid = contributeToFundSchema.safeParse({
        fundId: 'fund_1234567890',
        amount: 250,
        donorName: 'Uncle Bob',
        message: 'Wishing you a lifetime of joy!',
        showOnWall: true,
      });
      expect(valid.success).toBe(true);

      const tooLow = contributeToFundSchema.safeParse({
        fundId: 'fund_1234567890',
        amount: 2,
        donorName: 'Friend',
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = contributeToFundSchema.safeParse({
        fundId: 'fund_1234567890',
        amount: 10000,
        donorName: 'Friend',
      });
      expect(tooHigh.success).toBe(false);
    });
  });

  describe('SaaS Plans & Entitlements configuration', () => {
    it('provides Free, Event Unlock (Plus), and Pro subscription plans', () => {
      expect(plans.free).toBeDefined();
      expect(plans.event).toBeDefined();
      expect(plans.pro).toBeDefined();

      expect(plans.free.price).toBeNull();
      expect(plans.event.price).toBe(19);
      expect(plans.pro.price).toBe(79);
    });

    it('validates cash fund creation constraints', () => {
      const fund = createFundSchema.safeParse({
        title: 'Honeymoon in Japan',
        description: 'Exploring Tokyo and Kyoto',
        category: 'honeymoon',
        targetAmount: 3500,
        suggestedPresets: [50, 100, 200, 500],
      });
      expect(fund.success).toBe(true);
    });
  });
});
