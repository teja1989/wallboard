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

## Making sign-in first-party (Firebase Hosting)

Sign-in currently runs its handler on `quantum-pulsar.firebaseapp.com` while the app is on
`marqueersvp.com`. Those are different _sites_, so the popup is third-party: Safari blocks
its storage outright, and Chrome is heading the same way. That is what makes the popup fail
and what leaves people staring at a spinner.

The fix is to serve the same handler from `auth.marqueersvp.com`. It shares the registrable
domain with the app, so the browser treats it as first-party.

> The redirect fallback in `auth-provider.tsx` is a mitigation, not a cure — Safari can
> refuse the redirect flow for the same reason. Do this before real guests see it.

### 1. Enable Firebase Hosting

Firebase Console → **Build → Hosting → Get started**. Accept the defaults and skip the CLI
walkthrough it offers; nothing is being deployed to Hosting. It exists only to serve the
auth handler at `/__/auth/*` on a domain we control.

### 2. Attach the domain

Hosting → **Add custom domain** → `auth.marqueersvp.com`.

Firebase gives you either a `TXT` record to prove ownership or two `A` records. Add them in
Cloudflare with **proxying off** — the orange cloud breaks both verification and the
certificate, the same trap as the Resend setup above.

Wait for the domain to read **Connected**. The certificate usually takes minutes and can
take up to 24 hours.

### 3. Tell the Google OAuth client about it

This is the step that is easy to miss, and skipping it produces `redirect_uri_mismatch`
after everything else looks right.

Google Cloud Console → **APIs & Services → Credentials** → your OAuth 2.0 Client ID →
**Authorized redirect URIs** → add:

```
https://auth.marqueersvp.com/__/auth/handler
```

Leave the existing `https://quantum-pulsar.firebaseapp.com/__/auth/handler` in place so a
rollback still works.

### 4. Switch the app over

Add a repository **variable** (Settings → Variables → Actions):

| Name          | Value                  |
| ------------- | ---------------------- |
| `AUTH_DOMAIN` | `auth.marqueersvp.com` |

Terraform adds it to Firebase's authorized domains — the handler refuses to run on a domain
it has not been told about — and passes it into the image build.

**It is a `NEXT_PUBLIC_*` value, so it is baked into the JavaScript bundle at docker build.**
Changing the variable alone does nothing; it takes effect on the next push, which rebuilds.

### 5. Check it

Open the site, sign in with Google, and watch the popup's address bar: it should say
`auth.marqueersvp.com`, not `quantum-pulsar.firebaseapp.com`. Try it in Safari, which is the
browser that was failing.

To roll back, clear the `AUTH_DOMAIN` variable and push. The next build falls back to
`firebaseapp.com`.

### Cost

Hosting's free tier covers this comfortably — the handler is a few kilobytes and nothing
else is served from it.

## Address lookup (optional)

Without a key the address field is a plain text box — which is the right behaviour, not a
degraded one. Turn this on for autocomplete, a map on the invitation, one-tap directions,
and the venue's own timezone.

### 1. A key

Google Cloud Console → **APIs & Services → Library** → enable **Places API (New)** and
**Maps Static API**. Then **Credentials → Create credentials → API key**.

Restrict it under **API restrictions** to those two APIs. Leave **Application restrictions**
as _None_: the key is only ever used from our server, never a browser, so a referrer or IP
restriction would either do nothing or break it.

> Never make this a `NEXT_PUBLIC_` value. A key in the JavaScript bundle is a key on
> somebody else's bill, and a referrer restriction does not fix that — a referrer is a
> request header, and a header is a thing anyone can type.

### 2. Switch it on

| Where                          | Name                  | Value   |
| ------------------------------ | --------------------- | ------- |
| Settings → Secrets → Actions   | `GOOGLE_MAPS_API_KEY` | the key |
| Settings → Variables → Actions | `PLACES_ENABLED`      | `true`  |

Both are needed. `PLACES_ENABLED` decides whether the Secret Manager entry exists at all,
and it is a separate plain variable on purpose: deciding that by looking at the key would
make a `for_each` key derive from a sensitive value, which Terraform rejects for the entire
plan. That is not hypothetical — it failed a deploy silently once already.

### What it costs

Autocomplete is billed per **session**, not per keystroke: a run of typing plus the lookup
that ends it, tied together by a session token we generate and pass through. That is roughly
a tenfold difference against the naive implementation. One event created is one session,
around $0.017.

The static map is fetched through our own route and cached for a day, so a venue is drawn
once rather than once per guest who opens the invitation.

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
