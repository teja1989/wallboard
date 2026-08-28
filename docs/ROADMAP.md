# Roadmap

## Shipped — v1: the marquee

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

## Phase 2 — the gaps that block a launch

Ordered by what actually stops revenue.

### Email delivery — shipped

A transactional provider, an address list per event, and a reminder for guests who have not
replied.

### Reaching people the way they actually reach each other — phase A shipped

Guests are identified by an opaque id rather than an email address, so someone can be added
by phone number alone. Every guest gets a personal invitation link, which is what makes
per-person tracking possible at all, and the host can send those links themselves from
whatever thread they already talk to that person in — no carrier, no registration, no
compliance exposure, and it still tracks.

Status climbs `queued → sent → delivered → seen → replied`. There is deliberately no
"opened": see [ARCHITECTURE.md](./ARCHITECTURE.md) for why an open pixel measures Apple
rather than a person.

**Phase B, blocked on paperwork not code:** SMS and WhatsApp behind one channel adapter,
carrier delivery receipts, a global STOP suppression list, quiet hours, and per-plan
metering — US SMS costs roughly thirty times what email does. US A2P 10DLC brand and
campaign registration and Meta business verification each take one to three weeks and must
be started before any of that code is worth writing.

### Add to calendar — shipped

Every invitation with a date offers a `.ics` download and a Google Calendar link, and the
emailed invitation, reminder and confirmation carry the same link. The entry brings two
reminders with it — the day before, and two hours before — which is the cheapest attendance
lift available: the guest's own phone does the nagging, at no per-message cost.

Times are written in UTC rather than tagged with the event's zone. A `TZID` is only legal
alongside a `VTIMEZONE` block spelling out that zone's daylight-saving rules, and hand-rolling
those means shipping a copy of the zone database that goes stale. A UTC instant is
unambiguous, and it is what makes the entry land at the right moment for a guest reading it
from anywhere.

Not yet: wallet passes (lock-screen presence on the day, and they update themselves if the
venue moves) and automatic reminders sent on a schedule rather than by the host pressing a
button.

### Host tools that a host can actually use — shipped

Three complaints, one cause. The guest list, the join code, "add time", the plan, "end the
event" and "delete everything" all lived in one 384px drawer, so the thing a host touches most
sat in the same scroll as the thing they must never touch by accident.

- **Guests moved to their own tab**, beside the replies, because inviting someone and seeing
  whether they answered is one job. The drawer keeps only the occasional controls.
- **Guests are entered as rows** — a name and a phone number or address — replacing a paste
  box whose only way to attach a name was `Name <address>`, unavailable to anyone entering a
  number. A name typed beside a number was silently discarded. Pasting a list still fills the
  rows in one go.
- **Deleting works on a real guest wall**, and can be done from the account list without
  opening the event. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the ordering that makes a
  storage failure safe.

### Knowing whether any of it works — shipped

First-party, server-side, aggregate. Counters per event per day for invitations sent, opened,
replied to, said yes to, posted, and taken to checkout. No third-party script, no pixel, no
per-visitor row, and nothing that outlives the event. `GET /api/events/{id}/funnel` is the
host-only read; `docs/ARCHITECTURE.md` has the design.

This blocks the interesting decisions rather than following them. Where a paywall belongs and
whether guests will click a gift link are both empirical questions, and until now every number
in this document was a model rather than an observation.

Not yet: an "upgrade viewed" counter, which is the one moment in the funnel that only exists
in the browser and would need a client beacon. Deliberately deferred — it is new write surface
for one ratio, and the five server-side moments answer most of the question.

### Payments

The entitlement gates are written and tested. Missing: Stripe Checkout for the one-off,
Stripe Billing for the subscription, a webhook that stamps `events/{id}.plan`, and an
upgrade screen inside an existing event. See [PRICING.md](./PRICING.md).

### Archive download

Do not turn billing on without it. It is the answer to "what happens to my photos", which is
the question that decides whether someone trusts us with the event at all.

### Real GCP provisioning

Terraform for bucket, IAM, CORS, lifecycle, Cloud Run, Scheduler and Secret Manager. Manual
steps are in [SETUP.md](./SETUP.md) today.

## Phase 3 — owner and admin console

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

## Phase 5 — content safety

Behind `features.safetyScan`.

- Cloud Vision SafeSearch on images and sampled video frames, at finalize
- Posts scoring above threshold enter `state: 'quarantined'` — invisible to members, visible
  in the console
- Member-facing "report this post", creating a review item
- Appeal trail: who quarantined, who released, when

**Done when:** a host never has to be the first line of defence against an image nobody
should have to look at.

## Phase 6 — ads and marketing

Behind `features.ads` and `features.analytics`. Design detail in
[ADS_MARKETING.md](./ADS_MARKETING.md).

- Consent banner (GDPR/CCPA), consent state gating every non-essential script
- Typed analytics event schema — no free-form event names
- Config-driven sponsor slots in the wall layout
- GA4 → BigQuery export for funnel analysis

The seams exist now: the flags, the layout hooks, and a wall that already renders a
heterogeneous list. Only activation is deferred.

## Deferred, with reasons

**Video transcoding.** Cloud Transcoder normalising to H.264/AAC with an HLS ladder. Deferred
because it adds a worker service, async "processing" states in the UI, and real per-minute
cost — for a v1 where a 60-second cap already keeps files playable. `features.transcoding`
reserves the seam; enabling it will not change the storage layout or the post schema.

**Native apps.** The web app handles mobile capture through the file input. A native shell
would improve camera access and background upload, and is not worth it until usage says so.

## Ideas not yet committed

- Save-the-date, sent before the details are settled — the schema already allows a null date
- Co-hosts, so a wedding is not owned by one person's account
- Seating and meal choices, which is where the wedding market starts paying real money

- Presentation mode for projecting a wall on a venue screen (`features.presentationMode` is
  already true; the route does not exist yet)
- Downloadable archive before an event expires — the obvious counterweight to ephemerality
- Reactions
- Multiple attachments per post (`contentLimits.mediaPerPost` already parameterises this)
- Recurring events reusing a stable code
