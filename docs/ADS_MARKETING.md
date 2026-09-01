# Ads and marketing integration

Written during v1, before any of it is built, so the seams exist while the code is still
shaped by them. Nothing here is live: `features.ads` is `false`, and `features.analytics` was
superseded by the first-party funnel in `analytics.config.ts`.

## Not shipping ads is now a stated promise

The arithmetic below concluded against ads, and that conclusion is now a customer-facing
claim rather than an internal note: `brand.noAds`, on the landing page, the pricing page and
the free plan's own bullets. Evite's free tier is the ad-supported one, so this is the free
tier's whole differentiator — and it was true from the first commit while being said nowhere
a customer could read it.

**The claim is checked, not pasted.** Every surface calls `adFreePromiseHolds()`, which reads
the `ads` flag. If ads were ever switched on, the promise disappears in the same commit that
made it untrue rather than sitting there contradicting the product. `tests/unit/no-ads.test.ts`
asserts both halves: that it holds today, and that it tracks the flag rather than a constant.

Turning ads on is therefore no longer a flag flip. It is a flag flip plus deliberately
retracting a promise from three pages, which is the friction it deserves.

## The constraint that shapes everything

The product's promise is that content disappears. An ad integration that quietly retains
behavioural profiles of guests would break that promise while the UI kept claiming it.

So, three rules:

1. **No third-party script runs before consent.** Not analytics, not ad tags, nothing.
2. **Event content is never an input to targeting.** No pixel sees a photo, a caption, or a
   member list. Sponsor selection may use the event _theme_ and coarse locale — chosen by
   the host, not inferred from guests.
3. **Nothing outlives the event.** Analytics retention is capped below the maximum event
   lifetime plus a margin.

These are worth stating because the alternative is easy to build by accident.

## Where an ad can appear

Two placements, both already expressible in the current layout:

**Wall slot.** The wall is a list of heterogeneous cards. A sponsor card can be interleaved
at a configured interval — the same treatment as a post, visually quieter, always labelled.
No interstitials, no anything that covers content someone is looking at.

**Landing footer.** A single sponsor strip on the marketing page, where there is no personal
content on screen at all.

Deliberately absent: takeovers, autoplaying video ads, ads on the join screen (a person
typing a code is mid-task), and anything on an expired wall.

## Config, when it lands

```ts
// src/config/ads.config.ts
export const adsConfig = {
  slots: {
    wall: { enabled: false, everyNthPost: 8, maxPerSession: 3 },
    landingFooter: { enabled: false },
  },
  provider: 'none', // 'none' | 'direct' | 'gam'
  requireConsent: true, // never make this configurable to false
  labelText: 'Sponsored',
} as const;
```

Following the same rule as the rest of the app: no magic numbers at the call site. A slot
renders only when the flag, the slot, and consent all agree.

## Consent

A banner on first visit, with real choices — accept, reject, and per-category. Rejecting is
one click, the same as accepting.

Consent state lives in `localStorage` (per-viewer, no server round trip) and is re-asked when
the policy version changes. Categories:

| Category      | Covers                     | Default                 |
| ------------- | -------------------------- | ----------------------- |
| `essential`   | session cookie, CSRF       | always on, not a choice |
| `analytics`   | product analytics          | off                     |
| `advertising` | sponsor slots, measurement | off                     |

The gate belongs in one place — a `useConsent()` hook — so no component can render a tag
without passing through it.

## Analytics

A typed event schema, not free-form names, so the funnel stays analysable:

```ts
type AnalyticsEvent =
  | { name: 'event_created'; themeId: string; expiryPresetId: string }
  | { name: 'code_shared'; method: 'copy' | 'share_sheet' }
  | { name: 'event_joined'; role: 'viewer' | 'member'; isAnonymous: boolean }
  | { name: 'post_created'; kind: PostKind }
  | { name: 'guest_upgraded'; provider: 'google' | 'email_link' }
  | { name: 'sponsor_slot_viewed'; slot: 'wall' | 'landing_footer' }
  | { name: 'sponsor_slot_clicked'; slot: 'wall' | 'landing_footer' };
```

No event carries an event title, post body, member name, or join code. That is a property of
the schema, not of care taken at each call site.

Destination: GA4 with consent mode v2, exported to BigQuery for funnel analysis.

## The funnel worth optimising

```
landing view → create started → event created → code shared
                                                    │
                                            code entered → joined → first post
                                                                        │
                                                                guest upgraded
```

Two ratios matter most: **code shared → joined** (does the code actually work socially?) and
**joined → first post** (is the composer inviting enough?). The second is where the hybrid
access model is either paying off or costing us, and it is the number to watch before
loosening `allowAnonymousPosting`.

## Growth surfaces already half-built

- The join code is inherently shareable — a native share sheet on the created-event screen is
  a small addition with an obvious payoff.
- A wall that expires is a natural reason to return. A "your wall expires in 2 hours" email
  would be welcome rather than spam, which is rare.
- Hosts are the acquisition channel. Every guest is a prospective host, and the upgrade
  prompt on the wall is already the highest-intent surface in the app.

## Measurement to add alongside

- **Cost per event.** Storage bytes and egress are already tracked per event in
  `storageBytes`; egress needs a Cloud Monitoring export.
- **Sponsor viewability**, measured with IntersectionObserver rather than assumed from render.
- **Consent rate.** If it is very high, the banner is probably too pushy.
