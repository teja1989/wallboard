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

## Sending real email

Until this is done, **nothing is actually sent**. `EMAIL_DRIVER` defaults to `outbox`, which
writes each message to a Firestore `mailOutbox` collection instead — useful in development,
and the reason a deploy that forgets its keys cannot spam anybody.

Three things, in order. The DNS step is the slow one.

### 1. A Resend account and a verified domain

Add `marqueersvp.com` in the Resend dashboard under **Domains**. Resend gives you a set of
DNS records — typically a `MX` and a `TXT` for the bounce subdomain, a `TXT` for DKIM, and
optionally a DMARC `TXT`.

Add each one in Cloudflare with **proxying off** (grey cloud, not orange). Proxying rewrites
records and breaks verification. Propagation is usually minutes; Resend re-checks on its own
and the domain flips to Verified.

> Sending from a domain you have not verified fails SPF, and the mail lands in spam or is
> rejected outright. This is not optional, and it is why `invitations@marquee.app` — a domain
> nobody here owns — had to go.

### 2. The key, and the switch

Create an API key in Resend with **Sending access** only.

In the GitHub repository:

| Where                          | Name                 | Value                         |
| ------------------------------ | -------------------- | ----------------------------- |
| Settings → Secrets → Actions   | `RESEND_API_KEY`     | the key                       |
| Settings → Variables → Actions | `EMAIL_DRIVER`       | `resend`                      |
| Settings → Variables → Actions | `EMAIL_FROM_ADDRESS` | `invitations@marqueersvp.com` |

A secret, not a variable, for the key — variables are printed in logs. Terraform refuses to
apply `email_driver = resend` without a key, so a half-configured deploy fails at plan rather
than at boot.

### 3. Push, then check

The next push deploys it. To confirm mail is really leaving, send one invitation to an
address you control and look at the Resend dashboard's **Logs** — it shows accepted,
delivered, bounced and complained per message.

### Testing before DNS has propagated

Resend accepts `onboarding@resend.dev` as a from-address with no domain set up at all, but it
will only deliver to the address that owns the Resend account. Set `EMAIL_FROM_ADDRESS` to it
for a first end-to-end test, then switch to your own domain once it verifies.

Resend also has addresses that force an outcome, which is the honest way to see a failure
path without waiting for a real bounce:

| Address                 | What happens   |
| ----------------------- | -------------- |
| `delivered@resend.dev`  | delivers       |
| `bounced@resend.dev`    | hard bounce    |
| `complained@resend.dev` | marked as spam |

## Walking one event end to end

`npm run walkthrough` creates one event, adds guests, sends the invitation, opens it as a
guest and prints every link — then **leaves it standing** so you can click through it.

```bash
npm run walkthrough                                     # local, against the emulators
GUESTS="you+one@gmail.com,you+two@gmail.com" npm run walkthrough
BASE=https://marqueersvp.com npm run walkthrough        # prints the steps; see below
```

Against production it stops at sign-in on purpose: the script cannot impersonate an account,
and it should not be able to. Do those steps in a browser — they are the same steps.

Guests default to `@example.com`, which is reserved by RFC 2606 and can never receive mail,
so a stray run cannot email a stranger.

## Troubleshooting

| Symptom                                           | Cause                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Invalid public environment` at boot              | `.env.local` missing or incomplete                                           |
| `JOIN_CODE_PEPPER must be at least 16 characters` | placeholder still in `.env.local`                                            |
| `403` on `/_next/static/*` in dev                 | opening the app on an origin outside `allowedDevOrigins` in `next.config.ts` |
| Emulator ports refuse to bind on `::1`            | harmless; IPv6 is unavailable, IPv4 works                                    |
| Sign-in link says the code is invalid             | the link was already used; request a new one                                 |
| `test:rules` hangs                                | another emulator already holds port 8080                                     |
