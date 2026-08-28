import {
  absoluteMaxEventLifetimeMs,
  activePromo,
  bestPlan,
  eventCeilings,
  expiryPresets,
  isEnabled,
  isPremiumTemplate,
  planById,
  plans,
  previewPlanId,
  type Entitlements,
  type ExpiryPresetId,
  type PlanId,
} from '@/config';

/**
 * Entitlement resolution — the one place that answers "is this host allowed to do that?"
 * for anything money-shaped.
 *
 * Pure and dependency-free, like the permission engine, so it runs on the server, in
 * client components, and in tests. Permissions answer *who you are*; entitlements answer
 * *what you have paid for*. Keeping them apart stops either from quietly becoming the
 * other's escape hatch.
 */

/**
 * The plan an event actually runs on: the one stamped on it, and nothing else.
 *
 * **It used to consult the global billing flag**, returning `previewPlanId` for every event
 * while billing was off. That read plausibly and was a dated landmine. Every event in the
 * database is stamped `free` — `planForNewEvent()` wrote the host's account plan — and was
 * merely *behaving* as pro. The instant `features.billing` flipped true, every live event
 * would have dropped to 25 guests and a seven-day wall and lost `archiveDownload`: hosts
 * mid-event watching their wall shorten and their photos become unkeepable, with no
 * migration and no warning.
 *
 * The generalisation is worth stating, because it is the same mistake promos invite: **what
 * an event is allowed to do is a fact recorded when it was created, not a rule evaluated
 * now.** Preview pricing, a promotional window and a paid upgrade are all decided at
 * creation and written down. Global state may change what the *next* event is granted; it
 * may never change what an existing one was promised.
 *
 * An unrecognised plan resolves to `free` via `planById`, so corrupt data costs the platform
 * nothing rather than handing out a Pro account.
 */
export function effectivePlanId(storedPlanId: string): PlanId {
  return planById(storedPlanId).id;
}

export function entitlementsFor(planId: string): Entitlements {
  return clampToCeilings(planById(effectivePlanId(planId)).entitlements);
}

/**
 * What the create form should show as available, before an event exists to ask about.
 *
 * The form used to hardcode `free` and rely on `effectivePlanId()` widening it at read time.
 * With that override gone the form would grey out every premium theme while the server
 * happily accepted them — a UI that disagrees with its own server, which is the exact failure
 * invariant 6 exists to prevent.
 *
 * So it resolves the same grants `planForNewEvent()` does, minus the one it cannot know from
 * the browser: the host's own subscription. That asymmetry is deliberate and safe in the only
 * direction that matters — the server takes the *most generous* of account plan, preview and
 * promo, so this can under-offer but never offer something creation would then refuse.
 */
export function grantedPlanForNewEvent(occasionId: string, now: number = Date.now()): PlanId {
  let planId: PlanId = 'free';
  if (!isEnabled('billing')) planId = bestPlan(planId, previewPlanId);

  const promo = activePromo(occasionId, now);
  if (promo) planId = bestPlan(planId, promo.grantsPlanId);

  return planId;
}

/**
 * No plan may promise more than the platform can serve. A ceiling breach is a config
 * mistake rather than a user action, so it is clamped rather than thrown — a host should
 * not see an error because someone mistyped a number in a plan table.
 */
function clampToCeilings(entitlements: Entitlements): Entitlements {
  return {
    ...entitlements,
    maxGuests: Math.min(entitlements.maxGuests, eventCeilings.maxMembersPerEvent),
    maxPostsPerEvent: Math.min(entitlements.maxPostsPerEvent, eventCeilings.maxPostsPerEvent),
    maxStorageBytesPerEvent: Math.min(
      entitlements.maxStorageBytesPerEvent,
      eventCeilings.maxStorageBytesPerEvent,
    ),
    maxEventLifetimeMs: Math.min(entitlements.maxEventLifetimeMs, absoluteMaxEventLifetimeMs),
    maxActiveEvents: Math.min(entitlements.maxActiveEvents, eventCeilings.maxActiveEventsPerHost),
  };
}

/** Expiry options this plan can actually choose, longest allowed first in the UI. */
export function allowedExpiryPresets(planId: string) {
  const { maxEventLifetimeMs } = entitlementsFor(planId);
  return expiryPresets.filter((preset) => preset.ms <= maxEventLifetimeMs);
}

export function canUseExpiryPreset(planId: string, presetId: ExpiryPresetId): boolean {
  return allowedExpiryPresets(planId).some((preset) => preset.id === presetId);
}

export function canUseTemplate(planId: string, templateId: string): boolean {
  if (!isPremiumTemplate(templateId)) return true;
  return entitlementsFor(planId).premiumTemplates;
}

/**
 * The cheapest plan that unlocks a given entitlement. Drives the upgrade prompt, so a host
 * who hits a limit is told exactly what to buy rather than being sent to a pricing page to
 * work it out themselves.
 */
export function cheapestPlanWith(entitlement: keyof Entitlements): PlanId | null {
  for (const planId of ['free', 'event', 'pro'] as const) {
    const value = plans[planId].entitlements[entitlement];
    if (value === true) return planId;
  }
  return null;
}

/** The smallest plan whose numeric entitlement reaches `needed`. */
export function cheapestPlanReaching(
  entitlement: keyof Entitlements,
  needed: number,
): PlanId | null {
  for (const planId of ['free', 'event', 'pro'] as const) {
    const value = plans[planId].entitlements[entitlement];
    if (typeof value === 'number' && value >= needed) return planId;
  }
  return null;
}

/** True while nobody is being charged. Used to label the pricing page honestly. */
export function isPreviewPricing(): boolean {
  return !isEnabled('billing');
}

/**
 * Whether an invitation carries "Made with Marquee".
 *
 * This existed as a bare `!entitlementsFor(event.plan).removeBranding` and was, in practice,
 * **always false**. While billing is off `planForNewEvent()` stamps every event
 * `previewPlanId` — `pro` — and `pro` includes `removeBranding`. So being maximally generous
 * during the preview silently switched off the only organic distribution this product has:
 * the mark rendered on no invitation at all, for months.
 *
 * Both halves were individually right. Together they were the worst pairing available — give
 * the whole product away *and* get no reach in exchange for it. The fix is to decouple the
 * mark from the plan while nobody is paying, rather than to make the preview less generous.
 *
 * **On the invariant this appears to break.** Everything else in this file refuses to widen
 * what an event may do from global state read at render time — that rule exists because
 * deriving entitlements from today's flags meant flipping billing would have retroactively
 * downgraded every live event. This is the opposite shape and is safe for two reasons: an
 * attribution is a cost to the host rather than a capability, so nothing here can take away
 * something an event was promised; and the direction the flag moves is benign. When billing
 * turns on, a preview-era `pro` event *loses* the mark. It can never gain one on an event
 * whose host paid to be rid of it, because a paid plan carries `removeBranding` and
 * `isPreviewPricing()` is false by then.
 */
export function showsAttribution(planId: string): boolean {
  if (isPreviewPricing()) return true;
  return !entitlementsFor(planId).removeBranding;
}
