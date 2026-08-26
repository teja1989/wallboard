/**
 * Every cap, quota, and window in one place. Feature code must read from here — a magic
 * number in a route handler is a bug, because the client and server would drift apart.
 */

export const MB = 1024 * 1024;
export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Media kinds a post can carry. `text` posts have no attachment. */
export const POST_KINDS = ['text', 'image', 'video', 'audio'] as const;
export type PostKind = (typeof POST_KINDS)[number];

export type MediaKind = Exclude<PostKind, 'text'>;

export interface MediaRule {
  /** Hard byte cap enforced on the client, in the signed-URL request, and again at finalize. */
  maxBytes: number;
  /** Allowed MIME types. Anything else is rejected before a signed URL is issued. */
  mimeTypes: readonly string[];
  /** Extensions offered in the file picker. Never used for validation. */
  accept: string;
  /** Playback-duration cap in seconds, or null when duration does not apply. */
  maxDurationSeconds: number | null;
}

export const mediaRules: Record<MediaKind, MediaRule> = {
  image: {
    maxBytes: 15 * MB,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    accept: '.jpg,.jpeg,.png,.webp,.gif,.avif',
    maxDurationSeconds: null,
  },
  video: {
    maxBytes: 100 * MB,
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    accept: '.mp4,.webm,.mov',
    maxDurationSeconds: 60,
  },
  audio: {
    maxBytes: 25 * MB,
    mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/wav'],
    accept: '.mp3,.m4a,.aac,.ogg,.webm,.wav',
    maxDurationSeconds: 5 * 60,
  },
};

export const contentLimits = {
  eventTitleMaxLength: 80,
  eventDescriptionMaxLength: 280,
  postBodyMaxLength: 1000,
  displayNameMaxLength: 40,
  /** Private note a guest can leave with their RSVP. */
  rsvpNoteMaxLength: 300,
  /** The host's own custom RSVP question. */
  rsvpQuestionMaxLength: 120,
  rsvpAnswerMaxLength: 200,
  locationNameMaxLength: 120,
  locationAddressMaxLength: 240,
  dressCodeMaxLength: 60,
  hostedByMaxLength: 80,
  /** Guests one RSVP may bring, before the host's own plus-one setting narrows it. */
  maxPartySize: 10,
  /** Attachments per post. One keeps the wall layout predictable; raise with care. */
  mediaPerPost: 1,
  /** Posts fetched per page on the wall. */
  wallPageSize: 30,
} as const;

/**
 * Absolute ceilings, independent of plan.
 *
 * Per-plan caps live in `plans.config.ts` and are always the binding constraint in
 * practice; these exist so that a misconfigured plan, or a future one, still cannot ask
 * the system for something it cannot serve.
 */
export const eventCeilings = {
  maxActiveEventsPerHost: 50,
  maxMembersPerEvent: 1000,
  maxPostsPerEvent: 10_000,
  maxStorageBytesPerEvent: 50 * 1024 * MB,
} as const;

/**
 * How long the wall stays live after the event. Which of these a host can actually pick
 * depends on their plan's `maxEventLifetimeMs` — the longer windows are a paid entitlement,
 * because storage is the real cost in this product.
 */
export const expiryPresets = [
  { id: '24h', label: '24 hours', ms: DAY },
  { id: '3d', label: '3 days', ms: 3 * DAY },
  { id: '7d', label: '7 days', ms: 7 * DAY },
  { id: '30d', label: '30 days', ms: 30 * DAY },
  { id: '90d', label: '90 days', ms: 90 * DAY },
] as const;

export type ExpiryPresetId = (typeof expiryPresets)[number]['id'];
export const defaultExpiryPresetId: ExpiryPresetId = '7d';
/** Nothing may outlive this, whatever the plan says. */
export const absoluteMaxEventLifetimeMs = 90 * DAY;

/**
 * Grace window between an event expiring and its bytes being swept, so a host who
 * extends an event a minute after it lapsed does not lose the media.
 */
export const cleanupGraceMs = 6 * HOUR;

export const joinCodeConfig = {
  /** Crockford base32 minus look-alikes, so codes survive being read aloud. */
  alphabet: '23456789ABCDEFGHJKMNPQRSTVWXYZ',
  length: 8,
  /** Formatting only — never present in the stored or compared value. */
  displayGroupSize: 4,
} as const;

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

/**
 * Fixed-window rate limits. `ip` rules also apply to signed-out visitors, `user` rules
 * key on the Firebase uid. Both are checked where both are listed.
 */
export const rateLimits = {
  joinAttemptPerIp: { limit: 10, windowMs: 10 * MINUTE },
  joinAttemptPerUser: { limit: 20, windowMs: HOUR },
  createEventPerUser: { limit: 5, windowMs: HOUR },
  rsvpPerUser: { limit: 30, windowMs: HOUR },
  addInviteesPerUser: { limit: 20, windowMs: HOUR },
  sendInvitesPerUser: { limit: 10, windowMs: HOUR },
  remindInvitesPerUser: { limit: 5, windowMs: 6 * HOUR },
  unsubscribePerIp: { limit: 20, windowMs: HOUR },
  checkoutPerUser: { limit: 15, windowMs: HOUR },
  archivePerUser: { limit: 5, windowMs: HOUR },
  createPostPerUser: { limit: 30, windowMs: 10 * MINUTE },
  uploadTargetPerUser: { limit: 40, windowMs: 10 * MINUTE },
  sessionPerIp: { limit: 60, windowMs: 10 * MINUTE },
  mediaUrlPerUser: { limit: 300, windowMs: 10 * MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof rateLimits;

export const sessionConfig = {
  cookieName: '__Host-mq_session',
  /** Firebase session cookies max out at 14 days; we stay well under. */
  maxAgeMs: 5 * DAY,
  /** How long a minted media read URL stays valid. */
  mediaUrlTtlSeconds: 15 * 60,
  /** How long an upload target stays valid. */
  uploadUrlTtlSeconds: 15 * 60,
  /** Pending uploads older than this are swept even if never finalized. */
  pendingUploadTtlMs: HOUR,
} as const;
