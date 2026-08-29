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

/**
 * Display derivatives.
 *
 * Egress is the largest line on the bill and the only one we can fix in code: a 6 MB phone
 * photo viewed by eighty guests is half a gigabyte of transfer from one picture. Serving a
 * resized copy instead cuts media egress by roughly 95%.
 *
 * Generated in the browser at upload time rather than on the server. Ingress is free, so
 * uploading three files costs nothing, and it keeps a native image library — and its CPU,
 * its memory spikes and its latency — out of the request path entirely. The server still
 * validates every byte that lands, exactly as it does for the original.
 *
 * The original is kept untouched and served only in the archive, so "at the quality they
 * were uploaded" stays true.
 */
export const imageVariants = {
  /** For the wall grid. Small enough that a whole screen of them costs less than one photo. */
  preview: { maxEdge: 640, quality: 0.68, maxBytes: 250 * 1024 },
  /** For the lightbox, and the large candidate in the wall's srcset. */
  display: { maxEdge: 1800, quality: 0.78, maxBytes: 1_500_000 },
} as const;

export type ImageVariantId = keyof typeof imageVariants;
export const IMAGE_VARIANT_IDS = ['preview', 'display'] as const;

/**
 * Signed read URLs are cached and reused within this window.
 *
 * Not a micro-optimisation: a V4 signature changes on every mint, so a freshly signed URL
 * is a fresh cache key and the browser re-downloads an image it already has. Reusing the
 * same URL for everyone inside the window is what makes browser caching work at all.
 */
/**
 * How long an unpublished invitation survives in the browser.
 *
 * Signing in with an email link means leaving the site, opening an inbox, and coming back
 * through a different tab — so anything the host typed before that has to outlive a full
 * navigation or the sign-in costs them their work. Long enough to find the email, short
 * enough that a draft from last month does not ambush someone.
 */
/**
 * What a host can allow a reply to cover, the guest included.
 *
 * Phrased as people rather than "plus ones": a plus one is one, and a family with two
 * children is the ordinary case at half the occasions this product serves.
 */
export const partySizeChoices = [
  { value: 1, label: 'Just them' },
  { value: 2, label: 'Someone with them' },
  { value: 4, label: 'Up to 4' },
  { value: 6, label: 'Up to 6' },
] as const;

/**
 * Where "let me look first" is remembered.
 *
 * The create flow opens with the sign-in card, because an account captured at the top of
 * the funnel is the one that comes back — but a wall in front of a product nobody has seen
 * loses the people who were only curious, and they are the same people. So there is a way
 * past it, and taking it is remembered for the session: being asked the same question again
 * on every refresh is its own kind of wall.
 */
export const createGate = { browseKey: 'marquee.create.browsing' } as const;

export const eventDraft = {
  storageKey: 'marquee.draft.event.v1',
  ttlMs: 24 * HOUR,
} as const;

export const mediaUrlCache = {
  /** How long a minted URL is reused. Comfortably inside its own expiry. */
  reuseMs: 45 * 60 * 1000,
  /** Bounded so one busy event cannot grow the process memory without limit. */
  maxEntries: 5000,
} as const;

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
  /**
   * How many of a host's own events the account page lists. Generous, because someone who
   * hosts regularly is the customer worth keeping, and a truncated list is exactly what
   * makes them think their events are gone.
   */
  hostEventPageSize: 50,
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
/**
 * Sweeping objects out of the bucket.
 *
 * `concurrency` is how many deletes are in flight at once. Unbounded was the bug: a real
 * wedding wall is well over a thousand objects, and a thousand simultaneous requests earns
 * rate limiting rather than a fast delete.
 *
 * `pageSize` is how many are listed at a time. Listing everything first means holding the
 * metadata for an entire event in memory before a single byte is removed; a page at a time
 * costs one extra round trip and bounds the process instead.
 */
export const storageSweep = { concurrency: 32, pageSize: 500 } as const;

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
  updateAccountPerUser: { limit: 20, windowMs: HOUR },
  // Generous: this fires once per guest per visit, and a wedding opens in bursts as a
  // group chat reads the link. Tight enough that link tokens cannot be brute-forced.
  viewBeaconPerIp: { limit: 120, windowMs: 10 * MINUTE },
  // The `.ics` for an emailed invitation. Per-IP because the reader has no session, and
  // generous because a household opening the same invitation shares one address.
  calendarPerIp: { limit: 60, windowMs: 10 * MINUTE },
  // The one route in the app that costs money per call. Generous enough for someone
  // typing an address a few times, tight enough that a loop cannot run up a bill.
  placesSearchPerUser: { limit: 100, windowMs: HOUR },
  /*
    Operator screens. Limited despite being staff-only, because the account holding an
    operator role is the most valuable one to steal and a stolen session should not be able
    to enumerate the whole user table at machine speed. Loose enough that nobody doing the
    job ever meets it.
  */
  adminReadPerUser: { limit: 300, windowMs: 10 * MINUTE },
  adminSuspendPerUser: { limit: 30, windowMs: HOUR },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof rateLimits;

export const sessionConfig = {
  cookieName: '__Host-mq_session',
  /** Firebase session cookies max out at 14 days; we stay well under. */
  maxAgeMs: 5 * DAY,
  /**
   * How long a minted media read URL stays valid.
   *
   * An hour rather than fifteen minutes, so a URL survives long enough to be worth caching
   * — see `mediaUrlCache`. Still short enough that a link pasted elsewhere stops working
   * well before anyone finds it useful.
   */
  mediaUrlTtlSeconds: 60 * 60,
  /** How long an upload target stays valid. */
  uploadUrlTtlSeconds: 15 * 60,
  /** Pending uploads older than this are swept even if never finalized. */
  pendingUploadTtlMs: HOUR,
} as const;
