# Marquee — repository conventions

Invitations, RSVPs and a live guest wall. Next.js 16 (App Router) on Cloud Run, Firestore,
Cloud Storage, Firebase Auth. Runs entirely against the Firebase emulators with no GCP
account.

Two skills carry the working detail — read them rather than re-deriving:

- **`.claude/skills/marquee-dev/`** — running, seeding, testing; where each kind of change
  goes; the traps (`NODE_ENV`, `server-only` in CLI scripts, `node:crypto` in client code,
  one-time codes and Strict Mode, Firestore singletons and hot reload).
- **`.claude/skills/marquee-security/`** — the pre-merge checklist for anything touching
  authorization, entitlements, rules, sessions, codes, RSVPs, uploads, rate limits, or the
  CSP.

## The six invariants

1. **No client writes to Firestore.** Every mutation goes through a route handler that
   validates with Zod, authorizes with `can()`, checks entitlements, consumes a rate-limit
   token, and audit-logs. Rules deny all client writes, owners included.
2. **`can()` in `src/lib/authz/policy.ts` is the only place a permission is decided.** UI and
   API both call it.
3. **Entitlements are not permissions.** `can()` answers who you are; `entitlementsFor()`
   answers what was paid for. Neither may stand in for the other, and every paid gate is
   enforced server-side.
4. **RSVP notes live in `rsvpNotes/`, never on the member document.** Firestore rules cannot
   restrict a field, and a note written for the host is not for the rest of the guest list.
   The same applies to `invitees/` — a list of email addresses is not for the guest list.
5. **Only a verified webhook grants a paid plan.** A checkout success redirect is a URL
   anyone can visit.
6. **Config is the single source of every tunable.** `src/config/*` — limits, plans,
   occasions, roles, flags, and every string a guest reads. A literal in a component or
   handler is a bug, because the client's check and the server's enforcement would then read
   different numbers.

## Commands

```bash
npm run emulators     # Auth :9099, Firestore :8080, Storage :9199, UI :4000
npm run dev           # http://localhost:3000
npm run seed          # demo invitation with replies

npm run typecheck && npm run lint && npm test
npm run test:rules    # starts its own emulator — stop `npm run emulators` first
npm run smoke         # API end to end; needs emulators + dev running
npm run test:e2e      # Playwright through the real UI
```

## Docs

`docs/ARCHITECTURE.md` · `docs/SECURITY.md` · `docs/DATA_MODEL.md` · `docs/PRICING.md` ·
`docs/BRAND.md` · `docs/SETUP.md` · `docs/ROADMAP.md` · `docs/ADS_MARKETING.md` ·
`CONTRIBUTING.md`
