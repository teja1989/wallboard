# Marquee

**Every occasion deserves a marquee.**

Send an invitation people actually want to open, collect RSVPs without chasing anyone, and
give your guests one live wall for every photo, video and message from the night.

Think Evite, but the invitation does not die the moment everyone has replied — the same link
becomes the place the night lives on. Then it closes, on a date you choose, and the photos
are deleted for real.

## What it does

**Invite.** Pick an occasion and Marquee builds the page — date, place, dress code, the lot.
Ten occasions, each with its own theme and wording, so a memorial never reads like a
birthday. Share one link or one eight-character code.

**Gather.** Guests reply in one tap, add their plus-ones, and leave a private note for the
host. You get a live headcount and a guest list you can export.

**Remember.** Everyone posts photos, video, voice notes and messages to the same live wall.
No group chat to scroll, nothing lost across nineteen camera rolls.

No account, app or download for your guests — ever.

## Quick start

Runs entirely against the Firebase emulators. No Google Cloud account needed.

```bash
npm install
cp .env.example .env.local     # then generate the two secrets it asks for

npm run emulators              # terminal 1
npm run dev                    # terminal 2 → http://localhost:3000
npm run seed                   # optional: a demo invitation with replies
```

Full instructions, including the GCP deployment path, are in [docs/SETUP.md](docs/SETUP.md).

## How it is built

Next.js 16 (App Router) on Cloud Run · Firestore · Cloud Storage · Firebase Auth ·
TypeScript · Tailwind v4 · Framer Motion.

Four ideas carry the design:

1. **Writes are server-only, reads are direct.** Firestore rules deny every client write;
   every mutation goes through a route handler that validates, authorizes, checks
   entitlements, rate-limits and audit-logs. Clients keep direct _reads_ so the wall stays
   live without polling.
2. **Everyone has a uid, not everyone has an account.** Code-only guests sign in
   anonymously; upgrading _links_ the credential, so the uid — and with it their membership,
   their reply and their posts — survives.
3. **Answers are public, notes are not.** The RSVP and headcount belong to the guest list.
   The note a guest writes for the host lives in a subcollection no browser can read.
4. **Media never touches the app server.** Uploads go straight to the bucket via a
   server-issued URL, and are re-validated against the object that actually landed before a
   post exists.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the detail.

## Pricing

Free to start; **$19** once for a single event; **$79/year** for people who host constantly.
No per-guest fees, ever.

Nobody is charged yet — `features.billing` is off, every event runs on the preview plan, and
the pricing page says so. The entitlement gates are written and tested; only Stripe is
missing. The reasoning behind the numbers is in [docs/PRICING.md](docs/PRICING.md).

## Commands

|                                           |                                        |
| ----------------------------------------- | -------------------------------------- |
| `npm run dev`                             | dev server                             |
| `npm run emulators`                       | Auth, Firestore, Storage + UI on :4000 |
| `npm run seed`                            | seed a demo invitation                 |
| `npm run grant -- --email x --role owner` | grant a platform role                  |
| `npm run cleanup`                         | run the expiry sweep by hand           |
| `npm run typecheck` / `lint` / `format`   | static checks                          |
| `npm test`                                | unit tests                             |
| `npm run test:rules`                      | Firestore rules against the emulator   |
| `npm run smoke`                           | API end-to-end pass                    |
| `npm run test:e2e`                        | Playwright through the real UI         |

## Documentation

|                                           |                                                      |
| ----------------------------------------- | ---------------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)   | how it fits together, and what was left out          |
| [SECURITY.md](docs/SECURITY.md)           | the guardrails and what each one stops               |
| [DATA_MODEL.md](docs/DATA_MODEL.md)       | collections, fields, indexes, TTLs                   |
| [PRICING.md](docs/PRICING.md)             | the plans, the unit economics, turning billing on    |
| [BRAND.md](docs/BRAND.md)                 | the name, the voice, the rules the copy follows      |
| [SETUP.md](docs/SETUP.md)                 | local setup and the GCP deployment path              |
| [ROADMAP.md](docs/ROADMAP.md)             | email delivery, payments, admin console, safety, ads |
| [ADS_MARKETING.md](docs/ADS_MARKETING.md) | the ad plan, written before building it              |
| [CONTRIBUTING.md](CONTRIBUTING.md)        | conventions and the config-first rule                |

`.claude/skills/` holds two working skills: `marquee-dev` for running and changing the app,
`marquee-security` for the pre-merge review checklist.

## Status

v1 is complete and tested — invitations, RSVPs, the guest list, the live wall, expiry, and
the plan gates. Verified against the emulators: **114 unit tests**, **39 Firestore rules
tests**, **66 API smoke assertions**, **20 Playwright journeys**.

Before a public launch: email delivery, Stripe, archive download, and Terraform for the real
GCP project. See [ROADMAP.md](docs/ROADMAP.md).
