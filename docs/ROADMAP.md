# Roadmap

## Shipped — v1: the wallboard

Everything needed to create an event, share a code, and post to a live wall that expires.

- Anonymous bootstrap, Google and email-link sign-in, uid-preserving upgrade
- Event lifecycle: create, join by code, host settings, rotate code, extend, end early
- Posts: text, image, video, audio; direct-to-bucket upload with server-side re-validation
- Live wall via Firestore listeners, lightbox, countdown, empty/expired states
- Expiry: TTL policies, cleanup sweep, cleanup grace window
- Guardrails: deny-by-default rules, `can()` policy engine, rate limits, audit log, CSP
- Soft pastel design system, light and dark, reduced-motion honoured
- Tests: unit, Firestore rules, Playwright e2e, API smoke

The security primitives the later phases depend on — role claims, audit log, permission
matrix, rate limiting — shipped **inside** v1 deliberately. An audit log that starts when the
admin console ships has no history to show, and retrofitting call sites is how gaps get left
behind.

## Phase 2 — owner and admin console

`/admin`, gated on `admin:accessConsole`, behind `features.adminConsole`.

| Screen        | Needs                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Events        | list, filter, force-end, extend, delete, storage per event            |
| Users         | list, search, suspend with reason, view their events                  |
| Content       | remove any post, cross-event search                                   |
| Audit log     | filter by actor, action, event, date; reading it writes its own entry |
| Feature flags | Firestore `config/features`, read through `isEnabled()`               |
| Storage       | bytes by event, orphan report, manual sweep trigger                   |

Also: per-event host moderation UI — mute a member, remove a member, lock the wall.

Most of the server side already exists. `can()` already answers every `admin:*` permission;
what is missing is the read APIs and the screens.

**Done when:** an owner can find and remove any piece of content in under a minute, and every
action they take is in the audit log.

## Phase 3 — content safety

Behind `features.safetyScan`.

- Cloud Vision SafeSearch on images and sampled video frames, at finalize
- Posts scoring above threshold enter `state: 'quarantined'` — invisible to members, visible
  in the console
- Member-facing "report this post", creating a review item
- Appeal trail: who quarantined, who released, when

**Done when:** a host never has to be the first line of defence against an image nobody
should have to look at.

## Phase 4 — ads and marketing

Behind `features.ads` and `features.analytics`. Design detail in
[ADS_MARKETING.md](./ADS_MARKETING.md).

- Consent banner (GDPR/CCPA), consent state gating every non-essential script
- Typed analytics event schema — no free-form event names
- Config-driven sponsor slots in the wall layout
- GA4 → BigQuery export for funnel analysis

The seams exist now: the flags, the layout hooks, and a wall that already renders a
heterogeneous list. Only activation is deferred.

## Deferred, with reasons

**Real GCP provisioning.** Terraform for bucket, IAM, CORS, lifecycle, Cloud Run, Scheduler
and Secret Manager. Deferred because v1 targets the emulators; the manual steps are in
[SETUP.md](./SETUP.md). This is the first thing to do before any public launch.

**Video transcoding.** Cloud Transcoder normalising to H.264/AAC with an HLS ladder. Deferred
because it adds a worker service, async "processing" states in the UI, and real per-minute
cost — for a v1 where a 60-second cap already keeps files playable. `features.transcoding`
reserves the seam; enabling it will not change the storage layout or the post schema.

**Native apps.** The web app handles mobile capture through the file input. A native shell
would improve camera access and background upload, and is not worth it until usage says so.

## Ideas not yet committed

- Presentation mode for projecting a wall on a venue screen (`features.presentationMode` is
  already true; the route does not exist yet)
- Downloadable archive before an event expires — the obvious counterweight to ephemerality
- Reactions
- Multiple attachments per post (`contentLimits.mediaPerPost` already parameterises this)
- Recurring events reusing a stable code
