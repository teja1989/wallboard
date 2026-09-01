# Next actions

**What to do on Monday.** [ROADMAP.md](./ROADMAP.md) says where the product is going and what
is already built; this says what to pick up next and how to know it is done.

Written for somebody with no session history. Every track has a **Done when** you can check
rather than feel. When a track ships, move its summary into ROADMAP's _Shipped_ and delete it
from here — two lists of next actions is how one of them goes stale.

---

## The finding that reframes everything below

Competitive research, August 2026:

|                | Price                                                            | Ads                                         |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| **Partiful**   | **$0, everything included**                                      | **None.** $27.3M raised, not monetising yet |
| Evite          | Free (ad-supported); premium $17.99–$99.99/event; Pro $249.99/yr | Yes, on free                                |
| Punchbowl      | $3.99–$15.99/mo                                                  | Yes, on some **paid** tiers                 |
| Paperless Post | ~$0.50–$1.44 **per guest** — ~$75–216 for a 150-guest wedding    | No                                          |
| **Marquee**    | $19/event · $79/yr                                               | None                                        |

**"No ads" is no longer a differentiator.** It is currently our loudest claim, on the landing
page and the pricing page. It beats Evite and does nothing against Partiful, who are free,
ad-free, and the ones actually taking share. The claim is true and worth keeping — it just
cannot carry the positioning.

**The differentiator we already have and barely say: no per-guest fees.** Paperless Post
charges $75–216 for the wedding we charge $19 for. That is 4–11×, verifiable, and aimed at the
pricing model that actually hurts a host.

**Why Partiful does not take the segment we want.** Their ceiling is structural, not a backlog
item: _Going / Maybe / Can't Go is the entirety of their guest data_ — no dietary needs, no
custom question, no adults/children split, no private note to the host. Reviewers call the
aesthetic wrong for weddings, corporate and formal events; there is no seating or complex event
management, no payment collection beyond a Venmo link, and guests must hand over a phone number
to RSVP. Marquee has every one of those already.

> **Partiful for a house party. Marquee for the event where the details matter.**

Segment: the **50–250 guest grown-up event** — weddings, milestone birthdays, memorials,
corporate. Not the casual party market; Partiful has the funding and the network effects there
and their free tier cannot be undercut.

---

## Done since this was written

**Invitation surfaces.** Every template was one flat two-stop gradient plus a 120×24 line
divider, so fifteen designs differed only in four colours. Each now carries a `surface` — a
decorative field drawn as inline SVG from its own palette, with slow motion where the occasion
suits it: `bloom`, `arcs`, `dusk`, `sparkle`, `drift`, `linen`, `none`
(`src/components/event/template-surface.tsx`).

Three rules hold it together, and the second is the one worth keeping:

- Nothing in a surface is information — the whole field is `aria-hidden` and the invitation
  reads identically without it. Email and the OG image draw their own thing and never import it.
- **The occasion overrides the template on motion.** Three templates are `occasions: null`, so
  a memorial can choose them; `surfaceMoves(surface, somber)` resolves it at render, and
  `config.test.ts` asserts that no template animates on a somber occasion. A memorial notice
  with confetti drifting down it is the worst thing this product could do, and it was one
  config row away.
- Motion is CSS on `transform`/`opacity` only, in `globals.css`, so the existing global
  `prefers-reduced-motion` rule stops all of it at once with no per-component opt-in to forget.

This is groundwork for Track 1a below rather than a substitute for it: the landing page still
shows no invitation at all. What it does mean is that when the page does show one, there is
something worth looking at.

---

## Track 1 — Make the site show the product

**Why this is first.** `src/app/page.tsx` is 341 lines and contains **not one image of the
product it is selling**. The occasions are ten emoji chips. Every competitor shows the
invitation; we describe it.

And there is a sharper reason than aesthetics: **the attribution link on every invitation is
currently the only organic channel this product has.** Every guest who taps "made with Marquee"
lands on that text page. This is not speculative polish — it is the conversion surface for the
one growth loop that already exists.

### 1a. Render the real invitation, not a picture of one

`<Invitation>` already exists and already renders live in the create preview. Put it on the
landing page with demo events built from config.

- New `src/config/showcase.config.ts` — three or four complete `EventDoc` fixtures (a 40th, a
  wedding, a retirement, a memorial) with real dates, venues and host names.
- Hero shows one; a scroll section fans through the rest.
- **Because it is the real component, the marketing page cannot drift from the product.** A
  screenshot goes stale the first time a template changes; this never can — and every new
  template improves the landing page for free.

### 1b. The ease story, told as three moving steps

_Creating and managing is easy_ is the right message for this segment, and it is currently a
heading ("Three things, one link, no chasing") with no demonstration under it.

A scroll-driven sequence showing the real arc: **type a title → the card builds itself → add
guests → watch replies land.** Reuse the real `Invitation`, `SocialProof` and delivery-status
components, so every frame is the true UI.

**Animation constraints, which are real here:**

- **CSS transforms and opacity only — no animation library.** `script-src` is nonce +
  `strict-dynamic` with no `unsafe-inline` (`src/proxy.ts`), and a heavy JS bundle hurts LCP on
  Cloud Run cold starts, which will matter the moment SEO does.
- `globals.css:170` already kills every animation under `prefers-reduced-motion`. The new work
  inherits that for free — but check it, do not assume it.
- Reveals via one small `IntersectionObserver` client component, or CSS
  `animation-timeline: view()` where supported. **Content must be present and readable with JS
  disabled.**

### 1c. Say it with confidence

The pricing page currently hedges — "free while we are in preview", "this page is what pricing
will look like". Honest, and it reads as tentative. There is a version that is both.

- Lead with **"Flat $19. No per-guest fees."** and show the comparison plainly.
- Demote no-ads from headline to supporting line.
- Landing hero leads on **ease plus capability**: a minute to make, and it asks the questions a
  real event actually needs answered.
- **Re-target or drop the $79 tier.** Nobody in the consumer segment hosts 25 events a year. A
  tier with no plausible buyer makes the whole page less credible.

**Done when:** the landing page renders a real `Invitation` above the fold; the three-step
sequence is legible and complete with animation disabled _and_ with JS disabled; the pricing
page leads on the flat-fee comparison; Lighthouse LCP has not regressed against the current
page.

**Files:** `src/app/page.tsx`, `src/config/showcase.config.ts` _(new)_,
`src/components/marketing/*`, `src/app/globals.css`, `src/app/pricing/page.tsx`,
`src/config/plans.config.ts`, `src/config/branding.config.ts`.

---

## Track 2 — Expand the occasions

Cheap, high-leverage, and it directly widens the market. An occasion is config: wording, RSVP
prompt, wall prompt, template shortlist, `giftsExpected`, `somber`.

Ten today. Add what the chosen segment actually hosts: **engagement party, anniversary,
retirement, housewarming, bridal shower, christening/naming, farewell, holiday party,
fundraiser/gala, bar/bat mitzvah, quinceañera.**

Two things make this more than a list:

- Each new occasion needs its **planning template** in `planning.config.ts` and a template
  shortlist, or it inherits generic wording and the feature gets _worse_ as it widens.
- **Retirement and farewell are the bridge to the tribute board** (Track 6). Adding them now
  makes that a natural extension rather than a new product.

Templates: 19 today, all code-drawn config rows. More cost nothing but config, and every one
improves Track 1a automatically. This is the answer to "should we run a template marketplace" —
see [DECISIONS.md](./DECISIONS.md).

**Done when:** every new occasion has complete wording, a planning template and a template
shortlist, asserted in `tests/unit/config.test.ts` the way the existing ten are; no occasion
falls back to generic copy.

**Files:** `src/config/occasions.config.ts`, `src/config/planning.config.ts`,
`src/config/templates.config.ts`, `tests/unit/config.test.ts`.

---

## Track 3 — AI invitation drafting

The sharpest point of the ease story: **type three words, get an invitation.** Attacks
blank-page paralysis, the top create-flow dropoff in every content product, and it is
demonstrable on the landing page from Track 1.

- New `src/config/ai.config.ts` — model, effort, token caps, per-occasion framing, every
  user-visible string. Invariant 6: nothing inline.
- New `src/lib/ai/client.ts` — `@anthropic-ai/sdk`, `claude-opus-5`, `thinking: {type:
"adaptive"}`, `output_config: {effort: "low"}` (short structured copy, not reasoning work),
  `output_config.format` for a typed `{title, description, wallPrompt}`.
- New `POST /api/events/draft` — `requireIdentifiedActor`, Zod-validated, rate limited
  (`aiDraftPerUser`), audit-logged. **No event id**: it runs before the event exists.
- `ANTHROPIC_API_KEY` optional in `env.config.ts`; `features.aiDrafting` **false by default**,
  on only where the key is present. The form must work identically with AI off — the same rule
  `places` already follows.
- UI: "Draft it for me" fills the fields as **editable text**. Never auto-submits. The host's
  words always win.

~$0.01–0.02 per draft; the rate limit is a spend cap as much as an abuse control. It will
sometimes write something bland, which is why it drafts into fields rather than publishing.

### The measurement gap this must close

`FUNNEL_EVENTS` starts at `inviteSent`. There is **no `eventCreated` and no create-started
counter**, so the create flow — the highest-value step we own — is entirely unmeasured, and
anything shipped into it is unfalsifiable. Add `eventCreateStarted` and `eventCreated` plus a
`funnelRatios` row, or we repeat exactly the mistake the funnel work existed to prevent.

**Done when:** create-started → created is a visible ratio in the operator console; the draft
route refuses cleanly (not a 500) with the flag off; a failed or slow draft leaves the create
form fully usable.

**Files:** `src/config/ai.config.ts` _(new)_, `src/lib/ai/client.ts` _(new)_,
`src/app/api/events/draft/route.ts` _(new)_, `src/config/analytics.config.ts`,
`src/app/api/events/create/route.ts`, `src/app/create/page.tsx`,
`src/lib/validation/schemas.ts`, `src/config/{features,env,limits}.config.ts`,
`infra/terraform/secrets.tf`.

---

## Track 4 — Turn revenue on

**The thing that converts all of the above into a business, and it has been deferred for
several sessions.** Full detail in [ROADMAP.md](./ROADMAP.md#before-billing); the order:

1. **Archive verification on production, by hand.** One real event: post a photo, download the
   zip, open it. The Cloud Run URL-signing credential path differs from the emulator's, so no
   automated run settles it. **This one cannot be done by an agent.**
2. **Resolve `vanityLink`** — build it or strike it from the Pro plan's claims. Do not launch a
   paid tier with an untrue bullet on it.
3. Stripe keys via `secrets.tf` (a `for_each` key may not derive from a sensitive value);
   verify checkout → webhook → `events/{id}.plan` in test mode; assert an **unsigned** webhook
   is rejected.
4. Apple Pay / Google Pay / Link on in Checkout.
5. Flip `features.billing`, with the stamp regression test run before and after.

**Done when:** a real card has been charged in test mode, the webhook has stamped a plan, and
an unsigned webhook was refused.

---

## Then

**5. The post-event ask.** Low-res copies of photos a guest appears in, free, with "make one of
your own" on that screen. The only compounding growth loop this product has, at the only moment
a guest wants something from us. Explicitly **not** referral discounts — this category is
occasion-triggered, and "give $5 get $5" does not fire when nobody is having a birthday.

**6. The tribute board.** A retirement, a leaving do, a milestone — people leaving messages,
audio and video for one recipient. Most of it exists: posts, media, wall, presentation mode.
Missing: `occasion.kind: 'tribute'` with a recipient distinct from a host, and **sealed until
the day** — an event-level `revealAt` with posts hidden from everyone but their author until it
passes, enforced in the wall query **and in `firestore.rules`**. A client-side hide would be a
lie: guests can read the wall directly. Test that as a rules test, not only an e2e. Kudoboard
is a whole business doing roughly this at $6–25 a board. GIF picking is parked.

**7. Discoverability.** No sitemap; `robots.txt` correctly closes everything but four marketing
pages. Occasion landing pages (`/for/40th-birthday`) are the honest version — real content that
Track 2 writes most of as a side effect.

**8. Upload your own design.** The most-requested gap versus Paperless Post and Evite, and a
natural paid-tier feature. It does **not** contradict the no-marketplace decision — that was
about third-party _distribution_; this is user-supplied media. Two costs to accept first: a
host-uploaded image renders on a **public, unauthenticated** page and becomes the OG image in
group chats — the highest-risk content surface in the product, with `features.safetyScan` off
and nothing behind it, so ship the scan first or restrict this to paid accounts where there is
a card and a chargeback trail; and text over an arbitrary photo breaks the 4.5:1 contrast the
palettes guarantee, so it needs a scrim system, not just an image slot. Also needs a new
`storagePaths` entry — everything today is post-scoped.

**9. The RSVP digest — the AI feature I would build second.** Turns the free text in
`rsvpNotes/` into "32 coming · 2 vegetarian, 1 nut allergy, 1 step-free access · 6 haven't
replied". Built on data **Partiful structurally cannot collect**, which makes it the one AI
feature that is also a moat. Deferred, not dropped.

**10. Cash and group gifting — only if the registry click data supports it.** Stripe Connect
Express, host as merchant of record, application fee, **never a wallet**. Gate on the probe's
numbers: it is a three-month bet whose modelled revenue assumes a guest will send $85 through a
site they have never heard of.

**11. The organiser segment.** Venues, schools, HR and social committees, community groups —
the only persona that hosts 20+ events a year and will pay annually, and **co-hosts is exactly
what a committee needs**. This is where an annual tier belongs. Do not start it until the
consumer funnel has numbers.

---

## Honest caveats

- **A beautiful page nobody visits converts nobody.** Track 1 earns its place because of the
  attribution loop, not as a substitute for distribution. Track 7 is what makes it compound.
- **Animation is where "attractive" becomes "slow".** Every frame must survive reduced-motion,
  a cold start, and a mid-range phone. If a section only works as an animation, it is not
  finished.
- **Velocity is the standing risk.** Roughly ten features have shipped recently against zero
  users, zero revenue, and an archive check that has gated billing for several sessions. This
  plan front-loads the shop window because that is defensible; it must not become another
  reason to defer Track 4.
- **"Grab the market" is not on the table,** and planning for it costs you the plan that is.
  The winnable ground is the segment Partiful has explicitly abandoned.
- **AI belongs where it removes measurable friction, not everywhere.** Of four candidates, one
  earns its place now (Track 3), one is a moat worth building next (item 9), one is
  narrow-or-nothing (venue logistics — the broad "suggest vendors" version needs a dataset we
  do not have and is an on-ramp to affiliate spam that contradicts the no-ads promise), and one
  is refused: summarising the event _for guests_, who are reading a card with a date and a
  place on it. There is nothing to summarise.

---

## Verification

Per `.claude/skills/marquee-dev/`, against a **production build** on the emulators — the full
gate, not a subset:

- `npm run typecheck && npm run lint && npm test`
- `npm run test:rules` — Track 3's counters touch `funnel/`; Track 6's `revealAt` is a rules
  test first and an e2e second.
- `npm run smoke` — the draft route at every role: signed-out 401, code-only guest 403, host
  200, 429 at the limit, clean refusal with the flag off.
- `npm run test:e2e` — the landing page renders a real invitation; every hero and step section
  is readable with animation disabled; the draft fills fields as editable text and does not
  submit; the dark-mode-no-console-errors sweep still passes.
- Lighthouse on the landing page before and after Track 1. If LCP regresses, the animation is
  wrong, not the budget.
- `.claude/skills/marquee-security/` before merging Track 3 — new route, new outbound
  dependency, new secret — and before Track 8, which changes what a public page can render.
