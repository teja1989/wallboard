# Roadmap

What is built, what is next, and what was deliberately not done.

**If you are picking this work up cold**, read this file and [DECISIONS.md](./DECISIONS.md)
first. This one tells you where the product is; that one tells you which choices are settled
and which are yours to make.

---

## Where it stands

The RSVP product is **feature-complete for a launch** and has never taken a payment. Billing
is written, tested and switched off. The one thing standing between here and turning it on is
a manual verification nobody can automate — see [Before billing](#before-billing).

|            |                                                                                |
| ---------- | ------------------------------------------------------------------------------ |
| Test suite | 377 unit · 67 Firestore rules · 251 API smoke · 82 Playwright e2e              |
| Live at    | `https://marqueersvp.com` on Cloud Run, provisioned by Terraform               |
| Charging   | No. `features.billing` is `false`; every event runs on `previewPlanId` (`pro`) |
| Ads        | No, and none coming — see [DECISIONS.md](./DECISIONS.md)                       |

---

## Shipped

### The event, end to end

Create, join by code, a live wall that expires, and everything around it. Anonymous bootstrap
with a uid-preserving upgrade to Google or an email link. Posts in text, image, video and
audio, uploaded direct to the bucket and re-validated server-side. Expiry through TTL policies
plus a cleanup sweep. Deny-by-default rules, the `can()` matrix, rate limits, an audit log and
a CSP — all shipped inside v1 deliberately, because retrofitting security primitives is how
gaps get left behind.

### Invitations and RSVPs

Per-occasion wording and templates, a live preview of the real invitation while the host
types, an `.ics` and a Google Calendar link on every dated invitation, and email delivery
through a provider adapter.

Guests are identified by an **opaque id**, not an address, so someone can be added by phone
number alone and can gain an address later without becoming a second guest. Every guest gets a
personal link, which is what makes per-person status answerable at all; hosts who prefer to
send it themselves get the same tracking through the relay panel.

Sending works at both granularities: everyone who has not had one, or one named guest from
their own row. A guest list is built in ones and twos over a week, so "email everyone unsent"
alone was the wrong shape — and a bounced address needs one retry, not a re-run.

Replies capture who is coming and how many, split into adults and children. The private half
of a reply — the note and the custom answer — lives in its own subcollection, because a note
written for the host is not for the rest of the guest list.

**What happens after somebody replies** is answered rather than dropped: the date into their
calendar, whether anyone else is coming, a way into the wall. A "no" gets the wall too —
someone who cannot come to a fortieth still wants to say something — and pointedly no calendar
entry.

### Reminders that send themselves

Two slots counted back from the event, a week and two days, claimed transactionally _before_
sending. A slot that fell due before the invitation existed never fires, so publishing three
days out does not immediately chase everybody. Hosts can switch it off.

### The gift list

Host pastes links; guests see them on the invitation. No prices, no images, no stock —
fetching those makes this a worse version of the shop the host already chose, and Amazon's
terms forbid caching a price past 24 hours. Offered only where `occasion.giftsExpected`.

It exists to answer one question — **will guests click through?** — and the click beacon feeds
the funnel so the answer is falsifiable.

### The planning board

Milestones seeded per occasion from config with dates counted back from the event, categories,
budgets, and live numbers pulled off the event at render. Host-only in both directions:
somebody's working notes about their own party, including what they are spending.

### Knowing whether any of it works

Counters per event per day for invitations sent, opened, replied to, said yes to, posted,
gift-links clicked, milestones completed and checkout reached. Host-readable per event; summed
across every event in the operator console, with each ratio printed beside the decision it
settles and its denominator, because "12%" means nothing when the denominator is eight.

### The operator console

`/admin` — events, people, the audit trail, the funnel. Everything reads except suspension,
which refuses the caller themselves and anyone at or above their own rank, requires a reason,
and audits both directions. Reading the audit log records the read.

This closed a real gap: five `admin:*` permissions were declared and enforced and reachable
from nowhere, `admin:suspendUser` among them — so `Actor.suspended` gated every write in the
product while nothing could set the field, and the launch-day answer to an abuse report was to
edit a Firestore document by hand.

### Positioning and growth

The no-ads promise said out loud, with the reason, on the landing and pricing pages. The
"made with Marquee" mark on invitations, as a link rather than a footnote. Promos as config,
granted at creation and visible where a host would look for one.

### Presentation mode and social proof

`/e/{eventId}/present` — full-screen venue projector display for reception screens and TVs. Auto-cycling spotlight carousel of photos and messages, ambient theme styling, keyboard controls, and an embedded zero-dependency SVG QR code for guests in the room to scan and post in real time.

"Who's coming" attendee avatar stack on invitations (`SocialProof`), pulling confirmed attendees via the composite index on `(rsvp.status ASC, joinedAt ASC)` to drive social proof before and after RSVP.

### Deployment

Terraform for the bucket, IAM, CORS, lifecycle, Cloud Run, Scheduler, Secret Manager and every
Firestore index. Deploy through GitHub Actions with Workload Identity Federation — no
long-lived service account key anywhere.

---

## Before billing

**The archive has never been verified against real Cloud Storage.** It works against the
emulator and is covered by smoke and e2e, but the credential path for signing URLs in Cloud
Run differs from the emulator's, and this is the thing being paid for.

One real event, on production: post a photo, download the archive, open the zip. Nobody can
automate it and nothing else should be turned on until it is done.

Then, in order:

1. `BILLING_DRIVER=stripe`; `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` into
   `infra/terraform/secrets.tf`, following the `RESEND_API_KEY` pattern — and mind that a
   `for_each` key may not derive from a sensitive value.
2. Verify `stripe.gateway.ts` live in test mode: checkout → webhook → `events/{id}.plan`.
   Assert an **unsigned** webhook is rejected, and that entitlements actually change.
3. Enable Apple Pay, Google Pay and Link in Checkout — these move conversion measurably.
4. Resolve `vanityLink`, which the Pro plan sells and nothing implements. Build it or stop
   selling it; do not launch a paid plan with a claim behind it that is not true.
5. Flip `features.billing`. Existing events keep the plan stamped on them, which is the whole
   point of the stamp — verify that with the regression test before and after the flip.

---

## Next, in the order I would do it

### 1. Close the open loop in the shipped product

Small, and the same class of problem as the admin gap: something advertised with nothing behind it.

- **`vanityLink`**, which the Pro plan sells and nothing implements. Build it or stop selling it;
  do not launch a paid plan with a claim behind it that is not true.

### 2. The post-event ask

The one credible moment to ask a guest for anything is **after the event, when they want the
photos**. Let a guest take a low-resolution copy of photos they appear in, free, and put "make
one of your own" on that screen.

This is the compounding loop the business does not otherwise have: it converts a guest into a
host at the only instant they care. Explicitly **not** referral discounts — this category is
occasion-triggered, not price-triggered, and "give $5 get $5" does not fire when nobody is
having a birthday.

### 3. Discoverability

There is no SEO surface at all: no sitemap, and `robots.txt` correctly closes everything but
four marketing pages. Occasion-specific planning pages ("what to put on a 40th birthday
invitation") are the honest version of this — real content the templates and planning config
already half-write.

The competitive read: this does not beat Evite at being Evite, and twenty years of SEO is
unwinnable. The winnable ground is the **50–250 guest milestone event**, where Evite's premium
tier is the incumbent and Zola and The Knot are absent because it is not a wedding.

### 4. The wishes board

Agreed as the next product direction and deliberately deferred until the RSVP work was
finished. A tribute board — a colleague's retirement, a leaving card, a milestone birthday —
where people leave messages, audio and video for one recipient.

Most of it exists: posts, media, a wall, and presentation mode. What is missing is framing plus
one mechanic:

- `occasion.kind: 'tribute'` with a recipient, distinct from a host.
- **Sealed until the day.** An event-level `revealAt`, with posts hidden from everyone but
  their author until it passes — enforced server-side in the wall query **and in
  `firestore.rules`**. A client-side hide would be a lie: guests can read the wall directly,
  and this is the one to test hardest, as a rules test rather than only an e2e.

Kudoboard is an entire business doing roughly this at $6–25 a board. GIF picking is parked.

### 5. Cash and group gifting — only if the click data supports it

Stripe Connect Express, host as merchant of record, application fee, **never a wallet**.
`gifts/{giftId}` with a `contributions/` subcollection, extending `BillingGateway` rather than
starting a parallel payments stack.

Gate this on the registry probe's numbers. It is a three-month bet whose modelled revenue
assumes a guest will send $85 through a site they have never heard of; the probe cost days and
tells you whether that is real.

If it ships: idempotency keys on every charge, velocity limits (gifting is a known
card-testing and laundering vector), disputes disclosed plainly to the host at onboarding
rather than buried, and an accountant on the platform fee's tax treatment **before** it ships.

---

## Cheap things worth doing whenever

- Reactions on posts — small, and the most reliable driver of return visits.
- Occasion-specific wall prompts in config — "share a photo of them from that decade" for a
  40th, "guess the first word" for a 1st birthday.
- ~20 more templates, milestone-weighted. Config rows only. This is the answer to "should we
  run a template marketplace" — see [DECISIONS.md](./DECISIONS.md).
- Guest feedback, weighted over host feedback, since guests are the untapped side. Honest
  caveat: a form yields anecdotes and the funnel yields truth; do not let it substitute for
  measurement.

---

## Later phases, with their flags

### Content safety — `features.safetyScan`, `features.contentReporting`

Cloud Vision SafeSearch on images and sampled video frames at finalize; posts over threshold
enter `state: 'quarantined'`, invisible to members and visible in the console; a member-facing
"report this post"; an appeal trail of who quarantined and who released.

**Done when:** a host never has to be the first line of defence against an image nobody should
have to look at.

Note that the takedown path already exists — a platform admin can remove any post, and the
console can find the event — so this is about not needing a human in the loop, not about
having no answer at all.

### Consent and third-party analytics — `features.ads`, `features.analytics`

Only relevant if the no-ads decision is ever reversed, which needs the evidence named in
[DECISIONS.md](./DECISIONS.md). The seams exist: the flags, the layout hooks, and a wall that
already renders a heterogeneous list.

### SMS and WhatsApp

Blocked on paperwork, not code. One channel adapter, carrier delivery receipts, a global STOP
suppression list, quiet hours and per-plan metering — US SMS costs roughly thirty times what
email does. A2P 10DLC brand and campaign registration and Meta business verification each take
one to three weeks and must be **started before** the code is worth writing.

---

## Deferred, with reasons

**Video transcoding.** Cloud Transcoder normalising to H.264/AAC with an HLS ladder. It adds a
worker service, async "processing" states in the UI, and real per-minute cost — for a product
where a 60-second cap already keeps files playable. `features.transcoding` reserves the seam;
enabling it will not change the storage layout or the post schema.

**Native apps.** The web app handles mobile capture through the file input. A native shell
would improve camera access and background upload, and is not worth it until usage says so.

**An "upgrade viewed" counter.** The one funnel moment that exists only in the browser, so it
needs a client beacon — new write surface for one ratio, when the server-side moments answer
most of the question.

**Wallet passes.** Lock-screen presence on the day, and they update themselves if the venue
moves. Genuinely good; not ahead of anything above it.

**A role-granting UI.** See [DECISIONS.md](./DECISIONS.md) — deliberately unreachable.

## Ideas not yet committed

- Save-the-date, sent before the details are settled — the schema already allows a null date
- Co-hosts, so a wedding is not owned by one person's account
- Seating and meal choices, which is where the wedding market starts paying real money
- Multiple attachments per post (`contentLimits.mediaPerPost` already parameterises this)
- Recurring events reusing a stable code
