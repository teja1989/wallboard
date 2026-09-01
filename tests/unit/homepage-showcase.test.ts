import { describe, expect, it } from 'vitest';
import { brand, occasions, templates } from '@/config';

describe('Home Page & Showcase Content Matrix', () => {
  it('defines core brand promises and zero-ad guarantees', () => {
    expect(brand.tagline).toBeDefined();
    expect(brand.promise).toBeDefined();
    expect(brand.noAds.headline).toBeDefined();
  });

  it('supports all core event occasions for rapid landing page discovery', () => {
    const ids = occasions.map((o) => o.id);
    expect(ids).toContain('birthday');
    expect(ids).toContain('graduation');
    expect(ids).toContain('wedding');
    expect(ids).toContain('baby');
    expect(ids).toContain('party');
    expect(ids).toContain('memorial');
  });

  it('provides signature template palettes with contrast tokens', () => {
    expect(templates.length).toBeGreaterThanOrEqual(15);
    for (const t of templates) {
      expect(t.palette.from).toBeDefined();
      expect(t.palette.to).toBeDefined();
    }
  });
});
