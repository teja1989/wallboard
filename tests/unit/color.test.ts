import { describe, expect, it } from 'vitest';
import { templates } from '@/config';
import { oklchToHex } from '@/lib/color';

describe('oklchToHex', () => {
  it('maps the achromatic endpoints exactly', () => {
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000');
  });

  it('accepts lightness as a percentage', () => {
    expect(oklchToHex('oklch(100% 0 0)')).toBe('#ffffff');
  });

  it('converts a known hue into the right corner of the space', () => {
    // A saturated red: red dominant, blue least.
    const hex = oklchToHex('oklch(0.628 0.2577 29.23)');
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(200);
    expect(r).toBeGreaterThan(g!);
    expect(g!).toBeGreaterThanOrEqual(b!);
  });

  it('passes hex through and falls back on anything else', () => {
    expect(oklchToHex('#abcdef')).toBe('#abcdef');
    expect(oklchToHex('rebeccapurple', '#123456')).toBe('#123456');
  });

  it('renders every template palette to a real colour', () => {
    // The preview card is generated from these, so none may fall back silently.
    for (const template of templates) {
      for (const value of Object.values(template.palette)) {
        expect(oklchToHex(value, 'FALLBACK')).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});
