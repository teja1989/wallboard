/**
 * Feature flags. Everything that is planned but not shipped starts `false` here so the
 * seams exist in code without the behaviour being live.
 *
 * Defaults are compile-time; phase 2 adds a Firestore `config/features` document that the
 * owner console can override at runtime, read through the same accessor.
 */

export interface FeatureFlags {
  /**
   * Charging real money. While this is off, every event runs on `previewPlanId` and the
   * pricing page presents itself as a preview — see src/lib/billing/entitlements.ts.
   * Turning it on activates the plan gates with no other code change.
   */
  billing: boolean;
  /**
   * The operator console at `/admin`.
   *
   * On, because the thing it gates now exists. It is a kill switch rather than a permission:
   * every screen under it is gated again by `admin:*` at its own API, and by Firestore rules
   * denying the collections to clients outright. Turning this off makes the console 404 —
   * useful if something under there ever misbehaves — and takes no authorization with it.
   */
  adminConsole: boolean;
  /** Phase 3 — Cloud Vision SafeSearch on uploaded media. */
  safetyScan: boolean;
  /** Phase 3 — user-facing "report this post" flow. */
  contentReporting: boolean;
  /** Phase 4 — consent banner, analytics, sponsor slots. */
  ads: boolean;
  analytics: boolean;
  /** Deferred — Cloud Transcoder normalisation of uploaded video. */
  transcoding: boolean;
  /** Lets a host allow anonymous (code-only) visitors to post. Off by default: attribution matters. */
  allowAnonymousPosting: boolean;
  /** Big-screen projection mode for the wall. */
  presentationMode: boolean;
}

export const defaultFeatureFlags: FeatureFlags = {
  billing: false,
  adminConsole: true,
  safetyScan: false,
  contentReporting: false,
  ads: false,
  analytics: false,
  transcoding: false,
  allowAnonymousPosting: false,
  presentationMode: true,
};

/**
 * Env overrides, useful for previews: FEATURE_ADMIN_CONSOLE=true.
 * Only recognises flags declared above, so a typo cannot invent a flag.
 */
function envOverrides(): Partial<FeatureFlags> {
  const out: Partial<FeatureFlags> = {};
  for (const key of Object.keys(defaultFeatureFlags) as (keyof FeatureFlags)[]) {
    const envKey = `FEATURE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    const raw = process.env[envKey];
    if (raw === 'true' || raw === '1') out[key] = true;
    if (raw === 'false' || raw === '0') out[key] = false;
  }
  return out;
}

export const featureFlags: FeatureFlags = { ...defaultFeatureFlags, ...envOverrides() };

export function isEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}
