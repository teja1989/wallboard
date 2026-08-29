# Contributing

## Setup

See [docs/SETUP.md](docs/SETUP.md). Short version: `npm install`, copy `.env.example` to
`.env.local` with two generated secrets, then `npm run emulators` and `npm run dev`.

## Before you push

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
```

For anything touching the API, rules, or auth, also:

```bash
npm run test:rules
npm run smoke          # needs emulators + a running server
```

Run `smoke` and `test:e2e` against a **production build** (`npm run build && npm start`),
not the dev server: the CSP, cache headers and static rendering only tell the truth there.
`scripts/smoke.mjs` refuses a server serving a different build than the one on disk, because a
stale `next start` holding port 3000 otherwise looks exactly like a code failure.

The owner-only assertions skip unless the process shares the server's `OWNER_EMAILS`:

```bash
OWNER_EMAILS=$(grep OWNER_EMAILS .env.local | cut -d= -f2) npm run smoke
```

CI runs all of it plus Playwright, with one `env:` block feeding both sides.

## The rules that matter

### Config first

Every limit, quota, window, colour, and flag lives in `src/config/*`. A literal in a
component or a route handler is a bug — not because it looks bad, but because the client's
pre-flight check and the server's enforcement then read different numbers, and the drift only
shows up as a confusing rejection much later.

If you catch yourself writing `if (file.size > 15 * 1024 * 1024)`, stop and import
`mediaRules`.

### Entitlements are not permissions

`can()` answers _who you are_. `entitlementsFor()` answers _what was paid for_. Keep them
apart. A paywall implemented as a permission is one an admin bypasses by accident; a
permission implemented as an entitlement is one somebody can buy.

Every paid gate is enforced on the server. A disabled button is a courtesy.

### Permissions go through `can()`

`src/lib/authz/policy.ts` is the only place a permission decision is made. No `role === 'host'`
anywhere else. The UI calls the same function as the API, so a button cannot promise something
the API refuses.

New permission → add it to `PERMISSIONS`, put it in the right role table, and write a test
that asserts the **refusal** as well as the grant.

### Clients never write to Firestore

Every mutation goes through a route handler. Rules deny all client writes and there is no
exception, including for owners. See `.claude/skills/marquee-security/SKILL.md` for the
route-handler shape.

### Nothing is enforced that cannot be reached

A permission, feature flag or plan claim with no implementation behind it is a bug, not a
placeholder. Five `admin:*` permissions were declared and checked by `can()` with no route
anywhere — including the one that suspends an abusive account, so every write in the product
was gated on a field nothing could set.

Each layer looked finished on its own, which is why this needs a rule rather than care. Either
wire it, or say plainly in config that it is not wired — and where a test can hold the set of
declared things against the set of reachable ones, write that test.

### When a doc and the code disagree, the code wins

Fix the doc in the same commit. `docs/SECURITY.md` described a permission model more permissive
than what runs, and `docs/ROADMAP.md` listed shipped features as pending — both read as
promises. If you change a guarantee, the doc stating it is part of the change.

### Comments explain why

Not what. If a line needs a comment to say what it does, the names are wrong. Comments that
earn their place: a non-obvious ordering, a workaround with a reason, a trade-off someone
would otherwise "fix".

### Copy is product

A string a guest reads lives in `branding.config.ts` or `occasions.config.ts`, not inline in
a component. The occasion decides the wording — that is how a memorial avoids inheriting
birthday copy. See [docs/BRAND.md](docs/BRAND.md) for voice.

### Error messages are for people

"That code did not work. Check it and try again." — not `INVALID_JOIN_CODE`. Guests at a
party read these.

Where an error would reveal something, deliberately say less: every failure mode of the join
endpoint returns the same message so it cannot be used as an oracle.

## Style

- TypeScript strict, `noUncheckedIndexedAccess` included — index access is `T | undefined`
- Prettier decides formatting; do not argue with it
- `type` imports are inlined (`import { type Foo }`), enforced by lint
- Components: named exports, props interface above the component
- Tailwind classes via `cn()`; design tokens as CSS custom properties, never hard-coded hex

## Tests

| Kind  | Where               | When                                               |
| ----- | ------------------- | -------------------------------------------------- |
| Unit  | `tests/unit/`       | pure logic — policy, codes, validation, formatting |
| Rules | `tests/rules/`      | any change to `firestore.rules` or `storage.rules` |
| Smoke | `scripts/smoke.mjs` | API behaviour, including the refusals              |
| E2E   | `tests/e2e/`        | anything a user does through the UI                |

Security tests assert what is **denied**. A test suite that only proves the happy path proves
very little about an access-control boundary.

## Commits and PRs

Present tense, describing the change and why it was needed. If you left a gap on purpose, say
so in the PR and add it to the **Known gaps** list in `docs/SECURITY.md` — a written-down gap
is a decision, an undocumented one is a bug.
