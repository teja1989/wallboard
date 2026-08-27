import type {
  CommsChannel,
  DeliveryState,
  EventRole,
  TemplateId,
  OccasionId,
  PlanId,
  PlatformRole,
  PostKind,
  RsvpStatus,
} from '@/config';

// Re-exported so consumers can import domain, role and plan types from one place.
export type {
  CommsChannel,
  DeliveryState,
  EventRole,
  TemplateId,
  OccasionId,
  PlanId,
  PlatformRole,
  PostKind,
  RsvpStatus,
};

/**
 * Wire-shaped domain types. Timestamps are epoch milliseconds so the same object
 * crosses the server/client boundary without a Firestore Timestamp on the client.
 */

export type EventStatus = 'live' | 'ended' | 'expired';
export type PostState = 'visible' | 'removed' | 'quarantined';

export interface MediaAsset {
  kind: Exclude<PostKind, 'text'>;
  /** The file as uploaded. Served only in the archive — see `previewPath`. */
  objectPath: string;
  /**
   * Resized copies. Null when the browser could not produce them, in which case the
   * original is shown instead: correct, but expensive in egress.
   *
   * For video these are frames from the clip, which is what the wall shows until someone
   * presses play.
   */
  previewPath: string | null;
  displayPath: string | null;
  mimeType: string;
  bytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

/** MediaAsset with short-lived signed URLs attached, as sent to the browser. */
export interface ResolvedMedia extends MediaAsset {
  url: string;
  previewUrl: string | null;
  displayUrl: string | null;
  urlExpiresAt: number;
}

export interface EventSettings {
  /** Who may post: members only, or anyone holding the code. */
  whoCanPost: 'members' | 'anyone';
  allowedKinds: readonly PostKind[];
  /** Require host approval before a post appears. Reserved for phase 3. */
  moderated: boolean;
}

/** Where the event happens. All optional — plenty of invitations are "ours, 8pm". */
export interface EventLocation {
  name: string;
  address: string;
  /** A maps link the host pasted. Validated to http(s) before it is stored. */
  url: string | null;
}

export interface RsvpSettings {
  /** A save-the-date or a memorial notice may not want replies at all. */
  enabled: boolean;
  /** After this, the invitation shows as closed. Null means no deadline. */
  deadline: number | null;
  allowPlusOnes: boolean;
  /** Total people one reply may cover, including the guest themselves. */
  maxPartySize: number;
  /** Collect a private note with the reply. A paid entitlement. */
  askNote: boolean;
  /** One extra question, e.g. "any dietary requirements?". A paid entitlement. */
  question: string | null;
}

export interface RsvpResponse {
  status: RsvpStatus;
  /**
   * Everyone coming, the guest included. Kept as the total because it is what every
   * headcount, tally and export is actually asking for; `adults` and `children` are the
   * breakdown behind it and always sum to it.
   */
  partySize: number;
  /** Including the guest, so at least 1 for anyone who is coming. */
  adults: number;
  children: number;
  respondedAt: number | null;
}

/** Aggregate counts shown to the host. Maintained transactionally on the event. */
export interface RsvpTally {
  yes: number;
  no: number;
  maybe: number;
  pending: number;
  /** Sum of party sizes across every "yes" — the number that matters for catering. */
  attending: number;
}

export interface EventDoc {
  id: string;
  title: string;
  description: string;
  occasion: OccasionId;
  hostUid: string;
  hostName: string;
  /** Who the invitation is from, e.g. "Priya & Sam". Falls back to the host's name. */
  hostedBy: string;
  templateId: TemplateId;
  status: EventStatus;
  /** When the event itself happens — distinct from when the wall expires. */
  startsAt: number | null;
  endsAt: number | null;
  location: EventLocation | null;
  dressCode: string;
  rsvp: RsvpSettings;
  rsvpTally: RsvpTally;
  settings: EventSettings;
  /** The plan this event runs on. Resolved through effectivePlanId() before use. */
  plan: PlanId;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
  memberCount: number;
  postCount: number;
  storageBytes: number;
}

/** What a visitor is allowed to see about an event before joining. */
export type EventPreview = Pick<
  EventDoc,
  'id' | 'title' | 'templateId' | 'occasion' | 'status' | 'expiresAt' | 'startsAt'
> & {
  hostedBy: string;
  memberCount: number;
};

export interface MemberDoc {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  role: EventRole;
  joinedAt: number;
  mutedAt: number | null;
  isAnonymous: boolean;
  /** The guest's reply. Everyone who redeems a code starts at `pending`. */
  rsvp: RsvpResponse;
}

/**
 * The private half of a reply: the note and the custom answer.
 *
 * Kept in its own subcollection because Firestore rules cannot restrict a single field,
 * and a note addressed to the host should not be readable by every other guest.
 */
export interface RsvpNoteDoc {
  uid: string;
  displayName: string;
  note: string;
  answer: string;
  updatedAt: number;
}

export interface PostDoc {
  id: string;
  eventId: string;
  kind: PostKind;
  authorUid: string;
  authorName: string;
  authorPhotoUrl: string | null;
  body: string;
  media: MediaAsset[];
  state: PostState;
  createdAt: number;
  expiresAt: number;
}

export interface UserDoc {
  uid: string;
  email: string | null;
  displayName: string;
  /**
   * Set once the account holder has renamed themselves. Without it a Google account is
   * renamed back to the name on the token every time the session is reminted, which would
   * make the settings form appear to work and then silently undo itself.
   */
  displayNameChosen?: boolean;
  photoUrl: string | null;
  role: PlatformRole;
  isAnonymous: boolean;
  createdAt: number;
  lastSeenAt: number;
  suspendedAt: number | null;
  suspendedReason: string | null;
}

/**
 * Someone the host means to invite.
 *
 * The id used to be a hash of the email address, because the address *was* the identity.
 * People know each other by phone at least as often as by email, so identity is now the
 * document itself: an opaque id, with an address, a number, or both hanging off it. That
 * also means a guest can gain a phone later without becoming a second guest.
 */
export interface InviteeDoc {
  /** Opaque. Deliberately not derived from any address — see above. */
  id: string;
  name: string;
  email: string | null;
  /** E.164. Normalised on the way in, so it is dialable or it is not stored. */
  phone: string | null;
  /** How the host means to reach them. `relay` is the host sending it themselves. */
  channel: CommsChannel;

  /**
   * The credential in this guest's personal invitation link.
   *
   * It is what makes "who opened it?" answerable at all — without it every recipient shares
   * one link and every view is anonymous. Minted on add, and lazily for rows that predate
   * it, so no migration was needed.
   */
  token: string;

  /** How far the invitation got. Denormalised from the timeline so the list is one read. */
  status: DeliveryState;
  statusAt: number;

  addedAt: number;
  lastSentAt: number | null;
  sendCount: number;
  lastError: string | null;
  unsubscribedAt?: number;

  /** Set by the view beacon, never by a server-side fetch. See `recordView`. */
  firstViewedAt: number | null;
  lastViewedAt: number | null;
  viewCount: number;
  repliedAt: number | null;
}

/**
 * One attempt to reach one guest, and what became of it.
 *
 * Lives at `invitees/{inviteeId}/deliveries/{id}` and is read only when the host opens a
 * single guest. The current state is denormalised onto the invitee precisely so that the
 * common case — drawing a list of two hundred guests — does not fan out into two hundred
 * subcollection reads.
 */
export interface DeliveryDoc {
  id: string;
  channel: CommsChannel;
  /** 'invitation' or 'reminder'. */
  kind: string;
  state: DeliveryState;
  /** Every transition, in order, so a host can see when each thing happened. */
  history: { state: DeliveryState; at: number; detail?: string }[];
  /** The provider's id, for reconciling a webhook against the attempt that caused it. */
  providerMessageId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AuditLogDoc {
  id: string;
  actorUid: string;
  actorRole: PlatformRole;
  action: string;
  targetType: 'event' | 'post' | 'user' | 'member' | 'system';
  targetId: string;
  eventId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  ip: string | null;
  userAgent: string | null;
  at: number;
}

/** The caller identity every API handler resolves before doing anything else. */
export interface Actor {
  uid: string;
  email: string | null;
  displayName: string;
  photoUrl: string | null;
  role: PlatformRole;
  isAnonymous: boolean;
  suspended: boolean;
}
