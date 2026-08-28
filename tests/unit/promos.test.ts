import { describe, expect, it } from 'vitest';
import { activePromo, bestPlan, promos, type Promo } from '@/config';

/**
 * Promos.
 *
 * The whole design is one rule — **a grant is a fact recorded at a moment, not a rule
 * evaluated later** — so these tests are mostly about the boundaries of the window and about
 * a promo never being able to take something away.
 *
 * `activePromo` is pure and takes `now`, which is what makes any of this testable without
 * waiting for a Tuesday.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 15, 12);

function promo(overrides: Partial<Promo> = {}): Promo {
  return {
    id: 'launch',
    label: 'Launch week',
    grantsPlanId: 'event',
    startsAt: NOW - DAY,
    endsAt: NOW + DAY,
    occasions: null,
    ...overrides,
  };
}

describe('the shipped promo table', () => {
  it('is empty, so nothing is being given away unintentionally', () => {
    // A promo costs real storage for every event created in its window. It should arrive in a
    // commit somebody reviewed, not by accident.
    expect(promos).toEqual([]);
  });

  it('means no promo is active at any time', () => {
    expect(activePromo('party', NOW)).toBeNull();
    expect(activePromo('birthday', 0)).toBeNull();
  });
});

describe('the window', () => {
  it('includes the start instant and excludes the end', () => {
    const table = [promo({ startsAt: NOW, endsAt: NOW + DAY })];
    // Half-open, so two back-to-back promos can never both be live for one millisecond.
    expect(activePromo('party', NOW, table)).not.toBeNull();
    expect(activePromo('party', NOW + DAY - 1, table)).not.toBeNull();
    expect(activePromo('party', NOW + DAY, table)).toBeNull();
    expect(activePromo('party', NOW - 1, table)).toBeNull();
  });

  it('can be scoped to particular occasions', () => {
    const table = [promo({ occasions: ['birthday'] })];
    expect(activePromo('birthday', NOW, table)).not.toBeNull();
    expect(activePromo('wedding', NOW, table)).toBeNull();
  });

  it('applies to every occasion when it names none', () => {
    const table = [promo({ occasions: null })];
    expect(activePromo('wedding', NOW, table)).not.toBeNull();
  });
});

describe('bestPlan', () => {
  it('picks the stronger of two', () => {
    expect(bestPlan('free', 'event')).toBe('event');
    expect(bestPlan('pro', 'event')).toBe('pro');
    expect(bestPlan('event', 'event')).toBe('event');
  });

  it('is what stops a promo downgrading someone who already pays for more', () => {
    // A Pro subscriber creating an event during an `event`-tier promo keeps Pro. A promo may
    // only ever add.
    expect(bestPlan('pro', 'event')).toBe('pro');
    expect(bestPlan('event', 'free')).toBe('event');
  });

  it('is order-independent', () => {
    expect(bestPlan('free', 'pro')).toBe(bestPlan('pro', 'free'));
  });
});
