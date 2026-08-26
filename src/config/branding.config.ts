/**
 * Brand and design tokens.
 *
 * A marquee is three things at once, and the product is all three: the lit sign that
 * announces an event, the tent the event happens under, and the scrolling display that
 * carries messages through the night. The copy leans on that rather than explaining it.
 *
 * The Tailwind theme in src/app/globals.css mirrors these values as CSS custom properties;
 * this module is the source for anything JS needs — motion springs, theme swatches, and
 * every piece of brand copy, so marketing wording is never hard-coded into a component.
 */

export const brand = {
  name: 'Marquee',
  /** Used where the name needs a qualifier, e.g. a page title or an email subject. */
  fullName: 'Marquee — invitations, RSVPs and the live wall',
  tagline: 'Every occasion deserves a marquee.',
  /** One sentence. This is the meta description and the hero subhead. */
  promise:
    'Send an invitation people actually want to open, collect RSVPs without chasing anyone, and give your guests one live wall for every photo, video and message from the night.',
  /** Short form, for cards and social previews. */
  shortPromise: 'Invitations, RSVPs and a live guest wall — one link, one beautiful place.',
  /** The three pillars the whole product and site are organised around. */
  pillars: [
    {
      id: 'invite',
      label: 'Invite',
      headline: 'An invitation worth opening',
      body: 'Pick an occasion and Marquee builds the page — date, place, dress code, the lot. Share one link or one short code. No accounts, no app, no download for your guests.',
    },
    {
      id: 'gather',
      label: 'Gather',
      headline: 'RSVPs without the chasing',
      body: 'Guests reply in one tap, add their plus-ones, and leave you a note. You get a live headcount and a guest list you can actually work from.',
    },
    {
      id: 'remember',
      label: 'Remember',
      headline: 'One wall for the whole night',
      body: 'Everyone posts photos, video, voice notes and messages to the same live wall. No group chat to scroll, nothing lost in six different camera rolls.',
    },
  ],
  /** Shown on free-tier events. Removing it is a paid entitlement. */
  attribution: 'Made with Marquee',
  supportEmail: 'hello@marquee.app',
} as const;

export type PillarId = (typeof brand.pillars)[number]['id'];

/** Motion. Springs rather than durations — softer, and interruptible. */
export const motion = {
  spring: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 },
  gentleSpring: { type: 'spring', stiffness: 180, damping: 24, mass: 1 },
  fast: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  base: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  /** Stagger between cards appearing on the wall. */
  staggerSeconds: 0.045,
} as const;

/**
 * Invitation themes. `premium: true` requires a paid entitlement — this is the most
 * visible thing a host gets for upgrading, so the free set is deliberately good rather
 * than deliberately poor. Nobody upgrades to escape something ugly; they upgrade to reach
 * something better.
 *
 * Values are OKLCH so the ramp steps evenly by perceived lightness rather than by RGB.
 */
export const eventThemes = [
  // --- free ---------------------------------------------------------------
  {
    id: 'sunset',
    label: 'Sunset',
    from: 'oklch(0.82 0.11 40)',
    to: 'oklch(0.78 0.1 330)',
    premium: false,
  },
  {
    id: 'meadow',
    label: 'Meadow',
    from: 'oklch(0.85 0.09 150)',
    to: 'oklch(0.82 0.09 200)',
    premium: false,
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    from: 'oklch(0.83 0.09 220)',
    to: 'oklch(0.8 0.1 275)',
    premium: false,
  },
  {
    id: 'blossom',
    label: 'Blossom',
    from: 'oklch(0.86 0.08 350)',
    to: 'oklch(0.83 0.08 300)',
    premium: false,
  },
  // --- premium ------------------------------------------------------------
  {
    id: 'midnight',
    label: 'Midnight',
    from: 'oklch(0.42 0.11 268)',
    to: 'oklch(0.32 0.09 295)',
    premium: true,
  },
  {
    id: 'champagne',
    label: 'Champagne',
    from: 'oklch(0.89 0.06 88)',
    to: 'oklch(0.83 0.08 62)',
    premium: true,
  },
  {
    id: 'botanical',
    label: 'Botanical',
    from: 'oklch(0.58 0.09 148)',
    to: 'oklch(0.72 0.08 118)',
    premium: true,
  },
  {
    id: 'ember',
    label: 'Ember',
    from: 'oklch(0.7 0.15 28)',
    to: 'oklch(0.62 0.14 12)',
    premium: true,
  },
  {
    id: 'linen',
    label: 'Linen',
    from: 'oklch(0.92 0.02 75)',
    to: 'oklch(0.86 0.03 55)',
    premium: true,
  },
  {
    id: 'aurora',
    label: 'Aurora',
    from: 'oklch(0.74 0.13 190)',
    to: 'oklch(0.68 0.14 300)',
    premium: true,
  },
] as const;

export type EventThemeId = (typeof eventThemes)[number]['id'];
export const defaultEventThemeId: EventThemeId = 'sunset';

export function themeById(id: string) {
  return eventThemes.find((t) => t.id === id) ?? eventThemes[0];
}

export function isPremiumTheme(id: string): boolean {
  return themeById(id).premium;
}

export const freeThemes = eventThemes.filter((t) => !t.premium);
export const premiumThemes = eventThemes.filter((t) => t.premium);
