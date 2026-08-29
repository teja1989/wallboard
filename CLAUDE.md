# Marquee — repository conventions

Invitations, RSVPs and a live guest wall. Next.js 16 (App Router) on Cloud Run, Firestore,
Cloud Storage, Firebase Auth. Runs entirely against the Firebase emulators with no GCP
account.

## Start here

**Picking this up cold?** In this order:

1. **[docs/ROADMAP.md](docs/ROADMAP.md)** — what is built, what is next, what is deliberately
   not done. Includes the one manual check that gates turning billing on.
2. **[docs/DECISIONS.md](docs/DECISIONS.md)** — why the product is shaped this way. Which calls
   are settled and what evidence would reopen them; which are genuinely yours to make; and the
   list of **things that look like bugs and are choices**. Read section 3 before "fixing"
   something that seems obviously wrong.
3. The invariants below, then the skill covering whatever you are about to touch.

Then verify against the code rather than trusting any of it. Documentation drifts; this repo
has had docs describe a permission model more permissive than the code, and a roadmap listing
shipped features as pending. **When a doc and the code disagree, the code is what runs — fix
the doc in the same commit.**

## Three skills carry the working detail

Read them rather than re-deriving:

- **`.claude/skills/marquee-dev/`** — running, seeding, testing; where each kind of change
  goes; and the traps, which are the expensive part. Every entry there is a bug that actually
  happened.
- **`.claude/skills/marquee-security/`** — the pre-merge checklist for anything touching
  authorization, entitlements, rules, sessions, codes, RSVPs, uploads, rate limits, the audit
  log, the admin console, or the CSP.
- **`.claude/skills/marquee-deploy/`** — Terraform, the Dockerfile, the deploy workflow, and
  the traps in each (the site-URL cycle, build-time `NEXT_PUBLIC_*`, self-signing IAM).

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

## Two rules that have each cost real bugs

- **An update schema has no defaults anywhere.** `.partial()` does not undo `.default()`, so a
  "partial" update parses an absent key into its default and the handler writes it over
  whatever was there. Four data-loss bugs so far. Define the field once, build two schemas
  from it: `.default(…)` for create, `.optional()` for patch.
- **A permission, flag or plan claim with nothing behind it is a bug, not a placeholder.** Five
  `admin:*` permissions were enforced and reachable from nowhere (resolved); `features.presentationMode`
  was `true` with no implementation (resolved); the Pro plan sells `vanityLink`, which does not exist.
  Either wire it or say plainly, in config, that it is not wired.

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

The full gate before pushing is all five, against a **production build** (`npm run build &&
npm start`) rather than the dev server. Some assertions — the CSP, cache headers, static
rendering — only tell the truth against a real build.

The owner-only paths in `smoke` and `e2e` are skipped unless the process shares the server's
`OWNER_EMAILS`, rather than guessed. Locally:

```bash
OWNER_EMAILS=$(grep OWNER_EMAILS .env.local | cut -d= -f2) npm run smoke
```

## Docs

[ROADMAP](docs/ROADMAP.md) · [DECISIONS](docs/DECISIONS.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) ·
[SECURITY](docs/SECURITY.md) · [DATA_MODEL](docs/DATA_MODEL.md) · [DEPLOYMENT](docs/DEPLOYMENT.md) ·
[PRICING](docs/PRICING.md) · [BRAND](docs/BRAND.md) · [SETUP](docs/SETUP.md) ·
[ADS_MARKETING](docs/ADS_MARKETING.md) · [CONTRIBUTING](CONTRIBUTING.md)
