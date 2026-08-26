# Setup

## Running locally (no Google Cloud account needed)

You need Node 20.11+ and a JDK (the Firestore emulator is a Java process).

```bash
npm install
cp .env.example .env.local

# Generate the two secrets the app refuses to start without
node -e "console.log('JOIN_CODE_PEPPER='+require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CLEANUP_TASK_SECRET='+require('crypto').randomBytes(32).toString('hex'))"
# …paste both into .env.local, and put your own address in OWNER_EMAILS
```

Then, in two terminals:

```bash
npm run emulators   # Auth, Firestore, Storage + emulator UI on :4000
npm run dev         # http://localhost:3000
```

Optionally seed a demo event:

```bash
npm run seed
```

The defaults in `.env.example` are the emulator setup. `NEXT_PUBLIC_FIREBASE_*` can stay as
placeholders — the emulator does not verify them.

> Use `http://localhost:3000`, not a LAN IP, if you want the email-link sign-in to work:
> the pending address is kept in `localStorage`, which is per-origin.

## Signing in during development

The Auth emulator does not send email. Request a link in the app, then open the emulator UI
at <http://localhost:4000/auth> and click the link it shows for that address.

To give yourself owner rights, put your address in `OWNER_EMAILS` before signing in for the
first time — it is applied automatically. Afterwards, use the CLI:

```bash
npm run grant -- --email you@example.com --role owner
```

## Checks

```bash
npm run typecheck     # tsc
npm run lint          # eslint
npm test              # unit tests, no emulator needed
npm run test:rules    # Firestore rules against a throwaway emulator
npm run test:e2e      # Playwright against a running dev server + emulators
npm run smoke         # API-level end-to-end pass, needs dev + emulators up
```

`test:rules` starts its own emulator, so stop `npm run emulators` first or it will fight over
port 8080.

`test:e2e` and `smoke` expect the emulators and dev server to already be running.

## Deploying to Google Cloud

Not yet automated — this repository currently targets the emulators. What a real deployment
needs, roughly in order:

1. **A Firebase project** with Authentication (Google + email link), Firestore, and Cloud
   Storage enabled.
2. **A private bucket.** No public objects, no public access. CORS must allow `PUT` from your
   site origin with the `Content-Type` and `x-goog-content-length-range` headers, or signed
   uploads will fail preflight.
3. **TTL policies** on the `expiresAt` field for `events`, `posts`, `joinCodes`, and
   `rateLimits`. Firestore will not create these from `firestore.indexes.json`; set them in
   the console or with `gcloud firestore fields ttls update`.
4. **Composite indexes**: `firebase deploy --only firestore:indexes`.
5. **Rules**: `firebase deploy --only firestore:rules,storage`.
6. **Cloud Run** for the app. The service account needs `roles/datastore.user`,
   `roles/storage.objectAdmin` on the bucket, and `roles/iam.serviceAccountTokenCreator` on
   itself — the last one is what lets it sign V4 URLs without a key file.
7. **Secret Manager** for `JOIN_CODE_PEPPER` and `CLEANUP_TASK_SECRET`, mounted as env vars.
8. **Cloud Scheduler** hitting `POST /api/internal/cleanup` hourly with an OIDC token. Keep
   the bearer secret as a second lock.
9. **Bucket lifecycle rule** deleting objects under `events/` after your maximum event
   lifetime plus a margin — a backstop for anything the cleanup job misses.

Then set, in the Cloud Run environment:

```
STORAGE_DRIVER=gcs
GCS_BUCKET=your-media-bucket
NEXT_PUBLIC_USE_EMULATORS=false
NEXT_PUBLIC_SITE_URL=https://your-domain
```

Leave `GOOGLE_APPLICATION_CREDENTIALS` unset — Cloud Run supplies Application Default
Credentials.

Do **not** set `NODE_ENV` yourself anywhere. Next sets it, and pinning it to `development`
puts a development build of React into a production bundle.

## Troubleshooting

| Symptom                                           | Cause                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Invalid public environment` at boot              | `.env.local` missing or incomplete                                           |
| `JOIN_CODE_PEPPER must be at least 16 characters` | placeholder still in `.env.local`                                            |
| `403` on `/_next/static/*` in dev                 | opening the app on an origin outside `allowedDevOrigins` in `next.config.ts` |
| Emulator ports refuse to bind on `::1`            | harmless; IPv6 is unavailable, IPv4 works                                    |
| Sign-in link says the code is invalid             | the link was already used; request a new one                                 |
| `test:rules` hangs                                | another emulator already holds port 8080                                     |
