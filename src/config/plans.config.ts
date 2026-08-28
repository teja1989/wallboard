import { DAY, MB } from './limits.config';

/**
 * Plans and entitlements.
 *
 * Two ways to pay, because hosts come in two shapes and asking one to behave like the
 * other loses the sale. Someone planning a single wedding will pay well for that one
 * event and will not sign up for a year; someone who runs a supper club every month wants
 * a subscription and would resent paying per event. So: a one-off unlock and a
 * subscription, both landing on the same entitlement set.
 *
 * The free tier is deliberately useful. Nobody upgrades to escape something broken — they
 * upgrade because they can see something better and the moment matters to them.
 *
 * Nothing here charges anyone. Billing is behind `features.billing`, and while it is off
 * every event runs on `previewPlanId` — see `src/lib/billing/entitlements.ts`. Gating
 * people before you can take their money only teaches them to leave.
 */

export const PLAN_IDS = ['free', 'event', 'pro'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface Entitlements {
  /** Guests who may join one event, counting plus-ones. */
  maxGuests: number;
  maxPostsPerEvent: number;
  maxStorageBytesPerEvent: number;
  /** Longest an event may run before its media is deleted. */
  maxEventLifetimeMs: number;
  /** Live events one host may own at once. */
  maxActiveEvents: number;
  /** Access to the premium invitation themes. */
  premiumTemplates: boolean;
  /** Hide the "Made with Marquee" line on the invitation. */
  removeBranding: boolean;
  /** Let guests leave a private note with their RSVP. */
  rsvpNotes: boolean;
  /** Ask guests one custom question alongside the RSVP. */
  rsvpCustomQuestion: boolean;
  /** Download the guest list as CSV. */
  guestListExport: boolean;
  /** Download everything posted before the wall expires. */
  archiveDownload: boolean;
  /** A readable link, /e/priya-and-sam rather than an id. */
  vanityLink: boolean;
  /**
   * The planning list: tick things off, change them, add your own.
   *
   * The clearest answer this product has to "why pay when Evite is free", because it is a
   * category Evite does not play in at all. The free tier still *sees* the list for its
   * occasion — that is the pitch — but cannot work it.
   */
  eventPlanning: boolean;
}

export interface Plan {
  id: PlanId;
  label: string;
  /** One line on the pricing table. Says who it is for, not what it costs. */
  audience: string;
  /** Price in whole currency units. `null` on free. */
  price: number | null;
  currency: 'USD';
  /** How the price is charged. */
  cadence: 'free' | 'per-event' | 'yearly';
  /** Shown under the price, e.g. "per event, one payment". */
  priceNote: string;
  /** Draws the eye on the pricing table. Exactly one plan should have this. */
  featured: boolean;
  entitlements: Entitlements;
  /** Bullets on the pricing table, in the order a buyer cares about them. */
  highlights: readonly string[];
}

const freeEntitlements: Entitlements = {
  maxGuests: 25,
  maxPostsPerEvent: 100,
  maxStorageBytesPerEvent: 500 * MB,
  maxEventLifetimeMs: 7 * DAY,
  maxActiveEvents: 2,
  premiumTemplates: false,
  removeBranding: false,
  rsvpNotes: false,
  rsvpCustomQuestion: false,
  guestListExport: false,
  archiveDownload: false,
  vanityLink: false,
  eventPlanning: false,
};

const eventEntitlements: Entitlements = {
  maxGuests: 250,
  maxPostsPerEvent: 1500,
  maxStorageBytesPerEvent: 5 * 1024 * MB,
  maxEventLifetimeMs: 30 * DAY,
  maxActiveEvents: 5,
  premiumTemplates: true,
  removeBranding: true,
  rsvpNotes: true,
  rsvpCustomQuestion: true,
  guestListExport: true,
  archiveDownload: true,
  vanityLink: true,
  eventPlanning: true,
};

const proEntitlements: Entitlements = {
  maxGuests: 500,
  maxPostsPerEvent: 5000,
  maxStorageBytesPerEvent: 20 * 1024 * MB,
  maxEventLifetimeMs: 90 * DAY,
  maxActiveEvents: 25,
  premiumTemplates: true,
  removeBranding: true,
  rsvpNotes: true,
  rsvpCustomQuestion: true,
  guestListExport: true,
  archiveDownload: true,
  vanityLink: true,
  eventPlanning: true,
};

export const plans: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    label: 'Free',
    audience: 'For a small get-together this weekend.',
    price: null,
    currency: 'USD',
    cadence: 'free',
    priceNote: 'No card, no trial, no expiry on the account.',
    featured: false,
    entitlements: freeEntitlements,
    highlights: [
      'Up to 25 guests',
      'Invitation, RSVPs and the live wall',
      'Photos, video, voice notes and messages',
      'Four invitation themes',
      'Wall stays live for 7 days',
      // Last, and phrased as the promise rather than a feature, because it is the line that
      // answers "what is the catch" — which is the only real objection a free tier has.
      'No ads. Not even here.',
    ],
  },
  event: {
    id: 'event',
    label: 'One event',
    audience: 'For the wedding, the big birthday, the one that matters.',
    price: 19,
    currency: 'USD',
    cadence: 'per-event',
    priceNote: 'One payment, for one event. No subscription.',
    featured: true,
    entitlements: eventEntitlements,
    highlights: [
      'Up to 250 guests',
      'All ten invitation themes',
      'Private notes with each RSVP',
      'One custom question on the RSVP',
      'Guest list export',
      'A planning list for your kind of event, with the dates worked out',
      'Wall stays live for 30 days, then downloads as an archive',
      'No Marquee branding',
    ],
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    audience: 'For people who host all the time.',
    price: 79,
    currency: 'USD',
    cadence: 'yearly',
    priceNote: 'Per year. Unlimited events while it is active.',
    featured: false,
    entitlements: proEntitlements,
    highlights: [
      'Everything in One event, on every event you host',
      'Up to 500 guests',
      '25 live events at once',
      'Walls stay live for 90 days',
      '20 GB of photos and video per event',
      'Readable links, /e/priya-and-sam',
    ],
  },
};

export const planOrder: readonly PlanId[] = ['free', 'event', 'pro'];

/**
 * The plan every event runs on while billing is switched off. Generous on purpose: during
 * a preview the job is to find out whether people love the product, and a paywall in front
 * of an unproven product measures nothing except how fast people leave.
 */
export const previewPlanId: PlanId = 'pro';

export function planById(id: string): Plan {
  return plans[(PLAN_IDS as readonly string[]).includes(id) ? (id as PlanId) : 'free'];
}

/** Ordering, for "does this plan include at least what that one does" comparisons. */
export const planRank: Record<PlanId, number> = { free: 0, event: 1, pro: 2 };

export function formatPrice(plan: Plan): string {
  if (plan.price === null) return 'Free';
  return `$${plan.price}`;
}
