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

import { isEnabled } from './features.config';

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
  /**
   * The one thing the free tier does that the incumbent does not, said out loud.
   *
   * Evite's free tier is ad-supported, and that is the experience most people have of a free
   * invitation: a banner beside somebody's fortieth, an interstitial between a guest and the
   * address. Not doing that has been true here since the first commit and was never mentioned
   * anywhere a customer could read it — an unstated difference is not a differentiator.
   *
   * `docs/ADS_MARKETING.md` did the arithmetic: 150 pageviews an event at a $4 CPM is about
   * fifty cents. One upgrade is worth forty events of that. So the ads were never worth the
   * position they cost, and saying so is free money in a way the ads themselves are not.
   *
   * **This is a promise, not a slogan, so it is checked rather than pasted** — see
   * `adFreePromiseHolds()` below. Every surface that makes the claim asks first, and if the
   * `ads` flag were ever turned on the claim would disappear rather than quietly become a lie.
   */
  noAds: {
    badge: 'No ads. Not even on the free plan.',
    headline: 'Nobody is advertising at your guests.',
    body: 'Free does not mean ad-supported here. There is no banner beside your invitation, nothing between a guest and your address, and no third party watching who opened it. The free plan is the whole product with smaller limits — not a worse version of it with something sold in the gaps.',
    /** The honest version of "why", for anyone who wonders what the catch is. */
    why: 'Ads on an invitation earn us pennies and cost you the moment. We would rather be paid by the people who want more room.',
  },
  /** Shown on free-tier events. Removing it is a paid entitlement. */
  attribution: 'Made with Marquee',
  // The domain we actually own. `marquee.app` was here and is not ours — a mailto nobody
  // reads is a support channel that silently does not exist.
  supportEmail: 'hello@marqueersvp.com',
} as const;

export type PillarId = (typeof brand.pillars)[number]['id'];

/**
 * Whether we are still entitled to say "no ads".
 *
 * The point of routing every surface through one function is that the claim cannot outlive
 * the fact. A marketing string is invisible to the type system and to every test; a call is
 * not. If somebody ever flips `ads` on, the promise disappears from the landing page, the
 * pricing table and the FAQ in the same commit that made it untrue — rather than sitting
 * there for a year contradicting the product a paying customer is looking at.
 *
 * It is deliberately a live read rather than a constant, because the flag itself will move to
 * a runtime document in phase 2 and a constant captured at import would not follow it.
 */
export function adFreePromiseHolds(): boolean {
  return !isEnabled('ads');
}

/** Motion. Springs rather than durations — softer, and interruptible. */
export const motion = {
  spring: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 },
  gentleSpring: { type: 'spring', stiffness: 180, damping: 24, mass: 1 },
  fast: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  base: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  /** Stagger between cards appearing on the wall. */
  staggerSeconds: 0.045,
} as const;
