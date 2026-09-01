import { describe, expect, it } from 'vitest';
import { FUNNEL_EVENTS, funnelRatios, funnelRollupEventLimit } from '@/config';

describe('the ratio table', () => {
  it('only names counters that exist', () => {
    // A typo here is a ratio that silently reads 0/0 forever and nobody notices a number
    // that was never there — the same failure the closed union of event names exists to stop.
    const declared = new Set<string>(FUNNEL_EVENTS);
    for (const ratio of funnelRatios) {
      expect(declared.has(ratio.numerator), `${ratio.id} numerator`).toBe(true);
      expect(declared.has(ratio.denominator), `${ratio.id} denominator`).toBe(true);
    }
  });

  it('never divides a counter by itself', () => {
    for (const ratio of funnelRatios) {
      expect(ratio.numerator, ratio.id).not.toBe(ratio.denominator);
    }
  });

  it('has unique ids', () => {
    const ids = funnelRatios.map((ratio) => ratio.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('says what each one decides, because that is the whole point', () => {
    // A dashboard of numbers with no consequence attached is one nobody opens twice.
    for (const ratio of funnelRatios) {
      expect(ratio.decides.length, ratio.id).toBeGreaterThan(30);
    }
  });

  it('allows over-100% only where it is genuinely possible', () => {
    /*
      Anything measured against `inviteSent` can legitimately exceed it: a link forwarded into
      a group chat is an open with no send behind it. Anything measured against a counter that
      is itself downstream cannot, so flagging it there would excuse a real bug.
    */
    for (const ratio of funnelRatios) {
      if (ratio.canExceedOne) {
        expect(ratio.denominator, ratio.id).toBe('inviteSent');
      }
    }
  });

  it('covers the question the gift list was built to answer', () => {
    // C2 exists for exactly one number. If it ever drops out of this table, the feature
    // becomes unfalsifiable again.
    const gift = funnelRatios.find((ratio) => ratio.numerator === 'giftLinkClicked');
    expect(gift).toBeDefined();
    expect(gift?.denominator).toBe('invitationOpened');
  });
});

describe('the rollup', () => {
  it('is bounded, because it reads one subcollection per event', () => {
    // N+1 is the deliberate trade — no collection-group index to get wrong — but only while
    // N is capped.
    expect(funnelRollupEventLimit).toBeGreaterThan(0);
    expect(funnelRollupEventLimit).toBeLessThanOrEqual(500);
  });
});
