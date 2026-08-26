import type {
  EventRole,
  TemplateId,
  OccasionId,
  PlanId,
  PlatformRole,
  PostKind,
  RsvpStatus,
} from '@/config';

// Re-exported so consumers can import domain, role and plan types from one place.
export type { EventRole, TemplateId, OccasionId, PlanId, PlatformRole, PostKind, RsvpStatus };

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
  /** Including the guest. 1 means just them. */
  partySize: number;
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
  photoUrl: string | null;
  role: PlatformRole;
  isAnonymous: boolean;
  createdAt: number;
  lastSeenAt: number;
  suspendedAt: number | null;
  suspendedReason: string | null;
}

/** Where an invited address currently stands. */
export type InviteeStatus = 'pending' | 'sent' | 'failed' | 'unsubscribed';

export interface InviteeDoc {
  /** A hash of the address — the address itself is the identity, so it is the id. */
  id: string;
  email: string;
  name: string;
  status: InviteeStatus;
  addedAt: number;
  lastSentAt: number | null;
  sendCount: number;
  lastError: string | null;
  unsubscribedAt?: number;
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
