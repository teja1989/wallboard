# Wallboard

A wall for the moment. Then it lets go.

Create a group event, share one eight-character code, and everyone posts photos, video,
voice notes and messages to a live wall that deletes itself when the moment is over.

<!-- Screenshots live in docs/ once captured against a deployed instance. -->

## What it does

- **One code, everyone in.** No invites, no app, no account needed to watch along.
- **Live.** Posts appear on every open wall without a refresh.
- **Actually ephemeral.** Pick 1 hour to 30 days. When it lapses the media is deleted from
  storage, not just hidden.
- **Yours to moderate.** The host can remove anything, rotate the code, extend the wall, or
  end it early.

## Quick start

No Google Cloud account needed — it runs entirely against the Firebase emulators.

```bash
npm install
cp .env.example .env.local     # then generate the two secrets it asks for

npm run emulators              # terminal 1
npm run dev                    # terminal 2 → http://localhost:3000
npm run seed                   # optional: a demo event
```

Full instructions, including the real GCP deployment path, are in [docs/SETUP.md](docs/SETUP.md).

## How it is built

Next.js 16 (App Router) on Cloud Run · Firestore · Cloud Storage · Firebase Auth ·
TypeScript · Tailwind v4 · Framer Motion.

Three ideas carry the design:

1. **Writes are server-only, reads are direct.** Firestore rules deny every client write;
   every mutation goes through a route handler that validates, authorizes, rate-limits and
   audit-logs. Clients keep direct _reads_ so the wall stays live.
2. **Everyone has a uid, not everyone has an account.** Code-only visitors sign in
   anonymously; upgrading to a real account _links_ the credential, so the uid — and
   therefore their membership and their posts — survives.
3. **Media never touches the app server.** Uploads go straight to the bucket via a
   server-issued URL, and are re-validated server-side against the object that actually
   landed before a post is created.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the detail.

## Commands

|                                           |                                        |
| ----------------------------------------- | -------------------------------------- |
| `npm run dev`                             | dev server                             |
| `npm run emulators`                       | Auth, Firestore, Storage + UI on :4000 |
| `npm run seed`                            | seed a demo event                      |
| `npm run grant -- --email x --role owner` | grant a platform role                  |
| `npm run cleanup`                         | run the expiry sweep by hand           |
| `npm run typecheck` / `lint` / `format`   | static checks                          |
| `npm test`                                | unit tests                             |
| `npm run test:rules`                      | Firestore rules against the emulator   |
| `npm run smoke`                           | API end-to-end pass                    |
| `npm run test:e2e`                        | Playwright through the real UI         |

## Documentation

|                                           |                                                     |
| ----------------------------------------- | --------------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)   | how it fits together, and what was left out         |
| [SECURITY.md](docs/SECURITY.md)           | the guardrails and what each one stops              |
| [DATA_MODEL.md](docs/DATA_MODEL.md)       | collections, fields, indexes, TTLs                  |
| [SETUP.md](docs/SETUP.md)                 | local setup and the GCP deployment path             |
| [ROADMAP.md](docs/ROADMAP.md)             | admin console, content safety, ads                  |
| [ADS_MARKETING.md](docs/ADS_MARKETING.md) | the ad integration plan, written before building it |
| [CONTRIBUTING.md](CONTRIBUTING.md)        | conventions and the config-first rule               |

`.claude/skills/` holds two working skills: `wallboard-dev` for running and changing the app,
`wallboard-security` for the pre-merge review checklist.

## Status

v1 — the wallboard itself — is complete and tested. The owner/admin console, content safety
scanning, and ad integration are planned as phases 2–4; the roles, audit log and feature
flags they depend on already ship in v1. See [ROADMAP.md](docs/ROADMAP.md).
