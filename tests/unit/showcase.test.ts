import { describe, expect, it } from 'vitest';
import { defaultShowcaseEvent, occasionById, showcaseItems, templateById } from '@/config';
import { surfaceMoves } from '@/components/event/template-surface';

describe('Showcase configuration & fixtures', () => {
  it('defines the required showcase event fixtures', () => {
    expect(showcaseItems.length).toBeGreaterThanOrEqual(7);
    const ids = showcaseItems.map((item) => item.id);
    expect(ids).toContain('birthday');
    expect(ids).toContain('graduation');
    expect(ids).toContain('wedding');
    expect(ids).toContain('baby');
    expect(ids).toContain('party');
    expect(ids).toContain('retirement');
    expect(ids).toContain('memorial');
  });

  it('binds valid templates, occasions, and non-empty metadata to each fixture', () => {
    for (const item of showcaseItems) {
      expect(item.label).toBeTruthy();
      expect(item.tagline).toBeTruthy();
      const event = item.event;
      expect(event.title).toBeTruthy();
      expect(event.hostedBy).toBeTruthy();
      expect(event.startsAt).toBeGreaterThan(0);
      expect(event.location?.name).toBeTruthy();
      expect(event.location?.address).toBeTruthy();

      // Valid template and occasion lookups
      const template = templateById(event.templateId);
      expect(template).toBeDefined();
      const occasion = occasionById(event.occasion);
      expect(occasion).toBeDefined();
    }
  });

  it('guarantees somber occasions do not animate decorative surfaces', () => {
    const memorialItem = showcaseItems.find((item) => item.id === 'memorial');
    expect(memorialItem).toBeDefined();
    if (memorialItem) {
      const occasion = occasionById(memorialItem.event.occasion);
      expect(occasion.somber).toBe(true);
      const template = templateById(memorialItem.event.templateId);
      expect(surfaceMoves(template.surface, occasion.somber)).toBe(false);
    }
  });

  it('exports defaultShowcaseEvent matching the primary birthday fixture', () => {
    expect(defaultShowcaseEvent).toBeDefined();
    expect(defaultShowcaseEvent.id).toBe('showcase-birthday');
  });
});
