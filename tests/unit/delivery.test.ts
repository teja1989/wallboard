import { describe, expect, it } from 'vitest';
import { canTransition, deliveryCopy, DELIVERY_STATES } from '@/config';
import { describePhone, isDialable, looksLikePhone, normalizePhone } from '@/lib/phone';
import type { DeliveryState } from '@/types/domain';

/**
 * The ladder only moves forwards.
 *
 * Delivery receipts arrive late, out of order, and sometimes after the guest has already
 * replied. Without this rule a carrier acknowledging a twenty-minute-old message would
 * overwrite "seen" with "delivered", and the host would go chasing someone who had already
 * answered them.
 */
describe('canTransition', () => {
  it('climbs the ladder', () => {
    expect(canTransition('pending', 'sent')).toBe(true);
    expect(canTransition('sent', 'delivered')).toBe(true);
    expect(canTransition('delivered', 'seen')).toBe(true);
    expect(canTransition('seen', 'replied')).toBe(true);
  });

  it('refuses to go backwards', () => {
    expect(canTransition('seen', 'delivered')).toBe(false);
    expect(canTransition('replied', 'seen')).toBe(false);
    expect(canTransition('delivered', 'sent')).toBe(false);
  });

  it('refuses to repeat a state', () => {
    expect(canTransition('sent', 'sent')).toBe(false);
    expect(canTransition('replied', 'replied')).toBe(false);
  });

  it('lets a send fail, and lets a later send supersede the failure', () => {
    expect(canTransition('pending', 'failed')).toBe(true);
    expect(canTransition('failed', 'sent')).toBe(true);
    expect(canTransition('failed', 'delivered')).toBe(true);
  });

  it('ignores bad news about a message someone has already read', () => {
    // A late bounce for an invitation the guest demonstrably opened is stale, not news.
    expect(canTransition('seen', 'bounced')).toBe(false);
    expect(canTransition('replied', 'failed')).toBe(false);
    expect(canTransition('sent', 'bounced')).toBe(true);
  });

  it('lets the guest opt out from anywhere, and never undoes it', () => {
    for (const state of DELIVERY_STATES) {
      if (state === 'unsubscribed') continue;
      expect(canTransition(state, 'unsubscribed')).toBe(true);
      expect(canTransition('unsubscribed', state)).toBe(false);
    }
  });

  it('has host-facing copy for every state', () => {
    for (const state of DELIVERY_STATES) {
      expect(deliveryCopy[state as DeliveryState].label.length).toBeGreaterThan(0);
    }
  });
});

/**
 * A number stored as somebody typed it is a number that cannot be dialled, deduplicated, or
 * checked against an opt-out list — and the guest silently never hears anything.
 */
describe('normalizePhone', () => {
  it('normalises the shapes a contacts app produces to one E.164 number', () => {
    for (const input of ['+1 415 555 0123', '(415) 555-0123', '415.555.0123', '4155550123']) {
      expect(normalizePhone(input)).toBe('+14155550123');
    }
  });

  it('keeps an international number in its own country', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('refuses what it cannot dial rather than storing a guess', () => {
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone('not a number')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('555')).toBeNull();
  });

  it('agrees with isDialable', () => {
    expect(isDialable('+14155550123')).toBe(true);
    expect(isDialable('nope')).toBe(false);
  });

  it('shows a number back with its country code, so a bad guess is visible', () => {
    expect(describePhone('+14155550123')).toBe('+1 415 555 0123');
  });
});

describe('looksLikePhone', () => {
  it('recognises what was meant to be a number', () => {
    expect(looksLikePhone('+1 415 555 0123')).toBe(true);
    expect(looksLikePhone('(415) 555-0123')).toBe(true);
  });

  it('does not mistake an address or a sentence for one', () => {
    expect(looksLikePhone('priya@example.com')).toBe(false);
    expect(looksLikePhone('please invite everyone')).toBe(false);
  });

  it('does not mistake a year or a house number for one', () => {
    expect(looksLikePhone('2026')).toBe(false);
    expect(looksLikePhone('12')).toBe(false);
  });
});
