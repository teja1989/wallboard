---
name: marquee-dev
description: Run, seed, and test the Marquee app locally against the Firebase emulators. Use when starting work on this repo, when a change needs verifying end to end, when the emulators or dev server misbehave, or when adding a config value, an API route, an occasion, a plan entitlement, or a media kind.
---

# Working on Marquee

Invitations, RSVPs and a live guest wall. Next.js 16 on Cloud Run, Firestore, Cloud
Storage, Firebase Auth. Everything runs locally against the emulators with **no GCP
account**.

## Booting it

Two long-lived processes, in separate terminals:

```bash
npm run emulators   # Auth :9099, Firestore :8080, Storage :9199, UI :4000
npm run dev         # http://localhost:3000
npm run seed        # optional: a demo event with posts
```

First run needs `cp .env.example .env.local` plus two generated secrets — see
`docs/SETUP.md`. The app refuses to start without them, on purpose.

Use `http://localhost:3000`, not a LAN IP: the email-link flow keeps the pending address in
`localStorage`, which is per-origin.

## Verifying a change

Cheapest first:

```bash
npm run typecheck
npm run lint
npm test              # unit — no emulator needed, ~1s
npm run test:rules    # Firestore rules — starts its own emulator
npm run smoke         # whole API end to end — needs dev + emulators up
npm run test:e2e      # Playwright through the real UI
```

`test:rules` starts its **own** emulator, so stop `npm run emulators` first or they fight
over port 8080.

`smoke` and `test:e2e` expect both processes already running. `smoke` is the fastest way to
confirm a backend change is genuinely working — 251 assertions covering the access model,
uploads, moderation, code rotation, the admin console and security headers, in a few seconds.

Roughly where the counts should sit, so a silent drop is noticeable: **377 unit · 67 rules ·
251 smoke · 82 e2e**.

**Run the last two against a production build, not `npm run dev`.** Some assertions — the CSP,
cache headers, static rendering — only tell the truth against `npm run build && npm start`.
`scripts/smoke.mjs` checks the build id it is talking to and refuses a stale server, because an
old `next start` holding port 3000 while the new one dies on `EADDRINUSE` otherwise looks
exactly like a code failure.

The owner-only paths in `smoke` and `e2e` need the address the **server** calls an owner, and
both processes read their own environment. In CI one `env:` block feeds both. Locally:

```bash
OWNER_EMAILS=$(grep OWNER_EMAILS .env.local | cut -d= -f2) npm run smoke
```

They **skip** rather than guess when it is unset: an assertion that signed up the wrong address
would "pass" by being refused, which is the worst kind of green.

Signing in during development: request the link in the app, then open
<http://localhost:4000/auth> and click the link the emulator shows.

## Where to make a change

| Task                               | Place                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A limit, quota, window, or cap     | `src/config/limits.config.ts` — never inline                                                                  |
| A feature you are not shipping yet | `src/config/features.config.ts`, default `false`                                                              |
| A permission                       | `src/config/roles.config.ts`, then a test in `tests/unit/policy.test.ts`                                      |
| A colour, radius, or spring        | `src/config/branding.config.ts` + `src/app/globals.css`                                                       |
| Logic two routes both need         | `src/lib/services/`                                                                                           |
| A new API route                    | `src/app/api/**/route.ts`, wrapped in `route()`                                                               |
| A string a guest or host reads     | the relevant `*.config.ts` — never inline in a component                                                      |
| An audit action                    | `src/config/audit.config.ts` (not `lib/audit.ts` — that file is `server-only` and the console needs the list) |
| An operator screen                 | `adminSections` in `src/config/admin.config.ts`, then the page and route                                      |
| A funnel counter                   | `FUNNEL_EVENTS` in `src/config/analytics.config.ts`, and a ratio if it decides something                      |
| A composite index                  | **both** `firestore.indexes.json` and `infra/terraform/firestore.tf`                                          |

### Adding an API route

Non-negotiable shape — the plumbing exists so no handler can skip a step:

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (request) => {
  const actor = await requireActor();          // or requireIdentifiedActor()
  const input = await parseBody(request, someSchema);
  const event = await requireLiveEvent(input.eventId);
  const eventRole = await eventRoleFor(event.id, actor.uid);

  if (!can('some:permission', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError('forbidden', 'A sentence a person would understand.');
  }
  await limitByUser('someLimit', actor.uid);

  const result = await doTheThing();
  await recordAudit(actor, { ... }, requestContext(request));
  return ok({ result });
});
```

`route()` maps every thrown error to a response, so an unmapped exception cannot leak a
stack trace. Never `try/catch` around the whole handler.

### Adding something to a paid plan

Two axes, kept apart on purpose. **Permissions** (`can()`) answer _who you are_;
**entitlements** (`entitlementsFor()`) answer _what you have paid for_. Never make one do
the other's job — a paywall implemented as a permission is a paywall an admin accidentally
bypasses.

1. Add the field to `Entitlements` in `plans.config.ts` and set it on all three plans.
2. Gate the server path with `entitlementsFor(event.plan)`.
3. Gate the UI with the same call, and _show_ the locked thing rather than hiding it.
4. `tests/unit/config.test.ts` already asserts no plan loses an entitlement as price rises.

While `features.billing` is off, new events are **created on** `previewPlanId`, so nothing
is gated in practice. Note where that happens: `planForNewEvent()` grants it once and writes
it to the event. `effectivePlanId()` just reads the stamp — it does not widen anything, and
it must not start to. So **your gate will not appear to work in development**, because the
event genuinely is on the top plan; test it by passing a lower plan directly, the way
`tests/unit/entitlements.test.ts` does, rather than by stubbing a flag.

### Adding an occasion

`occasions.config.ts` carries the wording as well as the defaults: RSVP prompt, wall
prompt, title placeholder, whether to ask for a dress code. The `somber` flag exists so a
memorial never inherits celebratory copy. Add all of it, not just the label.

### Adding a media kind

1. `mediaRules` in `limits.config.ts` — MIME allowlist, size, duration
2. `EXTENSION_BY_MIME` in `src/lib/storage/index.ts`
3. `probeFile` in `src/lib/client/media-probe.ts` — how to measure it
4. `MediaBlock` in `src/components/wall/post-card.tsx` — how to play it
5. `tests/unit/config.test.ts` already asserts no two kinds claim the same MIME type

### Touching anything that costs money

Egress and Firestore reads are the two lines that grow with usage, and both have already
been worked over. Before adding a media path or a fetch, check you are not undoing it:

- **Render the derivative, never the original.** `preview` (640px) on a card, `display`
  (1800px) in the lightbox; the original exists for the archive. `srcSetFor()` in
  `post-card.tsx` is how a card picks. Sizes live in `imageVariants` in `limits.config.ts`.
- **Both derivative paths are nullable.** A browser can fail to encode one. Every consumer
  falls back to `media.url`, and none of them may assume a derivative exists.
- **Mint media URLs in one batch.** `POST /api/media/[eventId]` takes the paths the client
  already holds from its listener and authorises them by prefix. Do not add a route that
  re-reads posts to find paths the client just gave you.
- **Do not add a Firestore read a listener already covers.** The wall's post documents are
  live in the browser; anything derived from them belongs in a `useMemo`, not a fetch.
- **One document, one read.** If a handler needs two fields off `members/{uid}`, call
  `eventMembershipFor()` once — `eventRoleFor()` is a thin wrapper over it.
- **Never auto-download video or audio.** Poster plus a play button; `<video>` mounts on
  press. `preload="none"` on audio.
- **Sign through `signedUrl()`**, not `storage().createReadUrl()`, for anything a browser
  fetches repeatedly. A fresh V4 signature is a fresh cache key, so an unmemoised URL
  re-downloads bytes the browser already has.

### Adding a config value

Put it in the right `*.config.ts`, export it, and import it on **both** sides. The whole
point is that the client's pre-flight check and the server's enforcement read the same
number. A literal in a component that "matches" a config value is a bug waiting for someone
to change one of them.

## Things that will bite you

- **`next dev` and `next start` do not have the same CSP, and e2e only proves the one it
  ran against.** CI runs Playwright against a _production build_ pointed at the emulators.
  Passing locally against `npm run dev` proves nothing about that: the dev server relaxes
  the policy. Before trusting a green e2e run, either push and read CI, or reproduce it —
  `next build && next start` with the emulators up. This hid a broken sign-in for the whole
  first month of the project.
- **Emulator behaviour keys on `NEXT_PUBLIC_USE_EMULATORS`, never on `NODE_ENV`.** They are
  independent: CI is a production build talking to emulators. Anything gated on the wrong
  one breaks in exactly that configuration and nowhere else.
- **Do not set `NODE_ENV` in `.env.local`.** Next sets it. Pinning it to `development` puts a
  development React build into a production bundle and the build fails at `/_global-error`.
- **`server-only` throws in CLI scripts.** That is why `seed`, `grant`, and `cleanup` run with
  `NODE_OPTIONS=--conditions=react-server`.
- **`src/lib/codes.ts` imports `node:crypto`** and must never reach the browser. Client code
  imports `src/lib/codes-format.ts` instead.
- **Security headers live in `src/proxy.ts`** (Next 16's name for middleware), not
  `next.config.ts`, because the CSP needs a per-request nonce.
- **Effects that call `setState` synchronously fail lint.** `react-hooks/set-state-in-effect`
  is on. Put the work in an async callback, or derive during render.
- **Opening the app on an unexpected origin gives 403 on `/_next/static/*`.** Add it to
  `allowedDevOrigins` in `next.config.ts`.
- **A one-time code is one-time.** Effects that consume one need a `useRef` guard, or Strict
  Mode's double invocation burns it. This already bit `/auth/finish` once — and note the
  guard must not be combined with a cancellation flag, or the first run's success is
  discarded on unmount and the visitor is stranded.
- **Firestore singletons belong on `globalThis`.** Module scope resets on hot reload while
  the Firebase app does not, and `settings()` throws on a second call. See
  `src/lib/firebase/admin.ts`.
- **`initializeFirestore` must run before the first `getFirestore`.** The browser cache is
  configured in `src/lib/firebase/client.ts`; call `clientDb()` rather than reaching for
  `getFirestore` yourself, or the cache silently does not apply.
- **Canvas encoding is best-effort.** `toBlob` can return null, WebP support is not
  universal, and a huge image can exceed the variant's byte cap. `media-probe.ts` returns
  whatever succeeded and the upload claims only that.
- **The emulator does not enforce composite indexes. Production does.** Any query combining
  an equality with a range, or ordering by a field it also filters on, needs an entry in
  _both_ `firestore.indexes.json` and `infra/terraform/firestore.tf` — and no test will ever
  tell you, because every suite here runs against the emulator, which happily answers a
  query no index could serve. This shipped a 500 on event creation that passed 36 e2e tests.
  After adding or changing a `.where()` chain, list the queries and check them off by hand.
- **The range field goes last in the index.** `hostUid == && status == && expiresAt >` needs
  `(hostUid, status, expiresAt)`. An index of `(hostUid, status, createdAt)` looks close
  enough to be mistaken for it and serves nothing.
- **`google_identity_platform_config` turns off what it does not list.** Describing sign-in
  methods there is a complete declaration, not a set of additions — omitting `anonymous`
  disabled it, and with it every guest joining by code.
- **The create gate asks first, but must always keep its escape.** `/create` asks for an
  account up front — that is the account that comes back — but the card carries "Have a look
  around first", remembered for the session, and publish asks again. Removing the escape
  turns the gate back into the wall every prospective host hits before seeing anything.
  `event-draft.ts` is what makes the ask survive the email-link round trip. Check the gate
  behind a `loading` guard, or the form flashes before the card replaces it.
- **Never share `/e/{id}`.** It turns away non-members, which is everyone an invitation is
  sent to. The shareable link is `/i/{code}` (`invitationPath()`), which redeems on arrival
  and renders a preview card. This was wrong in both the email and the share sheet.
- **`await signInAsGuest()` now means the cookie exists.** It used to resolve after
  `signInAnonymously` but before the session was minted, so anything that signed in and
  immediately called an API raced itself into a 401 — invisible wherever a human pauses to
  type, reliable on any page that acts on arrival. Do not reintroduce a boolean guard in
  `exchangeSession`: it must hand back the in-flight promise so callers await the real
  answer.
- **The e2e helpers type the sign-in card's real button labels.** `signIn` and
  `signInFromHere` click "Continue with email" and "Email me a link". Rewording
  `sign-in-prompt.tsx` therefore breaks every signed-in test in the suite at once, in a way
  that reads as an auth bug rather than a copy change. Grep `tests/e2e/helpers.ts` after
  touching that component.
- **`next start` on a taken port fails into the log, not the terminal.** It backgrounds
  cleanly, the old process keeps answering on :3000, and the whole suite then runs against
  the previous build — three times here now, twice producing a confident "failure" in code
  that was already correct. Checking that _something_ answers on :3000 does not help: the
  stale server answers.

  `npm run smoke` now refuses to start unless the server is serving `.next/BUILD_ID`, so it
  says so instead of inventing failures. Nothing guards `npm run test:e2e`, so before an e2e
  run: `kill $(ps -eo pid,args | grep '[n]ext-server' | awk '{print $1}')`, rebuild, restart.
  A `pkill -f "next start"` matches the shell running it and kills your own session.

- **Entitlements are stamped on the event, never derived from global state at read time.**
  `effectivePlanId()` returns the plan written on the event and nothing else; the grants —
  the host's subscription, preview pricing while `features.billing` is off, and any promo —
  are all resolved once by `planForNewEvent()` and written down. It used to apply preview
  pricing at read time, which meant flipping the billing flag would have downgraded every
  live event and revoked its archive mid-event.

  So: if you find yourself widening what an event may do based on something true _today_,
  stop. Change what the next event is granted instead. The create form asks
  `grantedPlanForNewEvent()` for the same reason — a form that greys out a theme the server
  would accept is a UI disagreeing with its own server. And run `npm run backfill:plans`
  before turning billing on.

- **Never add an `overrides` entry to quiet `npm audit` without checking who declares that
  package.** An override is an explicit instruction, so npm applies it and prints nothing —
  `npm ls` marks the result "overridden", never "invalid". A `"gaxios": "^7.1.4"` override
  added in the first commit forced gaxios 7 onto `gcp-metadata@6`, which reads
  `res.headers['metadata-flavor']`; in gaxios 6 that is a plain object and in v7 it is a
  WHATWG `Headers`, so the read returned `undefined` and every credential fetch died with
  "incorrect Metadata-Flavor header ... got no header". That took out photo upload, the
  wall's signed image URLs, the archive and delete — all of Cloud Storage — in production
  only. Nothing local sees it: the emulator storage driver needs no credentials, so the
  emulators, the smoke suite and CI are all green while production has no file storage at all.

  `tests/unit/dependencies.test.ts` now fails on any package resolving a dependency outside
  its declared range. If it goes red, read the names — the fix is almost always deleting an
  `overrides` entry, not adding one. The advisory those four overrides silenced was a `uuid`
  bounds check in v3/v5/v6 when `buf` is passed; nothing here calls uuid at all.

- **A provider's `name` claim will overwrite a chosen display name.** Google sends one on
  every token, so `displayNameChosen` on the user document is what stops the next session
  mint from undoing a rename. `src/lib/authz/display-name.ts` holds the precedence; keep it
  free of `server-only` so it stays unit-testable.
- **`server-only` in a module makes it untestable by Vitest.** Pure logic worth testing goes
  in its own module without that import, and the server module imports it.
- **A view is recorded by a beacon, never by a page render.** Outlook Safe Links, Proofpoint
  and Mimecast fetch every URL in every message they scan. Anything that counts a
  server-side request as "seen" will report a whole company as having read their invitations
  seconds after they were sent. `recordView` is only ever reached from the client beacon in
  `invitation-redeemer.tsx`, and the smoke suite asserts a scanner-agent fetch does not move
  the status. Do not "simplify" this by recording the view in the page.
- **Do not add an email open pixel.** Apple Mail Privacy Protection pre-fetches every image
  on more than half of consumer email, so it fires whether or not a human looked. The
  vocabulary is Delivered / Seen / Replied, and `seen` means they loaded the invitation.
- **Delivery status only moves forwards.** `canTransition` in `comms.config.ts` is the only
  gate. Receipts arrive late and out of order, and writing status directly would overwrite
  "seen" with a twenty-minute-old "delivered".
- **The invitee id is opaque and must stay that way.** It was a hash of the email address,
  which made a guest with an address and a number into two guests and made a typo
  uncorrectable. `legacyInviteeId` exists only for unsubscribe tombstones.
- **Phone numbers are normalised to E.164 server-side or refused.** A number stored as typed
  cannot be dialled, deduplicated, or checked against an opt-out list — and the guest
  silently never hears anything. The client parser deliberately does _not_ dedupe format
  variants: guessing without real phone metadata risks merging two different numbers and
  dropping a guest, so the server collapses them and reports what it collapsed.
- **Never format an event time without its zone.** `formatEventDate(startsAt)` alone renders
  in whoever is looking — which on a Cloud Run container is UTC, so every emailed invitation
  carried the wrong hour. Pass `event.timeZone`, and pass `'always'` anywhere the reader is
  unknown (email, the link preview, the archive).
- **The sending domain must be one we own and have verified.** It read `marquee.app` for
  months, which is not ours; every real send would have failed SPF. It is `marqueersvp.com`
  now, and `EMAIL_FROM_ADDRESS` overrides it per deploy. `EMAIL_DRIVER` still defaults to
  `outbox`, so a deploy without keys writes mail to Firestore rather than failing to boot.
- **`npm run walkthrough` is the fastest way to see a whole event.** It creates one, invites,
  sends, opens it as a guest, and prints every link instead of tearing down. Use it before
  reaching for the UI to reproduce something.
- **The Places key is server-side, always.** `/api/places/*` proxies every call. A
  referrer-restricted browser key is public the moment it ships, because a referrer is a
  header anyone can type — and this is the one route in the app that costs money per call.
- **Autocomplete is billed per session, not per request.** Generate a session token, pass it
  to every suggestion call _and_ the details lookup that ends it. Dropping it is roughly a
  tenfold cost increase on identical typing.
- **A chosen place sets the event's timezone.** Resolved offline from the coordinates in
  `src/lib/geo.ts`, falling back to the host's browser. `timeZoneAt` must never throw — a
  thrown zone stops a host publishing at all.
- **Private RSVP data lives in `rsvpNotes/`, not on the member document.** Firestore rules
  cannot restrict a single field, so a note addressed to the host would otherwise be
  readable by every other guest.

## Conventions

- TypeScript strict, including `noUncheckedIndexedAccess`. Index access is `T | undefined`.
- Comments explain _why_, not what. If a line needs a comment to say what it does, rename
  something instead.
- Error messages are sentences a guest at a party could understand, not error codes.
- New behaviour comes with a test. Permissions get a test that asserts the refusal too, and
  entitlements get one for both the gated and the ungated case.
- Copy is product. A string a guest reads belongs in `branding.config.ts` or
  `occasions.config.ts`, not inline in a component.

- **`.partial()` does not undo `.default()`, and this has now caused four bugs.** A field
  carrying a default is already optional, so a "partial" update schema parses an absent key
  into its default — indistinguishable, at the handler, from a value the caller sent. Every
  handler here applies a patch by writing what it parsed, so the default silently overwrites.

  It wiped a milestone's budget when a box was ticked; it reset `maxPartySize` and blanked a
  host's custom question when the reminder switch was flipped; and `location` and `timeZone`
  both ended `.nullable().default(null)`, so _every_ settings edit would have erased the venue
  and the event's timezone — the field that makes each guest see the right hour.

  So: **an update schema has no defaults anywhere.** Where creation genuinely wants them, define
  the field once and build two schemas from it — `x.default(…)` for create, `x.optional()` for
  patch — rather than `.partial()`ing the create schema. `tests/unit/reminders.test.ts` asserts
  the shape (`Object.keys(parsed)`) rather than a symptom, which is what catches it; asserting
  the symptom needs a real document and only finds the instance you thought of.

- **A route can accept far more than it applies, and nothing will say so.** `/settings`
  validated a date, a venue, a dress code, who the invitation is from and every RSVP setting,
  then mapped five fields and dropped the rest — so a host who typed the wrong date could not
  fix it, and the request came back 200. If a schema names a field, grep the handler for it.

- **A permission with no route is a promise nobody kept.** Five `admin:*` permissions sat in
  `roles.config.ts` being enforced by `can()` and reachable from nowhere. The worst was
  `admin:suspendUser`: `requireActor()` refuses a suspended account on every write, `can()` has
  a rule for it, `firestore.rules` protects the field — and nothing in the product could set
  it. Every layer of a feature existed except the one that triggers it, and each layer looked
  complete on its own.

  `tests/unit/admin-console.test.ts` now holds the whole `admin:*` set against the console's
  section config and fails on anything reachable from nowhere that is not _named_ as
  deliberately parked. Adding a permission means wiring it or explaining it.

- **`docs/` can be more permissive than the code, and that reads as a promise.**
  `SECURITY.md` said "a suspended account can still read", which is what `can()` says — but
  `requireActor()` throws for a suspended caller several layers earlier, so `can()` is never
  reached and every API call fails, reads included. The doc described a rule as behaviour.
  When they disagree, find out which one runs before you decide which one is wrong.

- **Firestore lists phantom parents, and `.data()` on one is `undefined`.** A deleted event
  whose `funnel` subcollection still exists keeps appearing in a query over `events` as a
  document that does not exist. Casting `snapshot.data()` to a domain type and reading a field
  off it threw, and took the whole console screen down with a 500 the first time somebody
  deleted an event. Any code that reads a _collection_ rather than a known document must skip
  a snapshot with no data and coerce the rest — a console is the tool you reach for when the
  data is wrong, so it has to survive the data being wrong.

- **A strict-mode violation in Playwright is not retried.** `expect(locator).toBeVisible()` on
  a locator matching many elements throws immediately instead of waiting, so asserting on a
  control inside a list that has not finished narrowing turns "not yet" into a hard failure.
  Wait for the list with `toHaveCount(n)`, which does retry, and then reach inside it. This
  passes by hand and fails under a loaded suite, which is the signature.

- **Do not roll homebrewed encoders for external physical or binary standards (barcodes, crypto, codecs).**
  Rolling an in-tree ISO/IEC 18004 QR encoder to avoid packages caused polynomial division and format bit
  inversions that passed self-asserting unit tests while failing real phone cameras completely.
  Furthermore, SVG viewBox translations clipped finder patterns because the test never tested the visual
  or optical contract. Where an external interchange standard is required, use a battle-tested,
  zero-subdependency package (like `qrcode-generator`) that passes `dependencies.test.ts`, ensure standard
  quiet-zone margins, and test against independent decoder contracts.
