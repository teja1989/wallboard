import { MINUTE } from './limits.config';

/**
 * Getting an invitation to a person, and knowing whether it landed.
 *
 * Two ideas hold this together.
 *
 * **A channel is how it travels; the ladder is how far it got.** Email, SMS and WhatsApp
 * differ in cost, in compliance, and in what they will tell us afterwards — but a host does
 * not want to reason about any of that. They want to know whether Priya has seen it. So the
 * ladder below is channel-independent, and each channel reports as far up it as it honestly
 * can.
 *
 * **The ladder only moves forwards.** Delivery receipts arrive late, out of order, and
 * sometimes after the guest has already replied. A status that can go backwards would show
 * a host "delivered" for someone who answered an hour ago.
 */

/** How a message travelled. `relay` is the host sending the link themselves. */
export const COMMS_CHANNELS = ['relay', 'email', 'sms', 'whatsapp'] as const;
export type CommsChannel = (typeof COMMS_CHANNELS)[number];

/**
 * How far an invitation got.
 *
 * `unsubscribed` is kept from the original email-only vocabulary rather than renamed: it is
 * written to live documents, and a guest's opt-out is not worth risking on a rename.
 */
export const DELIVERY_STATES = [
  'pending',
  'queued',
  'sent',
  'delivered',
  'seen',
  'replied',
  'failed',
  'bounced',
  'unsubscribed',
] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

/**
 * Position on the ladder. Only these six are rungs; the rest are conditions that end the
 * climb, and comparing them by rank would be meaningless.
 */
const LADDER: Partial<Record<DeliveryState, number>> = {
  pending: 0,
  queued: 1,
  sent: 2,
  delivered: 3,
  seen: 4,
  replied: 5,
};

/** True once a human has demonstrably engaged — the point past which stale bad news is ignored. */
function isEngaged(state: DeliveryState): boolean {
  return (LADDER[state] ?? -1) >= (LADDER.seen ?? 4);
}

/**
 * Whether a status change should be written.
 *
 * A carrier receipt for a message sent twenty minutes ago can arrive after the guest has
 * opened the invitation. Letting it through would overwrite "seen" with "delivered", which
 * is both wrong and the kind of wrong a host notices.
 */
export function canTransition(from: DeliveryState, to: DeliveryState): boolean {
  // The guest's own decision always wins, from anywhere.
  if (to === 'unsubscribed') return true;
  if (from === 'unsubscribed') return false;

  // Bad news about a message someone has already read is stale by definition.
  if (to === 'failed' || to === 'bounced') return !isEngaged(from);

  const fromRank = LADDER[from];
  const toRank = LADDER[to];

  // Climbing out of a failure is real: a resend that works supersedes the one that did not.
  if (fromRank === undefined) return toRank !== undefined;
  if (toRank === undefined) return false;

  return toRank > fromRank;
}

interface StateCopy {
  /** What the host sees. */
  label: string;
  /** Drives colour. Kept out of the component so the vocabulary has one home. */
  tone: 'neutral' | 'progress' | 'good' | 'bad';
}

export const deliveryCopy: Record<DeliveryState, StateCopy> = {
  pending: { label: 'Not sent', tone: 'neutral' },
  queued: { label: 'Sending', tone: 'progress' },
  sent: { label: 'Sent', tone: 'progress' },
  delivered: { label: 'Delivered', tone: 'progress' },
  seen: { label: 'Seen', tone: 'good' },
  replied: { label: 'Replied', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
  bounced: { label: 'Bounced', tone: 'bad' },
  unsubscribed: { label: 'Opted out', tone: 'neutral' },
};

export const commsConfig = {
  /**
   * Assumed when a typed number carries no country code.
   *
   * A guess, and the UI shows what it parsed to rather than hiding it — a silently
   * misparsed number is a guest who never hears from anyone.
   */
  defaultCountry: 'US',

  /** Guests who can be added by phone with no address. */
  allowPhoneOnly: true,

  /**
   * Bytes of randomness in a per-guest link token.
   *
   * The token names a person, so it has to be unguessable: enumerating them would turn the
   * guest list into a public document. 16 bytes is 128 bits.
   */
  linkTokenBytes: 16,

  /**
   * Views closer together than this are one visit.
   *
   * Without it a guest reading the invitation, tapping through to the wall and coming back
   * reads as three separate viewings, and the host's "viewed 4 times" means nothing.
   */
  viewDedupeMs: 5 * MINUTE,

  /**
   * Agents whose fetch is not a person looking.
   *
   * Corporate mail security — Outlook Safe Links, Proofpoint, Mimecast — opens every URL in
   * every message it scans. This list is the second line of defence only: the first is that
   * a view is recorded by a script that runs after hydration, and a scanner pulling HTML
   * never runs it.
   */
  botAgentPattern:
    /bot|crawl|spider|slurp|preview|scan|monitor|curl|wget|python-requests|headless|facebookexternalhit|whatsapp|telegram|slackbot|discord|linkedin/i,
} as const;

/**
 * What the host copies when they send the invitation themselves.
 *
 * Deliberately short and deliberately theirs. This lands in an iMessage thread next to
 * years of real conversation, and anything that reads like marketing copy is a message the
 * recipient scrolls past.
 */
export const relayCopy = {
  message: (hostedBy: string, title: string, link: string) =>
    `${hostedBy} invited you to ${title}\n${link}`,

  panelTitle: 'Send it yourself',
  panelBody:
    'Each guest gets their own link, so you can see who has opened it. Send them however you normally talk to them — the invitation still tracks.',
  copiedOne: 'Link copied',
  copiedAll: 'All the messages copied',
  noContact: 'No phone or email — you can still copy their link.',
} as const;

/**
 * The four-number summary at the top of the guest list.
 *
 * Every one of these counts **people**, and the wording has to keep saying so. The funnel
 * beside it counts sums — one guest opening an invitation three times is three opens — so a
 * label like "31 opened" would invite exactly the wrong reading. "Seen it" is a count of
 * guests with a `firstViewedAt`, and that is the promise the words have to keep.
 */
export const inviteProgressCopy = {
  heading: 'How it is going',

  invited: 'On the list',
  sent: 'Sent',
  seen: 'Seen it',
  replied: 'Replied',

  /** Heads, not replies: a family of four is four. Straight off the event's own tally. */
  attending: (people: number) => (people === 1 ? '1 person coming' : `${people} people coming`),

  /**
   * Said only when there is something to do about it.
   *
   * "Nobody has replied" an hour after sending is normal and reads as failure; a host who is
   * told their party is going badly before it has started is a host who closes the tab.
   */
  waitingOn: (people: number) =>
    people === 1 ? 'Still waiting on 1 person.' : `Still waiting on ${people} people.`,
} as const;
