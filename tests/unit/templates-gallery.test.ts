import { describe, expect, it } from 'vitest';
import {
  templates,
  templateById,
  templatesForOccasion,
  sampleForTemplate,
} from '@/config';

describe('Templates Gallery & Showcase Metadata', () => {
  it('contains exactly 15 signature templates', () => {
    expect(templates.length).toBe(15);
  });

  it('provides rich sample showcase metadata for all templates', () => {
    for (const template of templates) {
      const sample = sampleForTemplate(template.id);
      expect(sample).toBeDefined();
      expect(sample.sampleTitle.length).toBeGreaterThan(0);
      expect(sample.sampleSubtitle.length).toBeGreaterThan(0);
      expect(sample.sampleDate.length).toBeGreaterThan(0);
      expect(sample.sampleLocation.length).toBeGreaterThan(0);
      expect(sample.tags.length).toBeGreaterThan(0);
    }
  });

  it('filters templates accurately by occasion', () => {
    const birthdayTemplates = templatesForOccasion('birthday');
    expect(birthdayTemplates.length).toBeGreaterThan(0);
    expect(birthdayTemplates.some((t) => t.id === 'carnival')).toBe(true);

    const weddingTemplates = templatesForOccasion('wedding');
    expect(weddingTemplates.length).toBeGreaterThan(0);
    expect(weddingTemplates.some((t) => t.id === 'champagne')).toBe(true);
  });

  it('retrieves default template when unknown ID is passed', () => {
    const fallback = templateById('non-existent-template');
    expect(fallback).toBeDefined();
    expect(fallback.id).toBe(templates[0]?.id);
  });
});
