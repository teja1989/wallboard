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
