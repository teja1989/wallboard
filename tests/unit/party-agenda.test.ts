import { describe, expect, it } from 'vitest';
import { agendaItemSchema, createEventSchema, updateEventSchema } from '@/lib/validation/schemas';

describe('Party Agenda & Schedule Timeline Rules', () => {
  it('validates individual agenda items correctly', () => {
    const valid = agendaItemSchema.safeParse({
      id: 'agenda_1',
      time: '4:15 PM',
      title: 'Cake Cutting & Happy Birthday',
      description: 'Singing Happy Birthday and blowing candles',
      emoji: '🎂',
    });
    expect(valid.success).toBe(true);

    const invalid = agendaItemSchema.safeParse({
      id: 'agenda_2',
      time: '',
      title: '',
    });
    expect(invalid.success).toBe(true); // cleanText defaults
  });

  it('accepts agenda arrays within createEventSchema', () => {
    const valid = createEventSchema.safeParse({
      title: "Leo's 5th Birthday Party",
      occasion: 'birthday',
      hostedBy: 'Sarah & David',
      expiryPresetId: '7d',
      startsAt: Date.now() + 86400000,
      agenda: [
        { id: '1', time: '2:00 PM', title: 'Arrival & Games', emoji: '🎈' },
        { id: '2', time: '3:30 PM', title: 'Magic Show', emoji: '✨' },
        { id: '3', time: '4:15 PM', title: 'Cake Cutting', emoji: '🎂' },
        { id: '4', time: '5:00 PM', title: 'Piñata & Favors', emoji: '🪅' },
      ],
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.agenda).toHaveLength(4);
      expect(valid.data.agenda?.[2]?.title).toBe('Cake Cutting');
    }
  });

  it('accepts updated agenda arrays within updateEventSchema', () => {
    const valid = updateEventSchema.safeParse({
      agenda: [{ id: '1', time: '2:30 PM', title: 'Delayed Start', emoji: '🎈' }],
    });
    expect(valid.success).toBe(true);
  });
});
