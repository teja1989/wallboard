/**
 * The gift list.
 *
 * This is the cheapest question in the business plan and the one every later decision hangs
 * on: **will a guest, on an invitation, click through to buy something?**
 *
 * Nothing here takes money, holds money, or knows what anything costs. A host pastes the
 * links they already have — a store registry, an Amazon list, a charity page — and guests see
 * them under the invitation. That is the whole feature, on purpose. Building payments first
 * would be a three-month bet on an assumption we can test in a week: if guests do not click a
 * link, they will certainly not send $85 through a site they have never heard of.
 *
 * What it produces is one honest number, `giftLinkClicked` over `invitationOpened`. If that
 * ratio is dismal, cash gifting does not get built and we saved a quarter. If it is good, it
 * is the first real evidence the product has ever had for a revenue line.
 *
 * Two things it deliberately is not:
 *
 * - **Not a catalogue.** We do not fetch prices, images or availability. That would make us a
 *   worse version of the shop the host already chose, and Amazon's terms forbid caching a
 *   price for more than 24 hours anyway.
 * - **Not on by default.** `occasion.giftsExpected` decides whether the section exists at all,
 *   so a work offsite and a memorial never ask anybody for anything.
 */

export const registryLimits = {
  /** Links one host may add. Past a handful it stops being a list and starts being a shop. */
  maxLinksPerEvent: 8,
  labelMaxLength: 60,
  noteMaxLength: 140,
} as const;

/**
 * Hosts that get a recognisable name and mark instead of a bare domain.
 *
 * Only ever cosmetic, and matched on the registrable domain rather than the whole hostname so
 * a regional store (`amazon.co.uk`) is not a stranger. Anything unmatched renders its own
 * hostname, which is honest and needs no maintenance — the list is a courtesy, not a gate.
 * Nothing is fetched from any of these; we are naming a link, not talking to a shop.
 */
const knownRegistries: readonly { match: string; label: string }[] = [
  { match: 'amazon.', label: 'Amazon' },
  { match: 'target.com', label: 'Target' },
  { match: 'zola.com', label: 'Zola' },
  { match: 'theknot.com', label: 'The Knot' },
  { match: 'myregistry.com', label: 'MyRegistry' },
  { match: 'babylist.com', label: 'Babylist' },
  { match: 'etsy.com', label: 'Etsy' },
  { match: 'johnlewis.com', label: 'John Lewis' },
  { match: 'justgiving.com', label: 'JustGiving' },
  { match: 'gofundme.com', label: 'GoFundMe' },
];

/**
 * A human name for a link's destination.
 *
 * Falls back to the hostname without `www.`, which is the right answer for the long tail: a
 * guest looking at "thelittletoyshop.co.uk" knows exactly as much as they need to.
 */
export function registryHostLabel(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'Link';
  }

  const known = knownRegistries.find((entry) => hostname.includes(entry.match));
  if (known) return known.label;

  return hostname.replace(/^www\./, '');
}

export const registryCopy = {
  /** What the host sees when managing the list. */
  hostHeading: 'Gift list',
  hostBody:
    'Paste a link to a registry, a wish list, or a charity page. Guests see these under the invitation. Nothing is bought or paid for here — the link takes them straight to wherever you set it up.',
  addLabel: 'Add a link',
  urlLabel: 'Link',
  urlPlaceholder: 'https://…',
  nameLabel: 'What to call it',
  namePlaceholder: 'Our registry',
  noteLabel: 'A note (optional)',
  notePlaceholder: 'No pressure at all — your being there is the thing.',
  empty: 'No gift list yet.',
  full: (max: number) => `That is the ${max} links an invitation can carry.`,
  remove: 'Remove this link',

  /** What guests see. Deliberately soft — nobody should feel invoiced by an invitation. */
  guestHeading: 'Gift list',
  guestHint: 'Only if you would like to. Nothing here is expected.',
} as const;
