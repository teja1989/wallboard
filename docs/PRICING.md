# Pricing and the business case

Nobody is being charged yet. `features.billing` is `false`, every event runs on
`previewPlanId`, and the pricing page says so. This document is the reasoning behind the
numbers so that turning billing on is a decision rather than a guess.

## The model

Two ways to pay, because hosts come in two shapes.

| Plan          | Price          | For                                                                                                         |
| ------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Free**      | —              | A get-together this weekend. 25 guests, 7-day wall, four themes.                                            |
| **One event** | **$19** once   | The wedding, the big birthday. 250 guests, 30-day wall, every theme, RSVP notes, guest export, no branding. |
| **Pro**       | **$79** / year | People who host constantly. 500 guests, 90-day walls, 25 live events, 20 GB per event.                      |

Asking a once-a-year wedding host to take a subscription is how you lose them to a
competitor's one-off. Asking a monthly supper-club host to pay per event is how you make
them resent you. So: both.

### Why $19

Evite Premium runs roughly $15–$250 per event depending on guest count. Paperless Post uses
a coin system that works out similar and is famously confusing. Both charge _more for more
guests_.

$19 flat sits just under Evite's mid-tier, is a single obvious number, and lets the pitch be
"no per-guest fees, ever" — which is the clearest differentiator available in this category
and costs us almost nothing, because guest count is not what drives our costs. Storage is.

### Why $79/year

Roughly four events' worth. A host doing five or more a year is better off, and that is
exactly the person we want on a subscription. Below that, the one-off is genuinely the
better deal for them, and saying so builds more trust than it costs in revenue.

### Why guest count is not the meter

Because it is not the cost. A 400-guest event where nobody posts costs less to run than a
40-guest wedding with 900 photos and an hour of video. Charging on guests would be charging
on the wrong axis _and_ punishing the popular events we most want people to run here.

Storage and wall lifetime are the real cost drivers, so those are what the plans actually
differ on — 500 MB / 7 days, 5 GB / 30 days, 20 GB / 90 days.

## Unit economics, roughly

Per event, at Cloud Storage standard rates:

| Plan            | Storage cap     | Storage cost at cap | Egress (est.) | Total      |
| --------------- | --------------- | ------------------- | ------------- | ---------- |
| Free            | 500 MB × 7 days | ~$0.003             | ~$0.05        | **~$0.05** |
| One event       | 5 GB × 30 days  | ~$0.10              | ~$1.50        | **~$1.60** |
| Pro (per event) | 20 GB × 90 days | ~$1.20              | ~$6.00        | **~$7.20** |

Egress dominates, and it scales with how many guests actually watch — which is why media
URLs are short-lived and minted per request rather than cached publicly. Cloud Run scales to
zero, so an idle event costs storage only.

Gross margin at $19 looks like ~90%. A Pro subscriber stays profitable to about ten heavy
events a year, which is comfortably above where most will land. **The number to watch is
egress per event**, not signups — it is the only line that could quietly invert this.

## Where the money actually comes from

The upgrade moment is not the pricing page. It is the create form, when a host who is
already invested in one specific event sees a theme they want and it has a small lock on
it. That is why premium themes are **shown and disabled** rather than hidden: a theme nobody
can see is a theme nobody upgrades for.

Two ratios matter more than traffic:

1. **Code shared → guest joined.** Does the code work socially? If people are not sharing
   it, nothing else matters.
2. **Joined → first post.** Is the wall inviting enough to convert a replier into a poster?
   This is where the hybrid access model either pays off or costs us, and it is the number
   to check before loosening `allowAnonymousPosting`.

## What an event is allowed to do is decided once, at creation

The plan on `events/{id}.plan` is the answer, and it is never recomputed. `planForNewEvent()`
resolves the most generous of three things — the host's subscription, preview pricing while
`features.billing` is off, and any active promo — and writes it down.

This used to work the other way round: `effectivePlanId()` returned the preview plan for every
event at read time while billing was off. It read plausibly and was a dated landmine. Every
event in the database was stamped `free` and merely _behaving_ as pro, so switching billing on
would have dropped every live event to 25 guests and a seven-day wall and revoked
`archiveDownload` — mid-event, with no migration and no warning.

The rule that replaced it is worth stating plainly, because promos and paid upgrades both
depend on it: **what an event may do is a fact recorded when it was created, not a rule
evaluated now.** Global state may change what the _next_ event is granted. It may never change
what an existing one was promised.

### Promotional windows

`src/config/promos.config.ts` holds them, and the table ships empty. A promo raises the plan a
new event is stamped with, for a window, optionally scoped to particular occasions — and it
grants at creation only. Events created inside the window keep what they were given, for good;
events after it do not. Anything that reached back and changed live events would be the same
landmine wearing a friendlier name.

A promo also has **real costs**, unlike a discount on software: granting `event` means 5 GB for
30 days for every event created in the window, whether or not the host returns. The window
length is the only thing bounding that, so keep it short. The promo id is written to the audit
log at creation, so it is possible to answer afterwards whether it bought anything.

## Turning billing on

The gates are already written and tested; the switch is `features.billing`.

**First, run the backfill.** `npm run backfill:plans` stamps every event created before the
change with the plan it has actually been running on. It is dry by default, idempotent, and
only ever moves an event up. Skipping it means every pre-existing event drops to `free` the
moment the flag flips.

Then the payment path:

1. Stripe Checkout for the one-off; Stripe Billing for the subscription.
2. A webhook that sets `events/{id}.plan` on a successful one-off payment, and a plan field
   on the user for subscriptions. `planForNewEvent()` in `events.ts` is where the latter
   attaches — deliberately a single function.
3. An upgrade screen inside an existing event, since upgrading after sending must keep the
   same link and code. Nothing in the data model prevents that today.
4. Refund policy: full refund before the first guest replies. Cheap to honour, and it
   removes the main reason someone hesitates on a $19 impulse purchase.

Do not turn billing on before the archive download works. It is the single feature that most
justifies the price, because it is the answer to "what happens to my photos" — and that is
the question that decides whether people trust us with the event at all.

## Deliberately not doing

- **Per-guest pricing.** Wrong axis, punishes the events we want.
- **A free trial of Pro.** The one-off already serves as the trial, and it converts better
  because it is attached to a real occasion rather than a countdown.
- **Charging guests anything, ever.** A guest who hits a paywall on someone else's
  invitation is a guest who thinks less of the host. That would poison the referral loop the
  whole business depends on.
- **Ads on the free tier, for now.** See `ADS_MARKETING.md`. The free tier's job is to make
  hosts, and hosts become customers; monetising their guests' attention directly would earn
  pennies and cost the thing that actually works.

## Running a promo

Promos are a config table, not a console. A window has real costs — granting the `event` plan
means 5 GB for 30 days per event created in it, billed whether or not the host returns — so it
belongs in a commit somebody reviewed rather than behind a button at 2am.

To run one, add an entry to `promos` in `src/config/promos.config.ts` and push. The deploy is
automatic on the working branch, so the round trip is a couple of minutes.

```ts
export const promos: readonly Promo[] = [
  {
    id: 'launch-week',
    label: 'Launch week',
    grantsPlanId: 'event',
    startsAt: Date.UTC(2026, 8, 1),
    endsAt: Date.UTC(2026, 8, 8),
    // Null for everyone. Naming occasions makes it an experiment rather than a discount.
    occasions: ['birthday', 'graduation'],
  },
];
```

**Keep the window short.** It is the only thing bounding how many grants go out; the plan's
own lifetime bounds what each one costs.

What a live promo does, once it is there:

- **The pricing page** carries a banner naming it, and says what it is limited to when it is
  scoped. Resolved per request, so opening a window does not wait on a rebuild.
- **The create form** already asks `grantedPlanForNewEvent`, so themes and expiry options that
  the promo unlocks are selectable while it runs.
- **The screen after publishing** explains the upgrade — "One event is on us for this one".
  Without that a host reads a free upgrade as a billing mistake.
- **The audit log** records the promo id against `event.create`, which is what makes "did that
  window produce retained hosts or just cheap events" answerable afterwards.

A grant is stamped on the event at creation and never revisited. When the window closes,
events made inside it keep what they were given — see `entitlements.ts` for why anything else
would be the dated landmine that shipped once already.
