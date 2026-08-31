import { describe, expect, it } from 'vitest';
import { plans, planOrder, formatPrice, type PlanId } from '@/config';

describe('Pricing Calculator & Tier Rules', () => {
  it('correctly maps plan IDs and order', () => {
    expect(planOrder).toEqual(['free', 'event', 'pro']);
  });

  it('verifies entitlement capacities across tiers', () => {
    expect(plans.free.entitlements.maxGuests).toBe(25);
    expect(plans.event.entitlements.maxGuests).toBe(250);
    expect(plans.pro.entitlements.maxGuests).toBe(500);

    expect(plans.free.entitlements.maxStorageBytesPerEvent).toBeLessThan(
      plans.event.entitlements.maxStorageBytesPerEvent,
    );
    expect(plans.event.entitlements.maxStorageBytesPerEvent).toBeLessThan(
      plans.pro.entitlements.maxStorageBytesPerEvent,
    );
  });

  it('formats prices cleanly', () => {
    expect(formatPrice(plans.free)).toBe('Free');
    expect(formatPrice(plans.event)).toBe('$19');
    expect(formatPrice(plans.pro)).toBe('$79');
  });

  it('validates guest headcount recommendation ranges', () => {
    function getRecommendedPlan(guests: number): PlanId {
      return guests <= 25 ? 'free' : guests <= 250 ? 'event' : 'pro';
    }

    expect(getRecommendedPlan(10)).toBe('free');
    expect(getRecommendedPlan(25)).toBe('free');
    expect(getRecommendedPlan(26)).toBe('event');
    expect(getRecommendedPlan(150)).toBe('event');
    expect(getRecommendedPlan(250)).toBe('event');
    expect(getRecommendedPlan(251)).toBe('pro');
    expect(getRecommendedPlan(500)).toBe('pro');
  });
});
