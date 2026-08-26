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
npm run smoke          # needs emulators + dev running
```

CI runs all of it plus Playwright.

## The rules that matter

### Config first

Every limit, quota, window, colour, and flag lives in `src/config/*`. A literal in a
component or a route handler is a bug — not because it looks bad, but because the client's
pre-flight check and the server's enforcement then read different numbers, and the drift only
shows up as a confusing rejection much later.

If you catch yourself writing `if (file.size > 15 * 1024 * 1024)`, stop and import
`mediaRules`.

### Permissions go through `can()`

`src/lib/authz/policy.ts` is the only place a permission decision is made. No `role === 'host'`
anywhere else. The UI calls the same function as the API, so a button cannot promise something
the API refuses.

New permission → add it to `PERMISSIONS`, put it in the right role table, and write a test
that asserts the **refusal** as well as the grant.

### Clients never write to Firestore

Every mutation goes through a route handler. Rules deny all client writes and there is no
exception, including for owners. See `.claude/skills/wallboard-security/SKILL.md` for the
route-handler shape.

### Comments explain why

Not what. If a line needs a comment to say what it does, the names are wrong. Comments that
earn their place: a non-obvious ordering, a workaround with a reason, a trade-off someone
would otherwise "fix".

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
