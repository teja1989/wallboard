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
Firestore document tree. A handful of decisions carry most of the design.

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

### 3. The account is asked for at the door, with a way past it

Hosting needs a durable identity. The host alone can delete the event, read guests' private
replies, rotate the join code and download the archive, and an anonymous session lives in
browser storage that a cleared cookie takes with it — losing a wedding wall permanently
while guests are still posting to it.

`/create` asks first, because an account taken at the top of the funnel is the one that
comes back: a host who signs in before typing can be reached, can be counted, and finds
their invitation again from any device. But a gate with no way past it also turns away
everyone who wanted to see what they were signing up for, so the card offers **"Have a look
around first"**. Taking it is remembered for the session, and publish asks again — where
the question answers itself: sign in so that only you can change this. The uid survives
the upgrade, so the draft stays the same person's.

The email-link path leaves the site entirely — inbox, then a different tab — so the draft is
persisted to `localStorage` as it is typed and resumed on the way back, and `/auth/finish`
returns to the path that sent them rather than the home page. A draft that publish was
pressed on finishes the job; one merely left behind is restored and left alone, because
signing in for some other reason must never send someone's half-written invitation.

`/signin` is the same flow with no invitation attached: a host with a new phone needs a way
back to invitations they already own.

### 4. The account is a place, not a menu item

`/account` is where signing in is repaid: **invitations**, **plan and payment**, and
**settings**, as three sections of one page rather than three routes, because there is not
enough here to justify making someone navigate. `?tab=` deep-links a section so the header
menu can land on one directly.

`GET /api/account` answers it in a single call — profile, billing and counts — and is scoped
entirely to the caller's session. There is no uid parameter, because a route that took one
would be a route for reading someone else's account. `PATCH` changes exactly one field, the
display name: email _is_ the identity and changing it is a re-auth, not a profile edit, and
role is not the account holder's to set.

A name someone typed outranks the one on the provider's token (`displayNameChosen` on the
user document). Google puts a `name` claim on every token it issues, so without that flag
the next session mint would put it back and the settings form would silently undo itself.
The precedence lives in `src/lib/authz/display-name.ts`, away from `server-only`, so it is
unit-testable without Firestore.

The marketing header carries `AccountMenu`, a client island inside the otherwise-static
server header. It renders signed-out on the server — which is also what a visitor with no
JavaScript keeps — and swaps to an avatar menu once the session resolves. Sign-in providers
come from `src/config/auth.config.ts` as a list, so adding X is an entry rather than a
rewrite of the prompt.

### 5. Every guest has their own link, and "seen" means seen

An invitee used to be identified by their email address — the document id was a hash of it.
People know each other by phone at least as often as by inbox, so identity is now the
document itself: an opaque id with an address, a number, or both hanging off it. A guest who
gains a phone number later stops being a second guest, and a host can fix a typo without
losing what was recorded against it.

Each invitee also carries a **link token**, and their invitation is `/i/{code}?g={token}`.
The bare code still works and is still shareable; the token only says _who is holding it_
and grants nothing the code does not. It is what makes "has Priya opened it?" answerable at
all — and it prefills her name on the RSVP, which is worth having on its own.

Status climbs a channel-independent ladder — `queued → sent → delivered → seen → replied`,
with `failed`, `bounced` and `unsubscribed` ending the climb. `canTransition` in
`src/config/comms.config.ts` is the only place a move is allowed, and it **only ever goes
forwards**: delivery receipts arrive late and out of order, and without that rule a carrier
acknowledging a twenty-minute-old message would overwrite "seen" with "delivered".

The current state is denormalised onto the invitee so the guest list is one read; the full
history lives in `invitees/{id}/deliveries/{id}` and is read only when a host opens one
person.

**What "seen" is worth, and why there is no "opened".** A view is recorded only by a beacon
the browser fires _after hydration_. Corporate mail security — Outlook Safe Links,
Proofpoint, Mimecast — fetches every URL in every message it scans, so counting a
server-side request would report that everyone at a company had read their invitation
seconds after it was sent. Requiring JavaScript to have run is the one signal a scanner does
not produce. For the same family of reasons there is deliberately no "Opened" column: Apple
Mail Privacy Protection pre-fetches every image on more than half of consumer email, so an
open pixel fires whether or not a human looked, and a dashboard that says "opened" when it
means "Apple prefetched it" sends hosts chasing people who never saw the invitation.

Hosts can also **send it themselves**. The relay panel hands over each guest's personal link
to paste into whatever thread they already talk to that person in. It costs nothing, needs
no carrier registration, arrives from someone the guest knows — and tracks in full, because
the link is per-guest.

### 6. An event happens in its own timezone, not the reader's

`startsAt` is an instant, and an instant renders differently everywhere. Until the event
carried a zone, `Intl.DateTimeFormat` used the _reader's_ — so a party set for 7pm in
California told a guest in New York it started at 10pm, and email, rendered on a Cloud Run
container running UTC, told everybody 2am the next day.

The host's browser reports its zone at publish and it is stored on the event, validated
against the runtime's own zone database — an unparseable zone reaching `Intl` would break the
invitation for every guest, so it is refused rather than stored.

`formatEventDate` renders in that zone and appends the abbreviation on a rule:

- **`auto`** in the app, where the reader's zone is knowable: the label appears only when it
  differs, because a local guest does not need to be told their own timezone.
- **`always`** in email, link previews and the archive, where the reader is unknown and an
  unlabelled time is a guess.

Events created before this was recorded store null and fall back to the reader's zone, which
is the old behaviour and no worse than it was.

### 7. The venue is looked up through us, never from the browser

Address autocomplete is optional and entirely server-proxied. The obvious build loads
Google's JavaScript and talks to Places from the page with a referrer-restricted key — but a
referrer is a request header, so that key is public the moment it ships and the bill is
public with it. Proxying through `/api/places/*` keeps it in Secret Manager, allows a
per-user rate limit on the one route in the app that costs money per call, and needs no CSP
change and no Google script in the page.

Autocomplete is billed by _session_ — a run of keystrokes plus the details lookup that ends
it — so a session token is generated per search and passed through both calls. Without it
every keystroke is its own charge.

**The field is a text box first and a search second.** Half of real events happen somewhere
Google has never heard of, so whatever the host types is kept whether or not anything is
found; choosing a suggestion only adds coordinates. With no key configured the field is
exactly the plain input it always was, discovered from the route answering 404 rather than
from a build-time flag that could disagree with the server holding the key.

Picking a place gives the event the **venue's own timezone**, resolved offline from the
coordinates rather than through Google's Time Zone API — one fewer API to enable and one
fewer thing to fail while somebody is publishing. It beats the host's browser zone, which is
the fallback: someone in London booking a wedding in Goa means Goa.

### 8. The calendar entry is written in UTC, and built twice from one function

Adding the event to a calendar is the one thing that survives the week between reading an
invitation and attending it, and it arrives with reminders nobody has to pay for.

**Times are UTC, never a `TZID`.** Tagging the local time with the event's zone is only legal
if the file also carries a `VTIMEZONE` component spelling out that zone's daylight-saving
rules; a `TZID` without one is rejected by Outlook and quietly misread elsewhere, and
hand-rolling `VTIMEZONE` means shipping a copy of the zone database that goes stale. A UTC
instant needs none of it, and `startsAt` is already absolute.

The file is produced in two places from one builder in `src/lib/calendar/ics.ts`, which
carries no `server-only` for exactly that reason. In the app the browser builds it from the
event already on the page — no round trip, nothing to authorize. In email it cannot: a
message is HTML in someone else's client, so the link points at `/i/{code}/calendar`, keyed
on the join code like the invitation page beside it and serving the identical bytes.

A link rather than an attachment. Attaching `text/calendar` to a bulk send is a strong spam
signal, Gmail hides the part behind an RSVP widget that mails a reply to an organizer address
we do not run, and an attachment is frozen at the moment it was sent — so a venue change
would leave every guest holding the old one. A link is fetched when it is tapped, which is
when it is correct. For the same reason the file names no `ORGANIZER` at all.

### 9. The invitation link is `/i/{code}`, and it previews

`/e/{id}` is the event and it turns away non-members — which is every recipient of an
invitation. Both the emailed button and the share sheet pointed there, so a shared
invitation was a dead end for its whole audience while promising "one tap, no account, no
app".

The shareable link is now `/i/{code}`: it redeems on arrival and opens the invitation. The
code is the credential everywhere else in the product, and putting it in the path rather
than a query string keeps it out of `Referer` headers and lets the route render a preview.

That preview is the point. Almost nobody arrives from a search result; they arrive because
someone they know pasted a link, and a card carrying the event's name, date and palette
converts a multiple of what a naked URL does. It is generated per event with `next/og`, in
the event's own template colours — which is why `oklchToHex` exists, since Satori cannot
read the `oklch()` the palettes are authored in.

A preview is fetched by an unauthenticated crawler and cached by servers nobody here
controls, so it carries only what the link already grants its holder: title, host, date.
Never the guest list, the wall, or the code itself. And never indexed — a private
invitation in a search result is a failure however good the card looks.

### 10. Answers are public, notes are not

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

### 11. Media never touches the app server

Uploading is a two-step handshake:

1. `POST /api/posts/upload-target` returns a URL the browser uploads to **directly**.
2. `POST /api/posts` finalizes: the server `stat`s the object that actually landed,
   re-checks its real size and content type, promotes it to its final path, and only then
   creates the post document.

Step 2 is why the client's declared byte count does not matter. A client that lies is caught
against the object in the bucket, the pending upload is deleted, and no post is created.

Reading works the same way in reverse: post documents hold object _paths_, never URLs.
Playable URLs are minted at `POST /api/media/[eventId]`, only for members, and they expire.
A link pasted elsewhere stops working, and removing someone from an event actually removes
their access to the media.

The mint is a **batch** for the whole wall, not one request per post. The obvious per-post
shape re-read each post document to find its paths, which cost three Firestore reads per
post — ninety to open a wall of thirty photos, before a single pixel arrived. The client
already holds those post documents from its live listener, so it already knows the paths;
re-reading them told us nothing. What matters is that the paths are _authorised_, and the
prefix is the authorisation: everything under `events/{id}/posts/` belongs to that event,
and a member of that event may already see all of it. One batch costs two reads for any
number of posts.

## Media is resized before it is uploaded

Egress is the largest line on the bill for an app whose whole purpose is photos, and a wall
that serves 4 MB phone originals into a 400px card is paying roughly forty times over for
pixels nobody sees.

So the browser encodes two WebP copies on a canvas before uploading — `preview` at 640px and
`display` at 1800px on the longest edge, both bounded by `imageVariants` in
`limits.config.ts` — and uploads them alongside the original to their own signed targets. The
server re-`stat`s each one at finalize exactly as it does the original: wrong content type or
over its cap and the derivative is dropped, never fatal.

| Copy      | Where it is served                     |
| --------- | -------------------------------------- |
| `preview` | the wall card, via `srcset`            |
| `display` | the lightbox                           |
| original  | the archive download, and nothing else |

Doing it client-side is what keeps this cheap: no transcoding service, no Cloud Function, no
second write path. The cost is that a browser can fail to produce a derivative, so both paths
are nullable and the wall falls back to the original — more expensive, but never a hole where
a photo should be.

Three smaller things fall out of the same concern:

- **Video and audio never auto-download.** A card renders the poster with a play button and
  mounts `<video>` only on first press; audio is `preload="none"`. Ten videos on a wall used
  to mean ten metadata fetches nobody asked for.
- **Signed URLs are memoised** (`lib/storage/signed-url-cache.ts`). A V4 signature differs on
  every mint, so an unmemoised URL is a fresh cache key to the browser and re-downloads bytes
  it already has. Reusing the URL within a window is what makes browser caching work at all.
- **Firestore keeps a persistent local cache** in the browser, so a guest checking back on a
  wall five times during a party resumes their listener instead of re-reading every post
  five times.

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
| `src/lib/calendar/` | the `.ics` builder, shared by the browser and email |
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
