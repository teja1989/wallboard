import { HOUR, MINUTE } from './limits.config';

/**
 * Email.
 *
 * The thing to understand about this feature is that it is a spam relay unless it is built
 * carefully. An app that lets any signed-up account send mail to any address it types in is
 * one abuse report away from a blocked sending domain — and a blocked domain means nobody's
 * invitations arrive, including the paying customers'.
 *
 * So the limits below are not politeness. They are what keeps the product working.
 */

export const EMAIL_KINDS = ['invitation', 'reminder', 'rsvpConfirmation'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const emailConfig = {
  /**
   * Mail is sent from Marquee's own domain with the host's name in the display name, and
   * their address as reply-to. Sending as the host would require every host to verify DNS,
   * which no consumer will do, and would fail SPF for everyone who did not.
   *
   * The domain has to be one we actually own and have verified with the provider. It used
   * to read `marquee.app`, which we do not: every real send would have failed SPF and
   * landed in spam, if it left at all.
   *
   * The *from* address itself is a server concern and lives in `serverConfig().email`, so
   * it can be overridden per deploy — this file reaches client components, and an env read
   * here would be inlined at build time.
   */
  sendingDomain: 'marqueersvp.com',
  fromNameSuffix: 'via Marquee',

  /** Invitees a host may add to one event, before the plan's guest cap also applies. */
  maxInviteesPerEvent: 500,
  /** Addresses one request may add. Keeps a paste of a whole address book bounded. */
  maxInviteesPerRequest: 100,

  /**
   * A reminder is a nudge, not a campaign. One per guest per event per day, and never to
   * someone who has already replied.
   */
  reminderCooldownMs: 20 * HOUR,

  /** How long a send lock is held while a batch is in flight, so two clicks send once. */
  sendLockMs: 2 * MINUTE,

  /** Unsubscribe tokens are derived, not stored, so there is nothing extra to leak. */
  unsubscribeTokenBytes: 32,
} as const;

/** Where a guest writes when something is wrong. */
export const supportAddress = `hello@${emailConfig.sendingDomain}`;

/**
 * Per-account sending limits, on top of the per-event caps.
 *
 * Deliberately tighter than the guest caps: a Pro host running 25 events is not sending
 * 12,500 emails in an afternoon, and if they try, we want to notice.
 */
export const emailLimits = {
  sendBatchPerUser: { limit: 10, windowMs: HOUR },
  addInviteesPerUser: { limit: 20, windowMs: HOUR },
  remindPerUser: { limit: 5, windowMs: 6 * HOUR },
} as const;

/** Subject lines. Kept here rather than in the renderer so wording stays product, not code. */
export const emailSubjects = {
  invitation: (title: string, hostedBy: string) => `${hostedBy} invited you: ${title}`,
  reminder: (title: string) => `Still hoping you can make it — ${title}`,
  rsvpConfirmation: (title: string) => `You're on the list for ${title}`,
} as const;
