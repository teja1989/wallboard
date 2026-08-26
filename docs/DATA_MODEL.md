# Data model

Timestamps are epoch milliseconds, so the same object crosses the server/client boundary
without a Firestore `Timestamp` reaching the browser. Documents that expire carry a parallel
`expiresAtTtl` **Date** field, because Firestore TTL policies require a real timestamp type.

```
users/{uid}
events/{eventId}
  private/joinCode          ← server-only
  members/{uid}
  posts/{postId}
joinCodes/{codeHash}        ← server-only
rateLimits/{bucketKey}      ← server-only
auditLogs/{logId}           ← server-only
```

## `users/{uid}`

| Field                     | Type           | Notes                                           |
| ------------------------- | -------------- | ----------------------------------------------- |
| `uid`                     | string         | matches the document id                         |
| `email`                   | string \| null | null for anonymous visitors                     |
| `displayName`             | string         | falls back to `Guest ABCD`                      |
| `photoUrl`                | string \| null |                                                 |
| `role`                    | platform role  | **a mirror**; the custom claim is authoritative |
| `isAnonymous`             | boolean        |                                                 |
| `createdAt`, `lastSeenAt` | number         | `lastSeenAt` written at most every 5 minutes    |
| `suspendedAt`             | number \| null | non-null blocks every write                     |
| `suspendedReason`         | string \| null |                                                 |

Readable only by the person themselves, or by staff. Never client-writable — otherwise a
browser could write `role: 'owner'` onto its own document.

## `events/{eventId}`

| Field                                      | Type                           | Notes                                              |
| ------------------------------------------ | ------------------------------ | -------------------------------------------------- |
| `title`, `description`                     | string                         | bounded by `contentLimits`                         |
| `hostUid`, `hostName`                      | string                         |                                                    |
| `themeId`                                  | theme id                       | from `branding.config.ts`                          |
| `status`                                   | `live` \| `ended` \| `expired` | see below                                          |
| `settings.whoCanPost`                      | `members` \| `anyone`          | `anyone` also needs the platform flag              |
| `settings.allowedKinds`                    | post kinds                     | host can turn off video, audio, etc.               |
| `settings.moderated`                       | boolean                        | reserved for phase 3                               |
| `createdAt`, `expiresAt`                   | number                         |                                                    |
| `expiresAtTtl`                             | Date                           | read by the TTL policy                             |
| `endedAt`                                  | number \| null                 | set when a host ends it early                      |
| `memberCount`, `postCount`, `storageBytes` | number                         | maintained transactionally                         |
| `sweptAt`                                  | number \| null                 | set by the cleanup job; makes the sweep idempotent |

`status` is stored, but reads go through `effectiveStatus()`, which returns `expired` once
`expiresAt` has passed — so a lapsed event reads correctly without waiting for a sweep.

Readable by members and staff. `memberCount` and `postCount` are denormalised counters, kept
in the same transaction as the thing they count.

## `events/{eventId}/private/joinCode`

| Field                    | Type               |
| ------------------------ | ------------------ |
| `code`                   | string (plaintext) |
| `codeHash`               | string             |
| `createdAt`, `rotatedAt` | number \| null     |

A subcollection document rather than a field on the event, because Firestore rules cannot
restrict a single field. `allow read, write: if false` — no client reaches it, host or owner.

## `events/{eventId}/members/{uid}`

| Field                            | Type                                          |
| -------------------------------- | --------------------------------------------- |
| `uid`, `displayName`, `photoUrl` |                                               |
| `role`                           | `viewer` \| `member` \| `moderator` \| `host` |
| `joinedAt`                       | number                                        |
| `mutedAt`                        | number \| null                                |
| `isAnonymous`                    | boolean                                       |

The document id is the uid, which makes "is this person a member?" a single `exists()` in the
rules. Anonymous visitors join as `viewer`; identified ones as `member`.

## `events/{eventId}/posts/{postId}`

| Field                                       | Type                                    | Notes                        |
| ------------------------------------------- | --------------------------------------- | ---------------------------- |
| `kind`                                      | `text` \| `image` \| `video` \| `audio` | derived from the attachment  |
| `authorUid`, `authorName`, `authorPhotoUrl` |                                         | denormalised for the wall    |
| `body`                                      | string                                  |                              |
| `media`                                     | `MediaAsset[]`                          | object **paths**, never URLs |
| `state`                                     | `visible` \| `removed` \| `quarantined` |                              |
| `createdAt`, `expiresAt`                    | number                                  | inherits the event's expiry  |

`MediaAsset`: `{ kind, objectPath, posterPath, mimeType, bytes, durationSeconds, width, height }`.

Deletion is a soft delete: `state` becomes `removed`, `body` and `media` are cleared, and the
bytes are destroyed immediately. The document survives so moderation stays reviewable and the
audit trail points at something real. Rules hide anything not `visible`.

Storing dimensions matters for the UI: the wall reserves the right height before the media URL
resolves, so nothing jumps as posts stream in.

## `joinCodes/{codeHash}`

| Field       | Type   |
| ----------- | ------ |
| `eventId`   | string |
| `expiresAt` | Date   |
| `createdAt` | number |

The document id **is** `sha256(pepper + code)`. Redemption is one `get` — no query, no
enumeration. Unreadable by every client; otherwise it would be a browsable index of every
live event.

## `rateLimits/{bucketKey}`

Key is `{name}__{base64url(subject)}__{windowStart}`, so the id is derivable without a read
and the subject can safely contain an IPv6 colon or a slash.

| Field                          | Type                            |
| ------------------------------ | ------------------------------- |
| `count`, `name`, `windowStart` |                                 |
| `expiresAt`                    | Date — TTL cleans spent buckets |

## `auditLogs/{logId}`

| Field                               | Type                              |
| ----------------------------------- | --------------------------------- |
| `actorUid`, `actorRole`             |                                   |
| `action`                            | one of `AUDIT_ACTIONS`            |
| `targetType`, `targetId`, `eventId` |                                   |
| `metadata`                          | flat map of primitives            |
| `ip`, `userAgent`                   | user agent truncated to 400 chars |
| `at`                                | number                            |

Append-only. Unreadable and unwritable by every client, owners included.

## Indexes

In `firestore.indexes.json`:

| Collection  | Fields                                | Serves               |
| ----------- | ------------------------------------- | -------------------- |
| `posts`     | `state`, `createdAt desc`             | the wall query       |
| `events`    | `hostUid`, `status`, `createdAt desc` | a host's own events  |
| `events`    | `status`, `expiresAt`                 | the cleanup sweep    |
| `auditLogs` | `eventId`, `at desc`                  | phase-2 audit viewer |
| `members`   | `role`, `joinedAt`                    | member lists         |

## TTL policies

Set these in the Firebase console or with `gcloud`; they are not part of the index file.

| Collection                 | Field          |
| -------------------------- | -------------- |
| `events`                   | `expiresAtTtl` |
| `posts` (collection group) | `expiresAtTtl` |
| `joinCodes`                | `expiresAt`    |
| `rateLimits`               | `expiresAt`    |

TTL deletes documents only. Bucket objects are the cleanup job's responsibility.
