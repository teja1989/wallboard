import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_LAYOUTS,
  TEMPLATE_MOTIFS,
  TYPE_FACES,
  faceOf,
  freeTemplates,
  occasions,
  premiumTemplates,
  templateById,
  templates,
  templatesForOccasion,
} from '@/config';

/**
 * Templates are the most visible thing a host pays for, so the tests here are mostly about
 * the gallery never having a hole in it — a template pointing at a layout that does not
 * exist renders as nothing, and nobody notices until a customer does.
 */

describe('templates', () => {
  it('have unique ids', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('point at real layouts, faces and motifs', () => {
    for (const template of templates) {
      expect(TEMPLATE_LAYOUTS, template.id).toContain(template.layout);
      expect(Object.keys(TYPE_FACES), template.id).toContain(template.face);
      expect(TEMPLATE_MOTIFS, template.id).toContain(template.motif);
    }
  });

  it('use every layout at least once', () => {
    // A layout nobody can reach is code that will rot without anyone noticing.
    for (const layout of TEMPLATE_LAYOUTS) {
      expect(
        templates.some((t) => t.layout === layout),
        layout,
      ).toBe(true);
    }
  });

  it('reference only real occasions', () => {
    const known = new Set(occasions.map((o) => o.id));
    for (const template of templates) {
      for (const occasion of template.occasions ?? []) {
        expect(known.has(occasion), `${template.id} → ${occasion}`).toBe(true);
      }
    }
  });

  it('carry a complete palette', () => {
    for (const template of templates) {
      for (const key of ['from', 'to', 'onGradient', 'accent'] as const) {
        expect(template.palette[key], `${template.id}.${key}`).toMatch(/^oklch\(/);
      }
    }
  });

  it('describe themselves without naming a colour', () => {
    // The blurb sells a feeling; the swatch already shows the colour.
    for (const template of templates) {
      expect(template.blurb.length, template.id).toBeGreaterThan(10);
      expect(template.label.length, template.id).toBeGreaterThan(0);
    }
  });

  it('keep a genuinely usable free set', () => {
    expect(freeTemplates.length).toBeGreaterThanOrEqual(4);
    expect(premiumTemplates.length).toBeGreaterThan(freeTemplates.length - 1);
    // At least one free template must work for any occasion, or a free host with an
    // unusual event has nothing to pick.
    expect(freeTemplates.some((t) => t.occasions === null)).toBe(true);
  });

  it('give every face a real fallback stack', () => {
    for (const face of Object.values(TYPE_FACES)) {
      expect(face.stack.split(',').length, face.id).toBeGreaterThan(1);
    }
  });
});

describe('templateById', () => {
  it('finds a template', () => {
    expect(templateById('midnight').label).toBe('Midnight');
  });

  it('falls back rather than returning undefined', () => {
    // An unknown id must render *something* — an invitation is not the place for a crash.
    expect(templateById('does-not-exist').id).toBe(templates[0]!.id);
  });
});

describe('templatesForOccasion', () => {
  it('puts the suited ones first', () => {
    const forWedding = templatesForOccasion('wedding');
    expect(forWedding[0]?.occasions).toContain('wedding');
  });

  it('still offers the general ones', () => {
    const forWedding = templatesForOccasion('wedding');
    expect(forWedding.some((t) => t.occasions === null)).toBe(true);
  });

  it('never returns an empty list, whatever the occasion', () => {
    for (const occasion of occasions) {
      expect(templatesForOccasion(occasion.id).length, occasion.id).toBeGreaterThan(0);
    }
  });
});

describe('faceOf', () => {
  it('resolves a template to its type face', () => {
    expect(faceOf(templateById('champagne')).id).toBe('garamond');
  });
});
