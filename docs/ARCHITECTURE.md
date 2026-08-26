# Architecture

## The shape of it

```
Browser ──┬─ Next.js pages (RSC + client components)
          │     ├─ invitation + RSVP  ─ fetched per request
          │     └─ live wall          ─ Firestore onSnapshot, under the visitor's identity
          │
          ├─ /api/* ─ Route Handlers ─ Zod ─ authz ─ entitlements ─ rate limit ─ Firestore
          │                                                                    └─ audit log
          └─ PUT/POST (server-issued URL) ─────────► Cloud Storage / Storage emulator
```

One event, three surfaces — invitation, wall and guest list — served from one page and one
Firestore document tree. Four ideas carry most of the design.

### 1. Writes are server-only; reads can be direct

Firestore security rules grant clients **read** access to documents they are a member of,
and deny **every client write**. Every mutation goes through a Route Handler that validates
input, checks authorization, consumes a rate-limit token, and writes an audit entry.

Clients keep direct Firestore _reads_ because that is what makes the wall live — a new post
appears in every open browser without polling. Losing that would mean either a polling loop
or a websocket layer we would have to build and operate ourselves.

The rules are not the primary access control; the API is. The rules exist so that a browser
holding a valid ID token and talking to Firestore directly still cannot reach anything it
should not. See [SECURITY.md](./SECURITY.md).

### 2. Everyone has a uid, but not everyone has an account

A visitor arriving from a shared code is signed in **anonymously** so the wall's listeners
have an identity to authorize. When they want to post, the app calls `linkWithCredential` /
`linkWithPopup` rather than a fresh sign-in — **the uid is preserved**, so their membership
and anything they already posted stay theirs.

The browser holds an httpOnly **session cookie**, not an ID token. The ID token exists for
exactly one request: the exchange at `POST /api/session`. Nothing durable and stealable is
left in browser-readable storage.

The server session is authoritative for identity. The client SDK's local state lives in
IndexedDB, which a private window, a cleared site, or a different device will not have — so
`AuthProvider` asks `GET /api/session` on mount before deciding anyone is a guest.

### 3. Answers are public, notes are not

An RSVP is two pieces of data with two audiences. The answer and the headcount belong to
the guest list — that is what a guest list is. The note a guest writes for the host, and
their answer to the host's custom question, belong to the host alone.

Firestore rules cannot restrict a single field, so the split has to be **structural**: the
answer lives on `events/{id}/members/{uid}`, which members can read, and the note lives in
`events/{id}/rsvpNotes/{uid}`, which nobody can read from a browser at all. The host reads
notes through an API call that is authorised and logged.

The `rsvpTally` on the event is maintained transactionally rather than counted on read. A
host refreshing the guest list during a party should not trigger a scan of five hundred
member documents, and the delta is always computed from the stored member document rather
than from anything the client claims — otherwise replaying a request would inflate the
headcount.

### 4. Media never touches the app server

Uploading is a two-step handshake:

1. `POST /api/posts/upload-target` returns a URL the browser uploads to **directly**.
2. `POST /api/posts` finalizes: the server `stat`s the object that actually landed,
   re-checks its real size and content type, promotes it to its final path, and only then
   creates the post document.

Step 2 is why the client's declared byte count does not matter. A client that lies is caught
against the object in the bucket, the pending upload is deleted, and no post is created.

Reading works the same way in reverse: post documents hold object _paths_, never URLs.
Playable URLs are minted per request at `GET /api/media/[eventId]`, only for members, and
they expire. A link pasted elsewhere stops working, and removing someone from an event
actually removes their access to the media.

## Plans and entitlements

Two independent axes, deliberately not merged:

|                  | Answers           | Lives in          | Consumed by         |
| ---------------- | ----------------- | ----------------- | ------------------- |
| **Permissions**  | who you are       | `roles.config.ts` | `can()`             |
| **Entitlements** | what was paid for | `plans.config.ts` | `entitlementsFor()` |

Merging them would mean a paywall an admin accidentally bypasses, or a permission a
customer can buy. Both are pure and dependency-free, so both run on the server, in client
components, and in tests.

An event stores the plan it runs on. `effectivePlanId()` resolves it — and while
`features.billing` is off, it returns `previewPlanId` for every event, so nothing is gated
and every entitlement code path is still exercised on every request. Switching billing on is
a flag, not a migration.

That is a product decision as much as a technical one: gating an unproven product behind a
paywall measures nothing except how quickly people leave.

## The storage adapter

```ts
interface StorageAdapter {
  createUploadTarget(request): Promise<UploadTarget>;
  createReadUrl(objectPath, ttlSeconds): Promise<string>;
  stat(objectPath): Promise<ObjectStat | null>;
  put(objectPath, body, contentType): Promise<void>;
  copy(fromPath, toPath): Promise<void>;
  delete(objectPaths): Promise<void>;
  deletePrefix(prefix): Promise<number>;
}
```

Two implementations, chosen by `STORAGE_DRIVER`:

| Driver     | Used for    | Upload                        | Read                     |
| ---------- | ----------- | ----------------------------- | ------------------------ |
| `gcs`      | production  | V4 signed PUT, length-bound   | V4 signed GET, short TTL |
| `emulator` | development | Storage emulator media upload | plain emulator URL       |

Application code imports `storage()` and never the GCS SDK — ESLint enforces this, with
`gcs.adapter.ts` as the single exception. That is what lets the whole app run with no GCP
account while the object paths and the client code path stay identical to production.

The emulator driver does have two honest divergences, both documented in the file: it cannot
sign URLs (so its "signed" URLs carry no access control) and it emulates `copy` as
read-then-write because the emulator answers 501 to the GCS `copyTo` call.

## Expiry

Three mechanisms, because no single one is sufficient:

| Mechanism                             | Removes             | Why it alone is not enough            |
| ------------------------------------- | ------------------- | ------------------------------------- |
| Firestore TTL policy on `expiresAt`   | documents           | knows nothing about bucket objects    |
| Cleanup job (`/api/internal/cleanup`) | objects, by prefix  | needs a scheduler to fire it          |
| GCS object lifecycle rules            | objects, eventually | coarse; a backstop, not the mechanism |

The cleanup job is the one that makes the product's promise true. It waits `cleanupGraceMs`
past expiry before sweeping, so a host who extends an event minutes after it lapsed gets
their wall back intact.

## Where things live

| Path                | Holds                                               |
| ------------------- | --------------------------------------------------- |
| `src/config/*`      | every tunable — limits, flags, roles, tokens, env   |
| `src/lib/authz/`    | `can()` policy engine, session resolution           |
| `src/lib/services/` | events, posts, cleanup — logic shared across routes |
| `src/lib/storage/`  | the adapter and its two drivers                     |
| `src/app/api/`      | route handlers; thin, they orchestrate services     |
| `src/components/`   | UI, grouped by area                                 |
| `src/proxy.ts`      | security headers and the CSP nonce                  |
| `firestore.rules`   | the boundary a browser cannot cross                 |

## Deliberate omissions

- **No video transcoding.** Files are stored as uploaded, with duration and size caps
  instead. `features.transcoding` reserves the seam; enabling it will not change the post
  schema.
- **No admin console yet.** The role model, audit log, and `can()` matrix that it needs all
  ship now, because retrofitting those is how gaps get left behind. See
  [ROADMAP.md](./ROADMAP.md).
- **No payment path.** The entitlement gates are written and tested; only Stripe is missing.
  See [PRICING.md](./PRICING.md) for what turning it on involves.
- **No email delivery.** Invitations are shared as a link or a code. Sending them by email is
  a real gap against Evite and is the top item in phase 2.
- **Rate limiting on Firestore.** One document write per check, which is the wrong long-term
  home. It is behind a `RateLimiter` interface; swapping in Memorystore is one line.
