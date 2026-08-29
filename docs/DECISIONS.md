# Decisions

Why this product is shaped the way it is.

Every other document here says **what** the code does. This one says **why**, because the
reasons are the part that gets lost — they live in code comments beside the thing they
justify, and nobody reads a comment on a file they were not already editing. A decision whose
reason has been forgotten is a decision that gets quietly reversed by the next person trying
to be helpful.

**How to use this file.** Section 1 is settled: reversing one of these needs new evidence, not
a fresh opinion, and the entry says what evidence would count. Section 2 is genuinely open —
argue freely. Section 3 is the list of things that look like oversights and are not; check it
before "fixing" something that seems obviously wrong.

Add to it when you make a call somebody could reasonably make differently. Do not add routine
implementation choices — this stops being read the moment it becomes a changelog.

---

## 1. Settled

### No ads, on any plan, ever

The arithmetic: roughly 150 pageviews per event at a $2–6 CPM is **$0.30–0.90 per event**. One
$19 upgrade is worth twenty to sixty events of ad revenue. Ads would earn rounding-error money
while costing the positioning that makes $19 defensible in the first place, and they
contradict the promise that the event disappears.

This is now a **stated promise**, not just an absence — `brand.noAds` on the landing page and
the pricing page, and a test asserts the claim and the flag cannot disagree. That makes it
more expensive to reverse than a config change, which is intentional.

Reverse only if: the paid conversion rate is measured, over real volume, and is low enough
that the product cannot fund itself any other way. `features.ads` reserves the seam.

### The plan is stamped on the event at creation, never derived from global state

`planForNewEvent()` resolves the account plan plus any promo grant once and writes the answer
to `events/{id}.plan`. `effectivePlanId()` reads the stamp.

Before this, entitlements were derived from present global state, which meant flipping
`features.billing` on would have retroactively downgraded **every existing event** — live
walls shortening from 30 days to 7 and hosts' photos becoming unkeepable, mid-party, with no
action on their part. The same bug wearing a friendly hat is a promo that opens everything up
for a week and then closes on people still using it.

A grant is a fact recorded at a moment, not a rule evaluated later. Anything that mutates the
entitlements of a live event reintroduces this.

### Guests are the traffic; hosts are the customers

One host, ten to two hundred guests. Guests are ~95% of pageviews and have near-zero natural
purchase intent — they arrive to answer one question and leave in under a minute.

So "convert page visits to sales" is the wrong target, and optimising guest pageviews degrades
the invitation for the only person with a wallet open. That is precisely the trap Evite fell
into. The three moments of real intent are the host at publish, the guest immediately after
"Going", and everybody the day after, when the photos exist.

### Measurement is first-party, server-side, and aggregate only

Sums per event per day. No third-party script, no pixel, no per-visitor row, nothing that
outlives the event. Every increment fires from a route handler, so a client cannot forge its
own numbers, and every one is best-effort — measuring an RSVP must never be able to stop one.

The constraint is worth defending rather than relaxing later: the moment a row exists per
visitor, the product is keeping a behavioural record of the guests at somebody's wedding, and
the promise that the event disappears becomes something we would have to carefully qualify.
Sums cannot be de-anonymised, so there is nothing to qualify.

### No template marketplace — add config rows instead

A template is ~15 lines of config: a layout id, a face, a motif, four colours, occasion tags,
a premium flag. Third parties cannot ship code (CSP, XSS, maintenance), so a marketplace means
first inventing a constrained declarative format _and_ a review pipeline — a platform
investment, not a feature. Marketplaces are the hardest thing in commerce to bootstrap, and at
this scale a designer would earn pocket change, so no supply would arrive. Selling templates
to the free tier also cannibalises the $19 plan, whose main hook is the premium templates.

Because templates are code-drawn, twenty more cost nothing but config rows. Same variety, no
supply side, no review pipeline.

### Never hold funds

If gifting ships, the host is merchant of record through Stripe Connect Express and we take an
application fee. The moment money sits in an account we control, this is money transmission,
with the licensing that implies in every US state. Do not build a wallet.

Related and settled: **no open-loop prepaid cards** (0–2% margin, program manager with volume
minimums, KYC/AML, CARD Act, state escheatment — worst margin, heaviest regulation), and
**card data never touches our servers** (PCI SAQ-A holds only via Stripe Checkout or Elements
with tokenisation; never a custom card form).

### Registry links before cash gifting

The gift list is a probe, not a product. It costs days and answers the question the whole
gifting thesis rests on: will guests on an invitation click through to buy something? Cash
gifting is a three-month build whose modelled revenue assumes a guest will send $85 through a
site they have never heard of — **trust is the binding constraint there, not code**.

If the click data does not support it, Track D does not get built. That is the point of
building the probe first.

### There is no "opened" in the delivery ladder

`queued → sent → delivered → seen → replied`. Apple Mail Privacy Protection prefetches images
for a large share of recipients, so an open pixel measures Apple rather than a person. Telling
a host that forty guests opened their invitation when the truth is unknowable is worse than
telling them nothing.

"Seen" comes from a beacon on the invitation page, not from a redirect or a server-side fetch,
because **mail scanners fetch every URL in a message** before a human sees it.

### Calendar times are UTC, not `TZID`

A `TZID` is only legal alongside a `VTIMEZONE` block spelling out that zone's daylight-saving
rules, and hand-rolling those means shipping a copy of the zone database that goes stale. A
UTC instant is unambiguous and lands at the right moment for a guest reading it anywhere.

(Distinct from `event.timeZone`, which is stored and very much needed: without it every reader
saw the start time converted into their own zone, and email rendered on a UTC server told
everybody the wrong time.)

### The occasion decides whether gifts are asked for — not the host, and not the plan

`occasion.giftsExpected`. A work offsite and a memorial never ask anybody for anything.

Putting the gift list behind a paywall would mean the only invitations asking guests for money
are the ones we were already paid for, which is a worse look than not shipping it.

### Reminders claim their slot before sending, not after

A cron that recorded a send afterwards would double-send whenever a run died mid-flight. A
duplicate nudge costs more than a missed one: it burns a guest's goodwill and the sending
reputation that every host here shares. A claimed-then-failed slot deliberately stays claimed.

### The operator console reads; the one thing it writes is suspension

`admin:manageFeatureFlags`, `admin:grantRole` and `admin:purgeStorage` are declared, enforced,
and deliberately unreachable. A flag belongs in a commit somebody reviewed, not a console
toggle at 2am. A console that can rewrite authorization is a far larger security surface than
one that can read and suspend, and the single operator arrives through `OWNER_EMAILS`.

`tests/unit/admin-console.test.ts` fails if any of the three quietly grows a route. Wiring one
is a real decision, not a convenience.

---

## 2. Deliberately open

Argue these freely. They are unresolved on purpose, usually because the evidence to resolve
them does not exist yet.

| Question                                               | What would settle it                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the paywall sits, and what the $19 tier includes | Real conversion data. Plan resolution is a stamp plus a config table, so moving the paywall is a config change rather than a rewrite — which is what makes deferring this safe.                                                                                                                   |
| Whether cash gifting is worth building                 | Gift-link click-through, from the registry probe already shipped.                                                                                                                                                                                                                                 |
| Whether the free tier's limits are right               | Free-tier hosts converting, versus free-tier events carrying the attribution mark that brings the next host in.                                                                                                                                                                                   |
| Whether suspension should keep reads working           | Currently a full API lockout — see section 3. A product call, not a technical one.                                                                                                                                                                                                                |
| SMS and WhatsApp                                       | Blocked on paperwork, not code: US A2P 10DLC brand and campaign registration and Meta business verification each take one to three weeks and must start before the adapter is worth writing. US SMS also costs roughly thirty times what email does, so it needs per-plan metering.               |
| The wishes / tribute board                             | Agreed as the next product direction, deliberately after the RSVP work is finished. Needs `occasion.kind: 'tribute'`, a recipient, and a `revealAt` enforced in `firestore.rules` — a client-side hide would be a lie, since guests can read the wall directly. GIF picking is explicitly parked. |

---

## 3. Looks like a bug, is a choice

Check here before fixing something obviously wrong.

**A suspended account is refused reads too.** `can()` keeps read permissions for a suspended
actor, but `requireActor()` throws several layers earlier, so no route reaches that rule. The
matrix rule is defence in depth for any future call site that resolves an actor another way.
`docs/SECURITY.md` used to describe the matrix rule as the behaviour, which read as more
permissive than the code — corrected. If you want reads to survive suspension, that is a
product decision and needs the API changed, not the doc.

**The planning board writes nothing until the host touches it.** A read renders the occasion's
template from config with ids like `template:{key}`; the first mutation materialises the whole
template and then applies itself. So a host who never opens the tab has nothing written on
their behalf, and the seeded wording stays editable in config right up until somebody uses it.
`templateKey` is what keeps the seed idempotent.

**The funnel rollup is N+1 by choice.** Reading each event's `funnel` subcollection in sequence
avoids a collection-group index, which would be a standing invitation to query per-event
counters in ways the no-identifiers design does not want.

**`invitationOpened` can exceed `inviteSent`.** It counts opens, not openers, and a forwarded
link is an open with no send behind it. The console explains it rather than clamping it — a
ratio over 100% there is real information about links travelling beyond the guest list.

**A milestone's `live` numbers are never stored.** Headcount, outstanding replies and the venue
are resolved at render from the event in hand, so they cannot go stale and cost no extra read.

**`registry.clickCount` is duplicated in the funnel.** They answer different questions: the
funnel says whether guests click at all, the per-link count says which of the host's links they
clicked.

**`inviteeIds` on the send route only ever narrows.** It filters the list the server reads for
itself, and every eligibility rule — unsubscribed, already sent, already replied, inside the
reminder cooldown — still runs on whatever survives. So naming a guest sends to _fewer_ people;
it is never a way to reach somebody the rules exclude, and an id that is not on this event's
list matches nothing. Absent means "everyone eligible", which is what the bulk button does. An
empty array is rejected rather than treated as either.

**Post deletion is soft.** `state` becomes `removed` and `body`/`media` are cleared, but the
bytes are destroyed immediately and the document survives — so moderation stays reviewable and
the audit trail points at something real.

**`vanityLink` is sold on the Pro plan and not implemented.** Known and flagged in
`plans.config.ts`. `/e/` is the wrong surface for it. It should either be built or removed from
the plan's claims before billing is turned on.

**`features.presentationMode` is `true` and is implemented at `/e/{eventId}/present`.** A full-screen
ambient projector view with auto-cycling media spotlight, keyboard shortcuts, and live corner QR code
for guests to scan and post in real time.

---

## 4. Conventions that are load-bearing

These are in `CLAUDE.md` as invariants. The reasons, briefly, because invariants without
reasons get "simplified":

- **No client writes to Firestore.** Rules cannot check an entitlement, cannot consume a
  rate-limit token, and cannot write an audit entry. A route handler does all three.
- **`can()` is the only place a permission is decided.** Two places means two answers, and the
  one that drifts is always the server.
- **Entitlements are not permissions.** `can()` answers who you are; `entitlementsFor()`
  answers what was paid for. Merging them makes a paywall an admin accidentally bypasses, or a
  permission a payment grants.
- **Config is the single source of every tunable.** A literal in a component and a literal in a
  handler are two numbers that will disagree, and the client will show one while the server
  enforces the other.
- **An update schema has no defaults anywhere.** `.partial()` does not undo `.default()`, so a
  "partial" update parses an absent key into its default and the handler writes it over
  whatever was there. This has caused four separate data-loss bugs in this repo. Define the
  field once and build two schemas from it.
