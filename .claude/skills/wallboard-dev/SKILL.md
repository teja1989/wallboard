---
name: wallboard-dev
description: Run, seed, and test the Wallboard app locally against the Firebase emulators. Use when starting work on this repo, when a change needs verifying end to end, when the emulators or dev server misbehave, or when adding a config value, an API route, or a media kind.
---

# Working on Wallboard

Ephemeral group event walls. Next.js 16 on Cloud Run, Firestore, Cloud Storage, Firebase
Auth. Everything runs locally against the emulators with **no GCP account**.

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

### Adding a media kind

1. `mediaRules` in `limits.config.ts` — MIME allowlist, size, duration
2. `EXTENSION_BY_MIME` in `src/lib/storage/index.ts`
3. `probeFile` in `src/lib/client/media-probe.ts` — how to measure it
4. `MediaBlock` in `src/components/wall/post-card.tsx` — how to play it
5. `tests/unit/config.test.ts` already asserts no two kinds claim the same MIME type

### Adding a config value

Put it in the right `*.config.ts`, export it, and import it on **both** sides. The whole
point is that the client's pre-flight check and the server's enforcement read the same
number. A literal in a component that "matches" a config value is a bug waiting for someone
to change one of them.

## Things that will bite you

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
  Mode's double invocation burns it. This already bit `/auth/finish` once.

## Conventions

- TypeScript strict, including `noUncheckedIndexedAccess`. Index access is `T | undefined`.
- Comments explain _why_, not what. If a line needs a comment to say what it does, rename
  something instead.
- Error messages are sentences a guest at a party could understand, not error codes.
- New behaviour comes with a test. Permissions get a test that asserts the refusal too.
