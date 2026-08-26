# Wallboard — repository conventions

Ephemeral group event walls. Next.js 16 (App Router) on Cloud Run, Firestore, Cloud Storage,
Firebase Auth. Runs entirely against the Firebase emulators with no GCP account.

Two skills carry the working detail — read them rather than re-deriving:

- **`.claude/skills/wallboard-dev/`** — running, seeding, testing; where each kind of change
  goes; the traps (`NODE_ENV`, `server-only` in CLI scripts, `node:crypto` in client code,
  one-time codes and Strict Mode).
- **`.claude/skills/wallboard-security/`** — the pre-merge checklist for anything touching
  authorization, rules, sessions, codes, uploads, rate limits, or the CSP.

## The three invariants

1. **No client writes to Firestore.** Every mutation goes through a route handler that
   validates with Zod, authorizes with `can()`, consumes a rate-limit token, and audit-logs.
   Rules deny all client writes, owners included.
2. **`can()` in `src/lib/authz/policy.ts` is the only place a permission is decided.** UI and
   API both call it.
3. **Config is the single source of every tunable.** `src/config/*`. A literal limit in a
   component or handler is a bug, because the client's check and the server's enforcement
   would then read different numbers.

## Commands

```bash
npm run emulators     # Auth :9099, Firestore :8080, Storage :9199, UI :4000
npm run dev           # http://localhost:3000
npm run seed          # demo event

npm run typecheck && npm run lint && npm test
npm run test:rules    # starts its own emulator — stop `npm run emulators` first
npm run smoke         # API end to end; needs emulators + dev running
npm run test:e2e      # Playwright through the real UI
```

## Docs

`docs/ARCHITECTURE.md` · `docs/SECURITY.md` · `docs/DATA_MODEL.md` · `docs/SETUP.md` ·
`docs/ROADMAP.md` · `docs/ADS_MARKETING.md` · `CONTRIBUTING.md`
