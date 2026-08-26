import type { EventRole, EventThemeId, PlatformRole, PostKind } from '@/config';

// Re-exported so consumers can import domain and role types from one place.
export type { EventRole, EventThemeId, PlatformRole, PostKind };

/**
 * Wire-shaped domain types. Timestamps are epoch milliseconds so the same object
 * crosses the server/client boundary without a Firestore Timestamp on the client.
 */

export type EventStatus = 'live' | 'ended' | 'expired';
export type PostState = 'visible' | 'removed' | 'quarantined';

export interface MediaAsset {
  kind: Exclude<PostKind, 'text'>;
  objectPath: string;
  posterPath: string | null;
  mimeType: string;
  bytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

/** MediaAsset with short-lived signed URLs attached, as sent to the browser. */
export interface ResolvedMedia extends MediaAsset {
  url: string;
  posterUrl: string | null;
  urlExpiresAt: number;
}

export interface EventSettings {
  /** Who may post: members only, or anyone holding the code. */
  whoCanPost: 'members' | 'anyone';
  allowedKinds: readonly PostKind[];
  /** Require host approval before a post appears. Reserved for phase 3. */
  moderated: boolean;
}

export interface EventDoc {
  id: string;
  title: string;
  description: string;
  hostUid: string;
  hostName: string;
  themeId: EventThemeId;
  status: EventStatus;
  settings: EventSettings;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
  memberCount: number;
  postCount: number;
  storageBytes: number;
}

/** What a visitor is allowed to see about an event before joining. */
export type EventPreview = Pick<EventDoc, 'id' | 'title' | 'themeId' | 'status' | 'expiresAt'> & {
  hostName: string;
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
