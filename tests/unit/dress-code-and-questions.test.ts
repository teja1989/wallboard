import { describe, expect, it } from 'vitest';
import { DRESS_CODE_PRESETS, findDressCodePreset } from '@/config/dress-code.config';
import { createEventSchema, rsvpSchema } from '@/lib/validation/schemas';

describe('Dress Code & Custom RSVP Questions', () => {
  it('has curated visual dress code presets with valid color palettes', () => {
    expect(DRESS_CODE_PRESETS.length).toBeGreaterThanOrEqual(5);

    for (const preset of DRESS_CODE_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.emoji.length).toBeGreaterThan(0);
      expect(preset.palette.length).toBeGreaterThanOrEqual(3);
      expect(preset.shortHint.length).toBeGreaterThan(0);
    }
  });

  it('matches dress code presets by substring or label', () => {
    expect(findDressCodePreset('Black Tie & Glamour')?.id).toBe('black-tie');
    expect(findDressCodePreset('Cocktail Chic')?.id).toBe('cocktail');
    expect(findDressCodePreset('Summer Pastel & Garden')?.id).toBe('garden-pastel');
    expect(findDressCodePreset('Something completely custom')).toBeNull();
  });

  it('validates custom RSVP questions and answers in event schemas', () => {
    const validCreate = createEventSchema.safeParse({
      title: 'Graduation Gala',
      occasion: 'party',
      hostedBy: 'Sarah Jenkins',
      templateId: 'midnight',
      startsAt: Date.now() + 86400000,
      endsAt: null,
      timeZone: 'America/New_York',
      location: null,
      dressCode: 'Cocktail Chic',
      rsvp: {
        enabled: true,
        deadline: null,
        allowPlusOnes: true,
        maxPartySize: 3,
        askNote: false,
        question: 'What song will get you on the dance floor?',
      },
      expiryPresetId: '7d',
    });
    expect(validCreate.success).toBe(true);
    if (validCreate.success) {
      expect(validCreate.data.dressCode).toBe('Cocktail Chic');
      expect(validCreate.data.rsvp.question).toBe('What song will get you on the dance floor?');
    }

    const validRsvp = rsvpSchema.safeParse({
      status: 'yes',
      adults: 2,
      children: 0,
      note: 'Looking forward to it!',
      answer: 'September by Earth, Wind & Fire',
    });

    expect(validRsvp.success).toBe(true);
    if (validRsvp.success) {
      expect(validRsvp.data.answer).toBe('September by Earth, Wind & Fire');
    }
  });
});
