import { DAY } from './limits.config';
import type { OccasionId } from './occasions.config';

/**
 * Planning an event, not just inviting people to one.
 *
 * The honest case for this feature, stated plainly because it is easy to get wrong:
 *
 * **A checklist is not worth money.** Anyone reading this already has Reminders, Notion and a
 * notes app, all free, all better at being a list than we will ever be. Shipping a generic
 * to-do board attached to an invitation would be a feature nobody opens twice.
 *
 * **Two things here are not a checklist**, and they are the entire product:
 *
 * 1. **It arrives already written.** A host planning a fortieth does not want an empty board;
 *    they want to know what they have forgotten. Every occasion below seeds a real sequence
 *    with real lead times, counted backwards from the date they already gave us. The value is
 *    in the rows, not the ticking.
 * 2. **It knows things a notes app cannot.** "Give the caterer final numbers" sits next to the
 *    live headcount. "Chase anyone who has not replied" sits next to how many have not. That
 *    is only possible because this list hangs off an event that already holds the date, the
 *    venue, the guest list and the replies — and it is the one thing a general planner
 *    structurally cannot copy.
 *
 * This is a **host-side** feature and it does nothing for the guest-to-host loop. It is not
 * pretending to: its job is to make $19 defensible against a free competitor, by being a
 * category Evite does not play in at all. Measurement will say whether it works —
 * `milestoneCompleted` is in the funnel for exactly that reason.
 *
 * Nothing here is stored until a host touches it. The seeded list is rendered from this file
 * on every read; the first tick materialises it. A host who never opens the tab never has a
 * single document written on their behalf.
 */

export const MILESTONE_CATEGORIES = [
  { id: 'venue', label: 'Where', glyph: '📍' },
  { id: 'food', label: 'Food and drink', glyph: '🍽️' },
  { id: 'guests', label: 'Guests', glyph: '✉️' },
  { id: 'gifts', label: 'Gifts', glyph: '🎁' },
  { id: 'music', label: 'Music', glyph: '🎵' },
  { id: 'photos', label: 'Photos', glyph: '📷' },
  { id: 'admin', label: 'Everything else', glyph: '📋' },
] as const;

export type MilestoneCategoryId = (typeof MILESTONE_CATEGORIES)[number]['id'];

/** Falls back to "Everything else", which is what the last entry is for. */
export function milestoneCategoryById(id: string) {
  return (
    MILESTONE_CATEGORIES.find((category) => category.id === id) ??
    MILESTONE_CATEGORIES[MILESTONE_CATEGORIES.length - 1]!
  );
}

/** The ids as a literal tuple, so `z.enum` produces the union rather than `string`. */
export const MILESTONE_CATEGORY_IDS = MILESTONE_CATEGORIES.map((category) => category.id) as [
  MilestoneCategoryId,
  ...MilestoneCategoryId[],
];

/**
 * A number this list can show without the host typing it.
 *
 * The whole reason a planning board attached to an invitation beats one that is not. Derived
 * at render from the event that is already on screen — never stored, so it cannot go stale and
 * costs no extra read.
 */
export type MilestoneLiveField = 'headcount' | 'replies' | 'venue' | 'invited';

export interface MilestoneTemplate {
  /** Stable across edits to the wording, so a re-seed cannot duplicate a row. */
  key: string;
  title: string;
  categoryId: MilestoneCategoryId;
  /** How long before the event this wants doing. Counted back from `startsAt`. */
  leadMs: number;
  note?: string;
  live?: MilestoneLiveField;
}

const WEEK = 7 * DAY;

/**
 * The default sequence, for occasions with no list of their own.
 *
 * Deliberately short. A thirty-row checklist is not thorough, it is intimidating, and the host
 * who needed it most is the one who closes the tab. Anything missing can be added in a line.
 */
const defaultPlan: readonly MilestoneTemplate[] = [
  {
    key: 'date',
    title: 'Settle the date and the place',
    categoryId: 'venue',
    leadMs: 6 * WEEK,
    live: 'venue',
  },
  { key: 'list', title: 'Write the guest list', categoryId: 'guests', leadMs: 5 * WEEK },
  {
    key: 'send',
    title: 'Send the invitations',
    categoryId: 'guests',
    leadMs: 4 * WEEK,
    live: 'invited',
  },
  { key: 'food', title: 'Sort the food and drink', categoryId: 'food', leadMs: 2 * WEEK },
  {
    key: 'chase',
    title: 'Chase anyone who has not replied',
    categoryId: 'guests',
    leadMs: WEEK,
    live: 'replies',
  },
  {
    key: 'numbers',
    title: 'Confirm final numbers',
    categoryId: 'food',
    leadMs: 5 * DAY,
    live: 'headcount',
  },
  {
    key: 'wall',
    title: 'Tell everyone about the photo wall on the day',
    categoryId: 'photos',
    leadMs: DAY,
    note: 'A wall nobody knows about stays empty. One line at the start is usually enough.',
  },
];

/**
 * Per-occasion sequences.
 *
 * Written as what a person actually does, in the order they do it, rather than as a taxonomy.
 * The lead times are the useful part — a host who knows the cake wants ordering three weeks
 * out has been told something they did not know, which is more than any empty board does.
 */
export const occasionPlans: Partial<Record<OccasionId, readonly MilestoneTemplate[]>> = {
  birthday: [
    {
      key: 'date',
      title: 'Settle the date and the place',
      categoryId: 'venue',
      leadMs: 6 * WEEK,
      live: 'venue',
    },
    { key: 'list', title: 'Write the guest list', categoryId: 'guests', leadMs: 5 * WEEK },
    {
      key: 'send',
      title: 'Send the invitations',
      categoryId: 'guests',
      leadMs: 4 * WEEK,
      live: 'invited',
    },
    {
      key: 'gifts',
      title: 'Put up a gift list, if you want one',
      categoryId: 'gifts',
      leadMs: 4 * WEEK,
      note: 'Guests ask. Having somewhere to point them saves everyone the awkward text.',
    },
    { key: 'cake', title: 'Order the cake', categoryId: 'food', leadMs: 3 * WEEK },
    {
      key: 'food',
      title: 'Sort the rest of the food and drink',
      categoryId: 'food',
      leadMs: 2 * WEEK,
    },
    { key: 'music', title: 'Make a playlist', categoryId: 'music', leadMs: 2 * WEEK },
    {
      key: 'chase',
      title: 'Chase anyone who has not replied',
      categoryId: 'guests',
      leadMs: WEEK,
      live: 'replies',
    },
    {
      key: 'numbers',
      title: 'Confirm final numbers',
      categoryId: 'food',
      leadMs: 5 * DAY,
      live: 'headcount',
    },
    {
      key: 'wall',
      title: 'Tell everyone about the photo wall on the day',
      categoryId: 'photos',
      leadMs: DAY,
      note: 'A wall nobody knows about stays empty. One line at the start is usually enough.',
    },
  ],

  wedding: [
    {
      key: 'venue',
      title: 'Book the venue',
      categoryId: 'venue',
      leadMs: 40 * WEEK,
      live: 'venue',
    },
    { key: 'list', title: 'Agree the guest list', categoryId: 'guests', leadMs: 32 * WEEK },
    { key: 'caterer', title: 'Book the caterer', categoryId: 'food', leadMs: 26 * WEEK },
    {
      key: 'photographer',
      title: 'Book the photographer',
      categoryId: 'photos',
      leadMs: 26 * WEEK,
    },
    { key: 'save', title: 'Send save-the-dates', categoryId: 'guests', leadMs: 24 * WEEK },
    { key: 'registry', title: 'Set up the registry', categoryId: 'gifts', leadMs: 16 * WEEK },
    { key: 'music', title: 'Book the music', categoryId: 'music', leadMs: 16 * WEEK },
    {
      key: 'send',
      title: 'Send the invitations',
      categoryId: 'guests',
      leadMs: 10 * WEEK,
      live: 'invited',
    },
    {
      key: 'chase',
      title: 'Chase anyone who has not replied',
      categoryId: 'guests',
      leadMs: 4 * WEEK,
      live: 'replies',
    },
    {
      key: 'numbers',
      title: 'Give the caterer final numbers',
      categoryId: 'food',
      leadMs: 2 * WEEK,
      live: 'headcount',
    },
    {
      key: 'seating',
      title: 'Do the seating plan',
      categoryId: 'guests',
      leadMs: 2 * WEEK,
      live: 'headcount',
    },
    {
      key: 'wall',
      title: 'Tell everyone about the photo wall on the day',
      categoryId: 'photos',
      leadMs: DAY,
      note: 'The guests take the photographs the photographer cannot — the ones from the tables.',
    },
  ],

  baby: [
    {
      key: 'date',
      title: 'Pick a date with the parent-to-be',
      categoryId: 'admin',
      leadMs: 8 * WEEK,
    },
    {
      key: 'place',
      title: 'Settle where it is happening',
      categoryId: 'venue',
      leadMs: 6 * WEEK,
      live: 'venue',
    },
    {
      key: 'send',
      title: 'Send the invitations',
      categoryId: 'guests',
      leadMs: 4 * WEEK,
      live: 'invited',
    },
    { key: 'registry', title: 'Share the registry', categoryId: 'gifts', leadMs: 4 * WEEK },
    { key: 'food', title: 'Sort the food', categoryId: 'food', leadMs: 2 * WEEK },
    {
      key: 'games',
      title: 'Decide what you are actually doing for two hours',
      categoryId: 'admin',
      leadMs: 2 * WEEK,
    },
    {
      key: 'chase',
      title: 'Chase anyone who has not replied',
      categoryId: 'guests',
      leadMs: WEEK,
      live: 'replies',
    },
    {
      key: 'numbers',
      title: 'Confirm final numbers',
      categoryId: 'food',
      leadMs: 5 * DAY,
      live: 'headcount',
    },
  ],

  graduation: [
    {
      key: 'date',
      title: 'Settle the date around the ceremony',
      categoryId: 'admin',
      leadMs: 8 * WEEK,
    },
    {
      key: 'place',
      title: 'Settle where it is happening',
      categoryId: 'venue',
      leadMs: 6 * WEEK,
      live: 'venue',
    },
    {
      key: 'send',
      title: 'Send the invitations',
      categoryId: 'guests',
      leadMs: 4 * WEEK,
      live: 'invited',
    },
    { key: 'food', title: 'Sort the food and drink', categoryId: 'food', leadMs: 2 * WEEK },
    {
      key: 'chase',
      title: 'Chase anyone who has not replied',
      categoryId: 'guests',
      leadMs: WEEK,
      live: 'replies',
    },
    {
      key: 'numbers',
      title: 'Confirm final numbers',
      categoryId: 'food',
      leadMs: 5 * DAY,
      live: 'headcount',
    },
    {
      key: 'photos',
      title: 'Decide who is taking the photographs',
      categoryId: 'photos',
      leadMs: 3 * DAY,
    },
  ],

  work: [
    { key: 'budget', title: 'Get the budget signed off', categoryId: 'admin', leadMs: 8 * WEEK },
    { key: 'venue', title: 'Book the venue', categoryId: 'venue', leadMs: 6 * WEEK, live: 'venue' },
    {
      key: 'send',
      title: 'Send the invitations',
      categoryId: 'guests',
      leadMs: 4 * WEEK,
      live: 'invited',
    },
    { key: 'agenda', title: 'Circulate the agenda', categoryId: 'admin', leadMs: 2 * WEEK },
    { key: 'diet', title: 'Collect dietary requirements', categoryId: 'food', leadMs: 2 * WEEK },
    {
      key: 'chase',
      title: 'Chase anyone who has not replied',
      categoryId: 'guests',
      leadMs: WEEK,
      live: 'replies',
    },
    {
      key: 'numbers',
      title: 'Confirm final numbers with catering',
      categoryId: 'food',
      leadMs: 5 * DAY,
      live: 'headcount',
    },
  ],

  /**
   * A memorial gets a list too, and a gentler one.
   *
   * The person organising this is doing it in the worst week of their life, and the ordinary
   * failure of every planning tool is to hand them a cheerful checklist. No gifts, no music
   * booking, no "make it special" — just the things that genuinely have to happen, said
   * plainly. `somber` exists for exactly this.
   */
  memorial: [
    {
      key: 'place',
      title: 'Confirm the place and the time',
      categoryId: 'venue',
      leadMs: 2 * WEEK,
      live: 'venue',
    },
    {
      key: 'tell',
      title: 'Let people know',
      categoryId: 'guests',
      leadMs: 10 * DAY,
      live: 'invited',
    },
    { key: 'speak', title: 'Ask whoever is speaking', categoryId: 'admin', leadMs: WEEK },
    { key: 'after', title: 'Arrange somewhere to go afterwards', categoryId: 'food', leadMs: WEEK },
    {
      key: 'numbers',
      title: 'Give them a rough number',
      categoryId: 'food',
      leadMs: 3 * DAY,
      live: 'headcount',
    },
    {
      key: 'wall',
      title: 'Invite people to share a memory',
      categoryId: 'photos',
      leadMs: DAY,
      note: 'People who cannot travel often still want to say something.',
    },
  ],
};

export function planTemplateFor(occasionId: string): readonly MilestoneTemplate[] {
  return occasionPlans[occasionId as OccasionId] ?? defaultPlan;
}

export const planningLimits = {
  /** Rows one event may carry, seeded and added together. Past this it is a project plan. */
  maxMilestonesPerEvent: 60,
  titleMaxLength: 120,
  noteMaxLength: 280,
  /** A sanity bound, not a budgeting opinion. Weddings get expensive. */
  maxBudget: 10_000_000,
} as const;

export const planningCopy = {
  tabLabel: 'Plan',
  heading: 'The plan',
  body: 'Everything this kind of event usually needs, in the order it usually needs doing. Tick what is done, change what does not apply, add what is missing.',

  /** Shown when the host has not given a date, so nothing can be scheduled backwards from it. */
  noDate:
    'Add a date to the invitation and each of these gets a suggested week, counted back from the day itself.',

  addLabel: 'Add something',
  addPlaceholder: 'What else needs doing?',
  empty: 'Nothing on the list yet.',
  remove: 'Remove',

  done: (done: number, total: number) => `${done} of ${total} done`,
  allDone: 'That is everything. Enjoy it.',

  overdue: 'Was due',
  dueOn: 'By',

  budgetLabel: 'Budget',
  budgetTotal: (total: string) => `${total} planned`,

  /**
   * What the free tier sees.
   *
   * The list is rendered in full rather than hidden, because the honest pitch is the rows
   * themselves: a host looking at the ten things a fortieth needs can see precisely what they
   * would be buying. Hiding it would sell them a mystery.
   */
  lockedTitle: 'Planning is part of a paid plan',
  lockedBody:
    'This is the list for your kind of event — have a read. Unlocking it lets you tick things off, change them, and add your own.',
} as const;

/** `$1,240`. No decimals: nobody budgets a party to the cent. */
export function formatBudget(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
