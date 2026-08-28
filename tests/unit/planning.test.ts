import { describe, expect, it } from 'vitest';
import {
  MILESTONE_CATEGORIES,
  MILESTONE_CATEGORY_IDS,
  formatBudget,
  milestoneCategoryById,
  occasionPlans,
  occasions,
  planTemplateFor,
  planningLimits,
} from '@/config';
import { entitlementsFor } from '@/lib/billing/entitlements';
import {
  addMilestoneSchema,
  patchMilestoneSchema,
  milestoneIdSchema,
} from '@/lib/validation/schemas';

describe('the seeded plans', () => {
  it('give every occasion a list, named or default', () => {
    for (const occasion of occasions) {
      expect(planTemplateFor(occasion.id).length, occasion.id).toBeGreaterThan(0);
    }
  });

  it('fall back to the default for an occasion with no list of its own', () => {
    expect(planTemplateFor('party')).toEqual(planTemplateFor('nonsense-occasion'));
  });

  it('use keys that are unique within a plan', () => {
    // The key is what makes materialising idempotent. Two rows sharing one would make a
    // `template:` id ambiguous and let an edit land on the wrong row.
    for (const [occasionId, plan] of Object.entries(occasionPlans)) {
      const keys = (plan ?? []).map((row) => row.key);
      expect(new Set(keys).size, occasionId).toBe(keys.length);
    }
  });

  it('only name categories that exist', () => {
    const declared = new Set<string>(MILESTONE_CATEGORY_IDS);
    for (const [occasionId, plan] of Object.entries(occasionPlans)) {
      for (const row of plan ?? []) {
        expect(declared.has(row.categoryId), `${occasionId} → ${row.categoryId}`).toBe(true);
      }
    }
  });

  it('are ordered from earliest to latest, so the list reads as a sequence', () => {
    // Lead times count *backwards* from the event, so a sensible plan has them descending.
    // Out of order, the seeded list would tell a host to confirm numbers before booking.
    for (const [occasionId, plan] of Object.entries(occasionPlans)) {
      const leads = (plan ?? []).map((row) => row.leadMs);
      const sorted = [...leads].sort((a, b) => b - a);
      expect(leads, occasionId).toEqual(sorted);
    }
  });

  it('stay short enough to be read rather than skimmed past', () => {
    // A thirty-row checklist is not thorough, it is intimidating.
    for (const [occasionId, plan] of Object.entries(occasionPlans)) {
      expect((plan ?? []).length, occasionId).toBeLessThanOrEqual(14);
    }
  });

  it('never ask a memorial for gifts or entertainment', () => {
    // The person organising this is doing it in the worst week of their life. `somber` exists
    // so a memorial never inherits celebratory copy, and this is that rule applied to the plan.
    const plan = planTemplateFor('memorial');
    for (const row of plan) {
      expect(['gifts', 'music'], row.key).not.toContain(row.categoryId);
    }
  });

  it('never put a gift row on an occasion that does not carry a gift list', () => {
    for (const occasion of occasions) {
      if (occasion.giftsExpected) continue;
      for (const row of planTemplateFor(occasion.id)) {
        expect(row.categoryId, `${occasion.id} → ${row.key}`).not.toBe('gifts');
      }
    }
  });
});

describe('categories', () => {
  it('fall back to "everything else" rather than throwing', () => {
    expect(milestoneCategoryById('not-a-category').id).toBe('admin');
  });

  it('resolve a real one to itself', () => {
    for (const category of MILESTONE_CATEGORIES) {
      expect(milestoneCategoryById(category.id).id).toBe(category.id);
    }
  });
});

describe('the planning entitlement', () => {
  it('is off on free and on for anyone who paid', () => {
    // The free tier still *sees* the list — that is the pitch. It cannot work it.
    expect(entitlementsFor('free').eventPlanning).toBe(false);
    expect(entitlementsFor('event').eventPlanning).toBe(true);
    expect(entitlementsFor('pro').eventPlanning).toBe(true);
  });
});

describe('milestone input', () => {
  it('needs a title', () => {
    expect(addMilestoneSchema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('defaults an uncategorised row to "everything else"', () => {
    expect(addMilestoneSchema.parse({ title: 'Book a cab' }).categoryId).toBe('admin');
  });

  it('refuses a category that does not exist', () => {
    expect(addMilestoneSchema.safeParse({ title: 'x', categoryId: 'fireworks' }).success).toBe(
      false,
    );
  });

  it('takes a whole-currency budget and refuses a fractional one', () => {
    expect(addMilestoneSchema.parse({ title: 'Cake', budget: 120 }).budget).toBe(120);
    expect(addMilestoneSchema.safeParse({ title: 'Cake', budget: 12.5 }).success).toBe(false);
    expect(addMilestoneSchema.safeParse({ title: 'Cake', budget: -1 }).success).toBe(false);
    expect(
      addMilestoneSchema.safeParse({ title: 'Cake', budget: planningLimits.maxBudget + 1 }).success,
    ).toBe(false);
  });

  it('refuses a patch that changes nothing', () => {
    expect(patchMilestoneSchema.safeParse({}).success).toBe(false);
  });

  it('leaves out every field the request did not carry', () => {
    /*
      The handler applies a patch by spreading it over the stored row, so any field that
      *defaults* rather than staying absent silently overwrites what is there.

      `budget` briefly shared `.default(null)` with the add schema, which made a plain
      `{ done: true }` parse as `{ done: true, budget: null }` — so ticking a box wiped the
      host's budget for that row. This asserts the shape rather than the symptom, because the
      symptom only shows up against a real document.
    */
    expect(Object.keys(patchMilestoneSchema.parse({ done: true }))).toEqual(['done']);
    expect(Object.keys(patchMilestoneSchema.parse({ title: 'Order a bigger cake' }))).toEqual([
      'title',
    ]);
  });

  it('still lets a budget be cleared on purpose', () => {
    // Absent means "leave it alone"; an explicit null means "remove it". The distinction only
    // works because there is no default.
    expect(patchMilestoneSchema.parse({ budget: null })).toEqual({ budget: null });
  });

  it('will not accept doneAt from a client', () => {
    // The server derives it from `done`, so the two cannot disagree and a host cannot
    // backdate their own progress.
    const parsed = patchMilestoneSchema.parse({ done: true, doneAt: 0 });
    expect(parsed).not.toHaveProperty('doneAt');
  });
});

describe('milestone ids', () => {
  it('accept both a saved id and an unsaved template row', () => {
    expect(milestoneIdSchema.safeParse('AbC123_-xyz9').success).toBe(true);
    expect(milestoneIdSchema.safeParse('template:numbers').success).toBe(true);
  });

  it('reject a path traversal or a nested id', () => {
    expect(milestoneIdSchema.safeParse('../../events').success).toBe(false);
    expect(milestoneIdSchema.safeParse('a/b').success).toBe(false);
  });
});

describe('budgets', () => {
  it('read as money and never as cents', () => {
    expect(formatBudget(1240)).toBe('$1,240');
    expect(formatBudget(0)).toBe('$0');
  });
});
