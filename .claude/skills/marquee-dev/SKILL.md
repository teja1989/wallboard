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
confirm a backend change is genuinely working — 47 assertions covering the access model,
uploads, moderation, code rotation, and security headers, in a couple of seconds.

Signing in during development: request the link in the app, then open
<http://localhost:4000/auth> and click the link the emulator shows.

## Where to make a change

| Task                               | Place                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------ |
| A limit, quota, window, or cap     | `src/config/limits.config.ts` — never inline                             |
| A feature you are not shipping yet | `src/config/features.config.ts`, default `false`                         |
| A permission                       | `src/config/roles.config.ts`, then a test in `tests/unit/policy.test.ts` |
| A colour, radius, or spring        | `src/config/branding.config.ts` + `src/app/globals.css`                  |
| Logic two routes both need         | `src/lib/services/`                                                      |
| A new API route                    | `src/app/api/**/route.ts`, wrapped in `route()`                          |

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

While `features.billing` is off, `effectivePlanId()` returns `previewPlanId` for every
event, so nothing is actually gated. That is deliberate — see the note in
`entitlements.ts` — but it means **your gate will not appear to work in development**
unless you stub `isEnabled`, the way `tests/unit/entitlements.test.ts` does.

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
  the previous build — twice here, once producing a "failure" in code that was already
  correct. Kill the old server and `grep EADDRINUSE` the log before believing a result.
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
