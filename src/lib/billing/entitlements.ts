import {
  absoluteMaxEventLifetimeMs,
  eventCeilings,
  expiryPresets,
  isEnabled,
  isPremiumTheme,
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
 * The plan an event actually runs on.
 *
 * While billing is off, everything runs on the preview plan. That is a product decision,
 * not a shortcut: gating an unproven product behind a paywall measures nothing except how
 * quickly people leave, and it would make every entitlement check untested in practice.
 * This way the gates are exercised on every request from day one, and switching billing on
 * is a flag rather than a migration.
 */
export function effectivePlanId(storedPlanId: string): PlanId {
  if (!isEnabled('billing')) return previewPlanId;
  return planById(storedPlanId).id;
}

export function entitlementsFor(planId: string): Entitlements {
  return clampToCeilings(planById(effectivePlanId(planId)).entitlements);
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

export function canUseTheme(planId: string, themeId: string): boolean {
  if (!isPremiumTheme(themeId)) return true;
  return entitlementsFor(planId).premiumThemes;
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
