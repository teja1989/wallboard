import type { RsvpStatus } from './occasions.config';

/**
 * What happens after somebody replies.
 *
 * The reply used to be the end of the road: a toast, and the same three buttons still sitting
 * there. That is the wrong place to stop, because the instant after "yes" is the highest
 * intent anyone in this product ever has — they have just committed to being somewhere, and
 * the next thing in their head is *when is it, what do I do, is so-and-so going*. Answering
 * none of that and showing them a form they have already filled in wastes the one moment they
 * were leaning in.
 *
 * A **no** is not a dead end either, and this is the part most invitation products miss.
 * Someone who cannot come to a fortieth still wants to say something to the person having it,
 * and the wall is right there. Treating "can't make it" as the end of the conversation loses
 * the warmest thing the product can do.
 */

export interface RsvpOutcomeCopy {
  /** The heading, once the reply has saved. */
  heading: string;
  /** One line of reassurance. Never a sales pitch — they just did what was asked. */
  body: (hostedBy: string) => string;
  /** What to call the way back into the wall, for this answer. */
  wallCta: string;
}

export const rsvpCopy = {
  /** Only the three a guest can actually choose; `pending` is a state, not an answer. */
  outcomes: {
    yes: {
      heading: "You're going",
      body: (hostedBy: string) => `${hostedBy} has you down. Here is everything you need.`,
      wallCta: 'Say hello on the wall',
    },
    maybe: {
      heading: 'Marked as maybe',
      body: (hostedBy: string) =>
        `${hostedBy} knows you are not sure yet. Come back and change it any time.`,
      wallCta: 'Say hello on the wall',
    },
    no: {
      heading: 'Thanks for saying',
      body: (hostedBy: string) =>
        `${hostedBy} knows you cannot make it — which is genuinely more useful than not hearing.`,
      // The line that matters most here. Not being able to come is not the same as having
      // nothing to say, and for a birthday it is often the opposite.
      wallCta: 'Leave them a message anyway',
    },
  } satisfies Record<Exclude<RsvpStatus, 'pending'>, RsvpOutcomeCopy>,

  /** Reopening the form. Quiet, and always available — a reply is not a contract. */
  change: 'Change my reply',

  /**
   * Who else is coming.
   *
   * Only ever shown when there is somebody other than the reader, and phrased as "others" so
   * it can never read "1 person is coming" back at the one person who just replied.
   */
  othersComing: (others: number) =>
    others === 1 ? '1 other person is coming' : `${others} others are coming`,

  /** Shown when the reader is the first to say yes. Encouraging rather than lonely. */
  firstToReply: 'You are the first to reply.',
} as const;
