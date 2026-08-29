# Security

The guardrails, what each one actually stops, and where it is enforced.

## Access model

Two independent axes of authority.

**Platform roles** live in Firebase custom claims, granted only by CLI:

| Role      | Adds                                                            |
| --------- | --------------------------------------------------------------- |
| `user`    | create events                                                   |
| `support` | read the admin console, list events and users                   |
| `admin`   | audit log, suspend users, remove any post, end/extend any event |
| `owner`   | feature flags, grant roles, purge storage, delete events        |

**Event roles** live in `events/{id}/members/{uid}`:

| Role        | Adds                                            |
| ----------- | ----------------------------------------------- |
| `viewer`    | see the wall                                    |
| `member`    | post, delete own posts                          |
| `moderator` | delete anyone's post, mute members              |
| `host`      | settings, join code, end/extend, remove members |

Both are cumulative up their own ladder. They do **not** cross: every `admin:*` permission is
listed in `platformOnlyPermissions` and can never be satisfied by an event role, so a host is
powerful inside their event and completely ordinary everywhere else.

One function decides everything: `can(permission, context)` in `src/lib/authz/policy.ts`.
Route handlers and UI both call it, so a button cannot appear for something the API would
refuse. It is pure and dependency-free, and covered by unit tests that assert the refusals as
carefully as the grants.

### Anonymous visitors

A code-only visitor gets `event:view`, `post:view`, `member:list`, `rsvp:respond`, and
nothing else. Replying is included deliberately: someone handed the code was invited, and
making them create an account before they can say "yes, I'll be there" loses replies for no
security benefit. Posting to the wall still needs an account — that is where attribution
starts to matter. A host
may open posting to anyone holding the code, but that path is gated twice: the event setting
_and_ the `allowAnonymousPosting` platform flag, which is off by default. Even then it grants
only `post:create` and `post:deleteOwn` — never moderation.

### Suspended accounts

**The API refuses a suspended account entirely** — reads included. `requireActor()` in
`src/lib/server/api.ts` throws `forbidden` before any handler runs, and every route funnels
through it, so `can()` is never consulted for a suspended caller.

`can()` has its own narrower rule — a suspended actor keeps read permissions and loses every
write and every `admin:*` — and it is checked first there. That is defence in depth for any
future call site that resolves an actor without going through `requireActor()`; it is not the
behaviour anybody observes today. This page previously described the `can()` rule as the
product's behaviour, which was wrong in the direction that matters: it read as more permissive
than the code.

What a suspended account _does_ keep is whatever the Firestore rules allow their token
directly — their own profile, and events they are a member of. That is deliberate. Suspension
is meant to stop somebody posting, not to confiscate their own photographs, and the rules test
in `tests/rules/` asserts both halves: they can still read their profile, and they cannot lift
their own suspension.

Set through `POST /api/admin/users/{uid}/suspend` (`admin:suspendUser`), which refuses to
suspend the caller or anyone at or above their own platform rank, and audits both directions.
Nothing writes `suspendedAt` from a client; the rules deny it to staff too, so a suspension
without an audit entry behind it cannot exist.

## Sessions

- The browser holds an **httpOnly** session cookie. An ID token is never persisted; it lives
  for the single request that exchanges it.
- `__Host-` prefixed, `Secure`, `SameSite=Lax`, `Path=/`, 5 days.
- Verified with `checkRevoked: true` on **every** request, so suspending a user or revoking
  their tokens takes effect on their next request rather than whenever their token expires.
- Role comes from the custom claim. The Firestore `users/{uid}.role` field is a mirror for
  the admin console's list views and is never read for an authorization decision.

## Join codes

The code is the credential for viewing an event, so it is treated as one.

- 8 characters from a 30-character alphabet with `I O U L 0 1` removed — roughly 6.5 × 10¹¹
  codes, and no ambiguity when read aloud.
- Generated with `crypto.randomInt`, never `Math.random`.
- Looked up by `sha256(pepper + code)` used **as the document id**, so redemption is one
  `get`: no query, no enumeration, and a Firestore dump without the pepper yields no working
  codes.
- The plaintext lives only in `events/{id}/private/joinCode`, which no client rule can reach.
  Hosts re-read it through an audited API call.
- Rotation deletes the old hash document, so the previous code stops working immediately.
- Every failure mode of `POST /api/events/join` returns the same message. Distinguishing
  "no such code" from "expired" would make the endpoint an oracle for which codes exist.

Guessing is bounded by the per-IP rate limit, not by the code space alone. `config.test.ts`
asserts that limit stays tight, so loosening it fails a test and has to be argued for.

## RSVP privacy

The most easily-leaked data in the product is a note a guest wrote for the host.

- The **answer and headcount** live on the member document and are readable by every member.
- The **note and custom answer** live in `events/{id}/rsvpNotes/{uid}`, which is
  `allow read, write: if false` — unreadable by the guest who wrote it, the host, and an
  owner alike. Hosts read them through an API call that is authorised and logged.
- The API decides whether to include notes from the **caller's permissions**, never from a
  request parameter, and does not fetch them at all when the answer is no — so an ordinary
  guest's response has no field to leak.
- Party size is re-checked against the host's own `maxPartySize`, because the schema cannot
  know which event a reply is for.
- Tally deltas are computed from the stored member document, never from a client-supplied
  previous value, so replaying a request cannot inflate the headcount.

## Entitlements are not permissions

`can()` answers _who you are_. `entitlementsFor()` answers _what was paid for_. They are
separate systems and neither may stand in for the other — a paywall implemented as a
permission is a paywall an administrator accidentally bypasses, and a permission
implemented as an entitlement is a permission somebody can buy.

Every paid gate is enforced server-side. A disabled button is a courtesy, not a control.

## Email

An invitation product that sends mail is a spam relay unless it is built carefully, and a
blocked sending domain means _nobody's_ invitations arrive — paying customers included. So:

- **There is no endpoint that takes an address and a message.** A host adds addresses to
  their own event and sends _that event's_ invitation. The body is rendered from the event;
  no field in any request reaches a recipient's inbox as free text.
- The address is the document id (hashed), so double-adding is impossible rather than
  merely unlikely.
- An unsubscribe is permanent and survives being re-added. Tokens are HMAC-derived from the
  address and event, never stored — nothing extra to leak, and rotating the pepper
  invalidates every outstanding link.
- The invitation sends once; a reminder has a 20-hour cooldown and never reaches someone
  who has already replied.
- Per-account limits are tighter than the guest caps, so a burst is visible rather than
  merely expensive.
- The invitee list and the development outbox are both server-only in Firestore: a list of
  everyone's email addresses is exactly what must not be readable by everyone holding the
  code.

## Payments

- The **webhook is the only thing that grants anything.** A checkout success redirect is a
  URL anyone can visit; only a verified webhook is proof money changed hands.
- Stripe's signature scheme is verified directly, including the timestamp window — without
  it, a captured signature could be replayed forever.
- Every grant is idempotent, and an older subscription period never overwrites a newer one,
  because webhooks are delivered at least once and occasionally out of order.
- A per-event unlock only applies if the payer is that event's host.
- Billing state lives on the user document, which clients cannot write — asserted in the
  rules tests.
- The mock gateway refuses to run when `NODE_ENV=production`, behind `BILLING_DRIVER`. A
  checkout that takes no money must never be reachable in production.

## The account endpoint

`GET /api/account` is scoped entirely to the caller's session. There is no uid parameter,
because a route that accepted one would be a route for reading someone else's account —
their email, their plan, and the size of their guest lists.

`PATCH` accepts exactly one field. Email is the identity the session is minted from, so
changing it is a re-auth rather than a profile edit, and role is set by CLI and custom
claim, never by a request body. The write is rate-limited and audit-logged (`user.renamed`)
like every other mutation.

## Guest link tokens and the view beacon

Each invitee carries a 128-bit random token, and their invitation link is
`/i/{code}?g={token}`. Three properties matter:

- **It grants nothing.** The code is still the credential; the token only names who is
  holding it. A stolen token buys the ability to mark its own owner as having looked.
- **It is never readable by a client.** Firestore rules deny the whole `invitees/` tree
  including the `deliveries/` subcollection, via a recursive wildcard — a rule written for
  the parent alone would have left the children open. A readable token would let anyone with
  the code mark other guests as having seen the invitation, or enumerate the guest list a
  person at a time.
- **It is stored, not derived.** Unlike the unsubscribe token, this one has to be revocable
  per guest: a link that leaks into a group chat should be replaceable without invalidating
  everyone else's, which a shared pepper cannot do.

`POST /api/events/{id}/invites/view` is deliberately unauthenticated — the visitor is a
guest who may have no session yet, and the token is the credential. It is rate-limited per
IP so tokens cannot be brute-forced, and **it never says whether a token was real**: an
endpoint that answered "no such guest" would let anyone holding an event id test tokens, or
confirm that a particular person is on a guest list.

## Rate limits

Fixed-window counters, declared in `src/config/limits.config.ts`:

| Action                     | Limit        |
| -------------------------- | ------------ |
| join attempt (per IP)      | 10 / 10 min  |
| join attempt (per account) | 20 / hour    |
| create event               | 5 / hour     |
| create post                | 30 / 10 min  |
| upload target              | 40 / 10 min  |
| media URL                  | 300 / 10 min |
| session exchange (per IP)  | 60 / 10 min  |
| rename account             | 20 / hour    |
| invitation view beacon     | 120 / 10 min |

Per-IP limits are what actually block code guessing; per-account limits stop one identity
farming attempts across addresses. Spent buckets expire via a Firestore TTL policy.

## Uploads

Layered, because each layer catches what the one before it cannot:

1. **Client** — type, size and duration checked before a byte is sent. Courtesy only.
2. **Upload target** — Zod validates the declared facts; the GCS driver binds the signature
   to `x-goog-content-length-range`, so an oversized body is rejected by GCS itself.
3. **Finalize** — the server `stat`s the object that actually landed and re-checks its real
   size and stored content type. **This is the check that matters.** A client that lies is
   caught here, the pending object is deleted, and no post is created.

Uploads land under `events/{id}/pending/` and are promoted only on success. Abandoned
uploads are swept by the cleanup job whether or not the event has expired.

Content types are validated against a per-kind allowlist. The same MIME type can never be
claimed by two kinds — asserted in `config.test.ts`.

## HTTP headers

Set in `src/proxy.ts` on every response:

- **CSP** with a per-request nonce and `strict-dynamic` — no `'unsafe-inline'` for scripts,
  so an injected `<script>` cannot execute even if it reaches the DOM.
- `frame-ancestors 'none'` and `X-Frame-Options: DENY` — no clickjacking a host's controls.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- `X-Content-Type-Options: nosniff` — uploaded media cannot be re-interpreted as a script.
- `Referrer-Policy: strict-origin-when-cross-origin` — event ids do not leak to third parties.
- `Permissions-Policy` denying everything except camera, microphone and autoplay, which the
  app genuinely needs.
- HSTS with preload, production only.

`style-src` still allows `'unsafe-inline'`: Next injects its own `<style>` tags and offers no
nonce hook for them yet. This is a known, bounded gap.

## Input handling

Every request body, query parameter and environment variable is parsed by a Zod schema before
use. Bounds come from `src/config/*`, so client and server cannot drift apart.

Text fields strip control, zero-width and bidi-override characters — the ones that render
invisibly or reverse the display order of what follows.

Media URL requests carry object **paths**, not URLs, and each is matched against the exact
shape the storage layer produces — `events/{eventId}/posts/{postId}/{file}`, no nesting and
no `..`. The route then checks the prefix against the event the caller is a member of, which
is what stops a member of one event signing a URL for another event's bytes.

## Audit log

Every privileged action writes to `auditLogs`: who, what, which target, which event, the IP,
the user agent, and when. Including the failures — `event.joinFailed` makes a burst of code
guessing visible.

The log is unreadable and unwritable by every client, owners included; the phase-2 console
will read it through an admin API so that reading it is itself an auditable action. Audit
writes never throw: a logging failure must not take a user's action down with it.

## What the rules actually stop

`tests/rules/firestore.rules.test.ts` covers each of these against the emulator. Every case
describes something someone could attempt with nothing but the Firebase SDK and a session:

- reading another event's posts while holding a valid membership in one
- reading a post that was moderated away
- reading a private RSVP note — as another guest, as its author, as the host, as an owner
- enumerating the `rsvpNotes` collection
- writing your own RSVP directly, or answering on someone else's behalf
- reading the join code — as the host, or as an owner
- enumerating `joinCodes` to harvest live events
- writing a post document directly, or editing one to impersonate another author
- creating your own membership document to join without a code
- promoting yourself to `host`, or writing `role: 'owner'` onto your user document
- reading the invitee list — as a guest, as the host who built it, as an owner
- reading or writing the development mail outbox
- granting yourself a paid plan by writing `billing` onto your own user document
- granting an event a paid plan by writing `plan` onto it
- reading or tampering with the audit log
- reading rate-limit buckets to see how much budget is left

Storage rules deny everything outright: browsers never touch objects under their own
identity, only through server-issued URLs.

## Secrets

`.env.example` carries placeholders; `.env.local` is gitignored, as are `service-account.json`
and any `*.pem` / `*.key`. Production reads secrets from Secret Manager. `JOIN_CODE_PEPPER`
and `CLEANUP_TASK_SECRET` are validated for minimum length at boot — the app refuses to start
with a weak one.

## Known gaps

Tracked, not forgotten:

- **No content scanning.** Uploaded media is not inspected. Phase 3 adds Cloud Vision
  SafeSearch behind `features.safetyScan`.
- **No reporting flow.** Members cannot flag a post yet; only hosts and moderators can remove.
- **`style-src 'unsafe-inline'`**, as above.
- **Emulator driver has no access control.** Deliberate and dev-only; `STORAGE_DRIVER=emulator`
  must never point at anything but a local emulator.
- **Rate limiting is per-instance-agnostic but Firestore-backed**, so it is correct but costs
  a write per check.
- **Three `admin:*` permissions are enforced and deliberately unreachable** —
  `manageFeatureFlags`, `grantRole`, `purgeStorage`. This is a decision, not an oversight, and
  `tests/unit/admin-console.test.ts` fails if one quietly grows a route. Reasons in
  [DECISIONS.md](./DECISIONS.md). The practical consequence: **there is no way to grant the
  `support` or `admin` platform roles.** In effect the ladder is `user` and `owner`, the latter
  through `OWNER_EMAILS`. Fine for a single operator; it needs solving before anyone is hired
  to handle tickets.
- **A platform admin can remove any post but cannot reach one directly.** The console finds the
  event and the wall does the removal, which is two steps. Adequate for launch volume;
  cross-event content search is the phase-3 item that fixes it.
- **`features.presentationMode` is `true` with nothing behind it.** Not a security gap, but the
  same class of defect as the one above and worth the same suspicion: the flag is the entire
  feature.

## Reporting a vulnerability

Open a private security advisory on the repository rather than a public issue.
