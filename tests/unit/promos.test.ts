import { describe, expect, it } from 'vitest';
import { activePromo, anyActivePromo, bestPlan, promoCopy, promos, type Promo } from '@/config';

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

/**
 * Being seen.
 *
 * A promo used to be resolved at creation, recorded in the audit log, and mentioned to
 * nobody: a host got a free upgrade without being told, and the pricing page said nothing
 * while a window was open. A promo nobody notices attracts nobody, which is the only reason
 * to run one — so the marketing surfaces need a resolver that does not require an event.
 */
describe('a promo the world can see', () => {
  it('finds one without being told an occasion', () => {
    const table = [promo({ occasions: ['birthday'] })];
    // The pricing page has no event and therefore no occasion, and still has to say this.
    expect(anyActivePromo(NOW, table)?.id).toBe('launch');
  });

  it('respects the window exactly as the per-event resolver does', () => {
    const table = [promo()];
    expect(anyActivePromo(NOW - 2 * DAY, table)).toBeNull();
    expect(anyActivePromo(NOW + 2 * DAY, table)).toBeNull();
    // Half-open, so two back-to-back windows are never both live.
    expect(anyActivePromo(table[0]!.endsAt, table)).toBeNull();
    expect(anyActivePromo(table[0]!.startsAt, table)?.id).toBe('launch');
  });

  it('picks the same winner as the per-event resolver when both apply', () => {
    // Two surfaces disagreeing about which promo is on would be worse than neither showing.
    const table = [
      promo({ id: 'small', grantsPlanId: 'event' }),
      promo({ id: 'big', grantsPlanId: 'pro' }),
    ];
    expect(anyActivePromo(NOW, table)?.id).toBe('big');
    expect(activePromo('birthday', NOW, table)?.id).toBe('big');
  });

  it('says what a scoped promo is scoped to, and stays quiet when it is not', () => {
    // A partial offer read as a general one is a promise we would then have to break.
    const scoped = promo({ occasions: ['birthday'] });
    expect(promoCopy.limitedTo(scoped, ['birthdays'])).toContain('birthdays');
    expect(promoCopy.limitedTo(promo({ occasions: null }), [])).toBe('');
  });

  it('explains a grant in terms of the plan the host actually got', () => {
    expect(promoCopy.granted(promo(), 'One event')).toContain('One event');
  });
});

describe('the shipped promo table', () => {
  it('is empty, so nothing here is live by accident', () => {
    // The machinery is exercised by the tables above. This asserts the *shipped* one is
    // deliberate — a promo has real storage costs and belongs in a reviewed commit.
    expect(promos).toEqual([]);
    expect(anyActivePromo()).toBeNull();
  });
});
