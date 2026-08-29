import { describe, expect, it } from 'vitest';
import { DAY, HOUR, dueReminderSlot, reminderSlots, remindersConfig } from '@/config';
import { createEventSchema, updateEventSchema } from '@/lib/validation/schemas';

/**
 * Which guests get emailed, and when.
 *
 * `dueReminderSlot` is pure precisely so this can be exhaustive: it decides whether other
 * people's guests receive mail, and the expensive failure is not a missed reminder but an
 * unwanted one. Every refusal below is a real way that could happen.
 */

const NOW = Date.UTC(2026, 8, 1, 12, 0, 0);

function event(overrides: Partial<Parameters<typeof dueReminderSlot>[0]> = {}) {
  return {
    startsAt: NOW + 30 * DAY,
    createdAt: NOW - DAY,
    remindersSent: [] as string[],
    rsvpEnabled: true,
    autoRemind: true,
    rsvpDeadline: null,
    ...overrides,
  };
}

describe('when a reminder is due', () => {
  it('sends nothing while the event is still far off', () => {
    expect(dueReminderSlot(event(), NOW)).toBeNull();
  });

  it('fires the week-before slot a week before', () => {
    const startsAt = NOW + 7 * DAY;
    expect(dueReminderSlot(event({ startsAt }), NOW)?.id).toBe('week');
  });

  it('fires the two-day slot two days before', () => {
    const startsAt = NOW + 2 * DAY;
    expect(dueReminderSlot(event({ startsAt }), NOW)?.id).toBe('twoDays');
  });

  it('never fires the same slot twice', () => {
    const startsAt = NOW + 7 * DAY;
    expect(dueReminderSlot(event({ startsAt, remindersSent: ['week'] }), NOW)).toBeNull();
  });

  it('takes the nearest outstanding slot rather than every overdue one', () => {
    /*
      An event two days out has passed both slots. It gets one nudge, not two — a guest who
      receives "a week to go" and "two days to go" in the same minute has learned that this
      product sends duplicate mail, which is the reputation cost the whole design avoids.
    */
    const startsAt = NOW + 2 * DAY;
    const slot = dueReminderSlot(event({ startsAt, createdAt: NOW - 30 * DAY }), NOW);
    expect(slot?.id).toBe('twoDays');
  });
});

describe('when a reminder must not go out', () => {
  it('does not fire a slot that fell due before the invitation existed', () => {
    /*
      The one that would have been embarrassing. An event created three days out has already
      "passed" the week-before mark — without this rule, publishing would fire a week-before
      nudge at everybody seconds after they received the invitation itself.
    */
    const startsAt = NOW + 3 * DAY;
    const justCreated = event({ startsAt, createdAt: NOW - HOUR });
    expect(dueReminderSlot(justCreated, NOW)).toBeNull();
  });

  it('goes quiet once replies have closed', () => {
    // Nothing to chase: the invitation already shows as closed to anyone who opens it.
    const startsAt = NOW + 7 * DAY;
    expect(dueReminderSlot(event({ startsAt, rsvpDeadline: NOW - HOUR }), NOW)).toBeNull();
  });

  it('goes quiet close to the day', () => {
    // A nudge to reply that lands hours beforehand is noise — the headcount is what it is.
    const startsAt = NOW + remindersConfig.minLeadMs - HOUR;
    expect(dueReminderSlot(event({ startsAt, createdAt: NOW - 30 * DAY }), NOW)).toBeNull();
  });

  it('respects a host who turned it off', () => {
    const startsAt = NOW + 7 * DAY;
    expect(dueReminderSlot(event({ startsAt, autoRemind: false }), NOW)).toBeNull();
  });

  it('sends nothing for an invitation that is not collecting replies', () => {
    const startsAt = NOW + 7 * DAY;
    expect(dueReminderSlot(event({ startsAt, rsvpEnabled: false }), NOW)).toBeNull();
  });

  it('sends nothing when there is no date to count back from', () => {
    expect(dueReminderSlot(event({ startsAt: null }), NOW)).toBeNull();
  });

  it('sends nothing after the event has happened', () => {
    expect(dueReminderSlot(event({ startsAt: NOW - DAY }), NOW)).toBeNull();
  });
});

describe('the schedule itself', () => {
  it('has unique, stable ids', () => {
    // The id is what is written to the event. Renaming one re-sends it to everybody.
    const ids = reminderSlots.map((slot) => slot.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stays short enough not to become nagging', () => {
    expect(reminderSlots.length).toBeLessThanOrEqual(3);
  });

  it('never schedules a slot inside the quiet window before the event', () => {
    // A slot closer than `minLeadMs` could never fire, so it would be dead config.
    for (const slot of reminderSlots) {
      expect(slot.beforeMs, slot.id).toBeGreaterThan(remindersConfig.minLeadMs);
    }
  });
});

/**
 * The schema shape that has now caused two bugs in this repo.
 *
 * `.partial()` makes a key optional but leaves its `.default()` in place, and a default on a
 * field is indistinguishable, at the handler, from a value the caller sent. So a "partial"
 * update arrives complete and overwrites everything it did not mention.
 *
 * First it wiped a milestone's budget when a box was ticked. Then it reset party size and
 * blanked a host's custom question when the reminder switch was flipped. Both were found by
 * a test asserting the *shape* rather than the symptom, which is what these do.
 */
describe('patching RSVP settings', () => {
  it('carries only what the request actually sent', () => {
    const parsed = updateEventSchema.parse({ rsvp: { autoRemind: false } });
    expect(Object.keys(parsed.rsvp ?? {})).toEqual(['autoRemind']);
  });

  it('does not resurrect a default for a field nobody mentioned', () => {
    const parsed = updateEventSchema.parse({ rsvp: { question: 'Allergies?' } });
    expect(parsed.rsvp).not.toHaveProperty('maxPartySize');
    expect(parsed.rsvp).not.toHaveProperty('autoRemind');
    expect(parsed.rsvp).not.toHaveProperty('enabled');
  });

  it('does not silently blank the venue or the timezone', () => {
    /*
      The worst instance of the four, and the one a smoke assertion caught before it shipped.
      `location` and `timeZone` both ended `.nullable().default(null)`, so *every* settings
      patch parsed to `{ location: null, timeZone: null }` — and a handler applying what it
      parsed would erase the venue and the zone on any edit at all.

      Losing the zone is not cosmetic: it is what makes every guest see the right hour, and
      formatting a time without it is a bug this project has already fixed once.
    */
    const parsed = updateEventSchema.parse({ title: 'Renamed' });
    expect(parsed).not.toHaveProperty('location');
    expect(parsed).not.toHaveProperty('timeZone');
    expect(Object.keys(parsed)).toEqual(['title']);
  });

  it('still fills the blanks in when an event is being created', () => {
    // The other half: creation genuinely wants every default, which is why there are two
    // schemas rather than one used two ways.
    const created = createEventSchema.parse({
      title: 'A party',
      occasion: 'party',
      expiryPresetId: '24h',
    });
    expect(created.rsvp.autoRemind).toBe(true);
    expect(created.rsvp.maxPartySize).toBe(2);
  });
});
