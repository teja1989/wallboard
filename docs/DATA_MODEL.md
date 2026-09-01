# Data model

Timestamps are epoch milliseconds, so the same object crosses the server/client boundary
without a Firestore `Timestamp` reaching the browser. Documents that expire carry a parallel
`expiresAtTtl` **Date** field, because Firestore TTL policies require a real timestamp type.

```
users/{uid}
events/{eventId}
  private/joinCode              ← server-only
  members/{uid}                 ← guest list, incl. the public half of each RSVP
  rsvpNotes/{uid}               ← server-only, the private half
  invitees/{inviteeId}          ← server-only, who the host means to invite
    deliveries/{deliveryId}     ← server-only, one attempt to reach one guest
  registry/{linkId}             ← the gift list; members read, only the host writes
  milestones/{milestoneId}      ← server-only, the host's planning list
  funnel/{YYYY-MM-DD}           ← server-only, aggregate counters, no identifiers
  posts/{postId}
joinCodes/{codeHash}            ← server-only
rateLimits/{bucketKey}          ← server-only
auditLogs/{logId}               ← server-only
mailOutbox/{messageId}          ← server-only, development driver only
```

Nine of those thirteen are `allow read, write: if false` in `firestore.rules`. That is the
shape of invariant 1 — every mutation goes through a route handler — showing up in the rules
rather than being asserted in prose: a browser cannot write anything here, and can read only
the event, the guest list and the gift list of an event it belongs to.

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

| Field                                      | Type                           | Notes                                                                |
| ------------------------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| `title`, `description`                     | string                         | bounded by `contentLimits`                                           |
| `occasion`                                 | occasion id                    | from `occasions.config.ts`; decides a lot, see below                 |
| `hostUid`, `hostName`                      | string                         |                                                                      |
| `hostedBy`                                 | string                         | who the invitation is _from_, e.g. "Priya & Sam"                     |
| `templateId`                               | template id                    | from `templates.config.ts`                                           |
| `status`                                   | `live` \| `ended` \| `expired` | see below                                                            |
| `startsAt`, `endsAt`                       | number \| null                 | when the event happens — not when the wall expires                   |
| `timeZone`                                 | string \| null                 | IANA zone; null on events predating it                               |
| `location`                                 | `EventLocation` \| null        | name, address, url, and optionally placeId/lat/lng                   |
| `dressCode`                                | string                         |                                                                      |
| `rsvp`                                     | `RsvpSettings`                 | enabled, deadline, plus-ones, party size, note, question, autoRemind |
| `rsvpTally`                                | `RsvpTally`                    | yes/no/maybe/pending plus `attending`, the headcount                 |
| `remindersSent`                            | string[]                       | slot ids already claimed; cleared when the date moves                |
| `plan`                                     | plan id                        | **stamped at creation**; see below                                   |
| `settings.whoCanPost`                      | `members` \| `anyone`          | `anyone` also needs the platform flag                                |
| `settings.allowedKinds`                    | post kinds                     | host can turn off video, audio, etc.                                 |
| `createdAt`, `expiresAt`                   | number                         |                                                                      |
| `expiresAtTtl`                             | Date                           | read by the TTL policy                                               |
| `endedAt`                                  | number \| null                 | set when a host ends it early                                        |
| `memberCount`, `postCount`, `storageBytes` | number                         | maintained transactionally                                           |
| `sweptAt`                                  | number \| null                 | set by the cleanup job; makes the sweep idempotent                   |

`status` is stored, but reads go through `effectiveStatus()`, which returns `expired` once
`expiresAt` has passed — so a lapsed event reads correctly without waiting for a sweep.

`plan` is **a fact recorded at a moment, not a rule evaluated later**. `planForNewEvent()`
resolves the account's plan and any promo grant once, at creation, and writes the answer here;
`effectivePlanId()` reads the stamp. Before that, entitlements were derived from global present
state, which meant turning `features.billing` on would have retroactively downgraded every live
event — hosts mid-party watching their wall shorten and their photos become unkeepable. See
[DECISIONS.md](./DECISIONS.md).

`occasion` carries more weight than it looks. It decides the template shortlist, the wording
throughout, whether a gift list is offered at all (`giftsExpected`), and which planning template
seeds the milestone board. A memorial and a birthday are the same schema and a different
product.

Readable by members and staff. `memberCount` and `postCount` are denormalised counters, kept
in the same transaction as the thing they count.

`settings.moderated` used to sit here, written `false` on every event and read by nothing. It
was removed rather than implemented — a boolean on every stored document is not a plan, it is
residue. Old documents keep a harmless orphan copy.

## `events/{eventId}/private/joinCode`

| Field                    | Type               |
| ------------------------ | ------------------ |
| `code`                   | string (plaintext) |
| `codeHash`               | string             |
| `createdAt`, `rotatedAt` | number \| null     |

A subcollection document rather than a field on the event, because Firestore rules cannot
restrict a single field. `allow read, write: if false` — no client reaches it, host or owner.

## `events/{eventId}/members/{uid}`

| Field                            | Type                                            |
| -------------------------------- | ----------------------------------------------- |
| `uid`, `displayName`, `photoUrl` |                                                 |
| `role`                           | `viewer` \| `member` \| `moderator` \| `host`   |
| `joinedAt`                       | number                                          |
| `mutedAt`                        | number \| null                                  |
| `isAnonymous`                    | boolean                                         |
| `rsvp`                           | `RsvpResponse` — the **public** half of a reply |

The document id is the uid, which makes "is this person a member?" a single `exists()` in the
rules. Anonymous visitors join as `viewer`; identified ones as `member`.

`rsvp` is `{ status, partySize, adults, children, respondedAt }` — who is coming and how many.
It sits on the member document precisely because the guest list is meant to show it. The
private half of the same reply lives in `rsvpNotes/`, one collection over, for the reason in
invariant 4.

`partySize` is kept as the total rather than derived, because it is what every headcount,
export and catering question actually asks for; `adults` and `children` are the breakdown
behind it and always sum to it.

## `events/{eventId}/rsvpNotes/{uid}`

| Field                | Type                                       |
| -------------------- | ------------------------------------------ |
| `uid`, `displayName` |                                            |
| `note`               | the guest's private message to the host    |
| `answer`             | their answer to the host's custom question |
| `updatedAt`          | number                                     |

A separate subcollection purely because Firestore rules cannot restrict a single field, and
a note addressed to the host is not for the rest of the guest list. `allow read, write: if
false` — nobody reaches it from a browser, host and owner included.

## `events/{eventId}/invitees/{inviteeId}`

Who the host means to invite — distinct from `members/`, which is who has actually turned up.
Someone can sit here for a week having never opened anything.

| Field                                        | Type                                      | Notes                                                |
| -------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `id`                                         | string                                    | opaque, matches the document id — see below          |
| `name`                                       | string                                    |                                                      |
| `email`                                      | string \| null                            |                                                      |
| `phone`                                      | string \| null                            | E.164, normalised on the way in                      |
| `channel`                                    | `email` \| `sms` \| `whatsapp` \| `relay` | `relay` is the host sending it themselves            |
| `token`                                      | string                                    | the credential in this guest's personal link         |
| `status`, `statusAt`                         | delivery state, number                    | denormalised from the timeline                       |
| `addedAt`, `lastSentAt`, `sendCount`         | number                                    |                                                      |
| `lastError`                                  | string \| null                            |                                                      |
| `unsubscribedAt`                             | number \| undefined                       |                                                      |
| `firstViewedAt`, `lastViewedAt`, `viewCount` | number \| null, number                    | set by the view beacon, never by a server-side fetch |
| `repliedAt`                                  | number \| null                            |                                                      |

**The id is opaque and deliberately not derived from any address.** It used to be a hash of
the email, because the address _was_ the identity — which made someone who was known by phone
unrepresentable, and made a guest who later gained an address into a second guest. Identity is
now the document; contact details hang off it.

`token` is what makes "who opened it?" answerable at all. Without a per-guest credential every
recipient shares one link and every view is anonymous. It is minted on add, and lazily for rows
that predate it, so no migration was needed. **It is never client-readable** — the whole
collection is `allow read, write: if false`, which is also invariant 4: a list of the email
addresses of everyone at somebody's wedding is not for the rest of the guest list.

`firstViewedAt` comes from a beacon rather than a redirect or a pixel. Mail scanners fetch
every URL in a message before a human sees it, so counting a server-side fetch as a view means
reporting that a guest opened an invitation they have not yet been shown.

## `events/{eventId}/invitees/{inviteeId}/deliveries/{deliveryId}`

One attempt to reach one guest, and what became of it.

| Field                    | Type                       | Notes                               |
| ------------------------ | -------------------------- | ----------------------------------- |
| `channel`                | comms channel              |                                     |
| `kind`                   | string                     | `invitation` or `reminder`          |
| `state`                  | delivery state             | current position on the ladder      |
| `history`                | `{ state, at, detail? }[]` | every transition, in order          |
| `providerMessageId`      | string \| null             | reconciles a webhook to the attempt |
| `createdAt`, `updatedAt` | number                     |                                     |

State climbs `queued → sent → delivered → seen → replied`. There is deliberately no "opened":
Apple Mail Privacy Protection prefetches images for a large share of recipients, so an open
pixel measures Apple, not a person.

Read only when the host opens a single guest. The current state is denormalised onto the
invitee precisely so that drawing a list of two hundred guests is one query rather than two
hundred subcollection reads.

## `events/{eventId}/funnel/{YYYY-MM-DD}`

One document per event per day, holding nothing but integers.

| Field               | Type   | Notes                                               |
| ------------------- | ------ | --------------------------------------------------- |
| one key per counter | number | keys are `FUNNEL_EVENTS` from `analytics.config.ts` |
| `day`               | string | the document id, repeated for querying              |
| `updatedAt`         | number |                                                     |

**There is no visitor id, no session and no path — by construction, not by policy.** The
question this answers is "what fraction of invitations get opened", and that needs sums, not
people. Sums cannot be de-anonymised, so the promise that the event disappears needs no careful
qualification. The moment a row exists per visitor, the product is keeping a behavioural record
of guests at somebody's wedding.

Every increment is fired from a route handler on the server, so nothing here can be forged by a
client inflating its own numbers, and every one is best-effort: measuring an RSVP must never be
able to stop one. `analyticsConfig.failOpen` is what makes that explicit.

Two counters are named in a way worth reading twice. `invitationOpened` counts opens, not
openers, so it can exceed `inviteSent` when a link is forwarded — the console explains that
rather than clamping it. `rsvpAnswered` and `rsvpYes` are first-reply only, so changing an
answer does not inflate them.

## `events/{eventId}/registry/{linkId}`

| Field        | Type   | Notes                                                             |
| ------------ | ------ | ----------------------------------------------------------------- |
| `id`         | string | matches the document id; twelve base64url characters              |
| `label`      | string | what the host calls it, or the destination's name if they did not |
| `url`        | string | http(s) only, validated before it is stored                       |
| `note`       | string | optional line under the name                                      |
| `order`      | number | append order                                                      |
| `addedAt`    | number |                                                                   |
| `clickCount` | number | server-incremented; the host's per-link view of the funnel        |

The one host-managed subcollection guests are _meant_ to read: it renders on the invitation,
and a guest deciding what to bring is the whole audience. So `allow read: if isMemberOf(...)`,
and writes go through the host-only API like everything else — including `clickCount`, which a
browser must not be able to inflate.

Whether an event has one at all is decided by `occasion.giftsExpected`, not by the host and
not by the plan. A work offsite and a memorial never ask anybody for anything, and putting the
gift list behind a paywall would mean the only invitations asking guests for money are the
ones we were already paid for.

No prices, no images, no stock. Fetching those would make this a worse version of the shop the
host already chose, and Amazon's terms forbid caching a price beyond 24 hours anyway.

## `events/{eventId}/milestones/{milestoneId}`

| Field                    | Type                         | Notes                                                |
| ------------------------ | ---------------------------- | ---------------------------------------------------- |
| `title`, `note`          | string                       |                                                      |
| `categoryId`             | venue \| food \| guests \| … | from `planning.config.ts`                            |
| `done`, `doneAt`         | boolean, number \| null      | `doneAt` derived from `done`, never sent by a client |
| `dueAt`                  | number \| null               | seeded backwards from `startsAt`; null with no date  |
| `budget`                 | number \| null               | whole currency units                                 |
| `order`                  | number                       |                                                      |
| `templateKey`            | string \| null               | null for a row the host wrote                        |
| `live`                   | headcount \| replies \| …    | which live number this row shows                     |
| `createdAt`, `updatedAt` | number                       |                                                      |

`allow read, write: if false` — and unusually the **host** is locked out too. Reads because
this is somebody's working notes about their own party, the budget included, and a guest
reading the catering spend for the party they are attending is a surprise this product must
never produce. Writes because ticking a row is gated on the `eventPlanning` entitlement, and a
Firestore rule cannot check one.

**Nothing is written until the host touches it.** A read returns saved rows if any exist and
otherwise renders the occasion's template from config, with ids of the form `template:{key}`.
The first mutation materialises the whole template and then applies itself. So reads stay pure,
a host who never opens the tab has nothing written on their behalf, and the seeded wording
stays editable in config right up until somebody uses it. `templateKey` is what makes that
idempotent — the seed cannot run twice into duplicates.

The read also returns `live` numbers derived from the event in hand (headcount, replies still
outstanding, the venue). Never stored: they cannot go stale, and they cost no extra read.

## `events/{eventId}/posts/{postId}`

| Field                                       | Type                                    | Notes                        |
| ------------------------------------------- | --------------------------------------- | ---------------------------- |
| `kind`                                      | `text` \| `image` \| `video` \| `audio` | derived from the attachment  |
| `authorUid`, `authorName`, `authorPhotoUrl` |                                         | denormalised for the wall    |
| `body`                                      | string                                  |                              |
| `media`                                     | `MediaAsset[]`                          | object **paths**, never URLs |
| `state`                                     | `visible` \| `removed` \| `quarantined` |                              |
| `createdAt`, `expiresAt`                    | number                                  | inherits the event's expiry  |

`MediaAsset`: `{ kind, objectPath, previewPath, displayPath, mimeType, bytes, durationSeconds,
width, height }`.

`objectPath` is the original, kept untouched for the archive. `previewPath` (640px) and
`displayPath` (1800px) are WebP copies the browser encodes before upload; the wall renders
them through a `srcset` and only the lightbox reaches for the display size. Either may be
null — an encode can fail, or the browser can lack canvas WebP — in which case the wall falls
back to the original. That costs egress but shows the right picture, which is the correct
trade in that direction.

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

| Field                               | Type                                        |
| ----------------------------------- | ------------------------------------------- |
| `actorUid`, `actorRole`             |                                             |
| `action`                            | one of `AUDIT_ACTIONS` in `audit.config.ts` |
| `targetType`, `targetId`, `eventId` |                                             |
| `metadata`                          | flat map of primitives                      |
| `ip`, `userAgent`                   | user agent truncated to 400 chars           |
| `at`                                | number                                      |

Append-only. Unreadable and unwritable by every client, owners included — the console reads it
through `GET /api/admin/audit`, which records `admin.auditViewed` for the read itself.

Written for every privileged action since v1, before there was anything to read it with. A log
that starts when its console does has nothing to show about the incident that made somebody
open it, and retrofitting call sites is how gaps get left behind.

`recordAudit` never throws. An audit write failing must not take a guest's RSVP down with it;
the failure goes to the server console and the request continues.

## `mailOutbox/{messageId}`

Development only. The outbox email driver writes rendered messages here instead of sending
them, so the emulator UI at `:4000` shows exactly what would have gone out. Server-only in
every environment, because it holds rendered messages addressed to real people.

## Indexes

Declared **twice**, and both must be kept in step: `firestore.indexes.json` for the emulator
and the Firebase CLI, and `infra/terraform/firestore.tf` for the real project. Terraform is
what actually provisions production.

| Collection  | Fields                                | Serves                                              |
| ----------- | ------------------------------------- | --------------------------------------------------- |
| `posts`     | `state`, `createdAt desc`             | the wall query                                      |
| `events`    | `hostUid`, `createdAt desc`           | a host's own events                                 |
| `events`    | `hostUid`, `startsAt desc`            | a host's events by date                             |
| `events`    | `hostUid`, `status`, `createdAt desc` | a host's events, filtered                           |
| `events`    | `hostUid`, `status`, `expiresAt`      | a host's live events by expiry                      |
| `events`    | `status`, `expiresAt`                 | the cleanup sweep                                   |
| `events`    | `status`, `createdAt`                 |                                                     |
| `events`    | `status`, `startsAt`                  | the reminder sweep — two range bounds on `startsAt` |
| `auditLogs` | `eventId`, `at desc`                  | the console's audit filter, by event                |
| `auditLogs` | `actorUid`, `at desc`                 | the console's audit filter, by actor                |
| `members`   | `role`, `joinedAt`                    | member lists                                        |
| `members`   | `rsvp.status`, `joinedAt`             | the guest list, filtered by reply                   |

**The emulator does not enforce composite indexes and production does.** A query that works
locally can fail on deploy with nothing in between to warn you, so a new `where` + `orderBy`
combination means adding the index in both files in the same commit. The range field goes
last.

Two queries here deliberately do _not_ have an index. The admin console's cross-event funnel
rollup reads each event's `funnel` subcollection in sequence rather than as a collection
group — N+1 by choice, because a collection-group index over per-event counters is a
standing invitation to query them in ways the no-identifiers design does not want.

## TTL policies

Set these in the Firebase console or with `gcloud`; they are not part of the index file.

| Collection                 | Field          |
| -------------------------- | -------------- |
| `events`                   | `expiresAtTtl` |
| `posts` (collection group) | `expiresAtTtl` |
| `joinCodes`                | `expiresAt`    |
| `rateLimits`               | `expiresAt`    |

TTL deletes documents only. Bucket objects are the cleanup job's responsibility.
