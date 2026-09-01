/**
 * How people sign in.
 *
 * A list rather than a set of branches, because this changes: Google today, X next, and
 * whatever a future audience already has an account with. Adding one should be an entry
 * here plus a credential in the auth provider — never another `&&` in a component, which
 * is how sign-in screens end up with one properly-designed button and three afterthoughts.
 *
 * `enabled` is compile-time and deliberately conservative: a provider that is listed but
 * not yet configured in Identity Platform would render a button that fails on the first
 * click, which is worse than not offering it.
 */

export const AUTH_PROVIDERS = ['google', 'x'] as const;
export type AuthProviderId = (typeof AUTH_PROVIDERS)[number];

export interface AuthProvider {
  id: AuthProviderId;
  label: string;
  /** Whether to offer it. Driven by env, because it depends on what the project configured. */
  enabled: boolean;
  /** Brand mark colour for the button's icon tile. */
  tint: string;
}

/**
 * Email is not in this list on purpose.
 *
 * It is not a third-party provider and it never becomes unavailable — it is the floor, the
 * way in that works when someone has no account anywhere, so it is always offered and is
 * presented as an equal rather than as the option you take when the real ones fail.
 */
export function authProviders(enabledGoogle: boolean): AuthProvider[] {
  return [
    { id: 'google', label: 'Google', enabled: enabledGoogle, tint: '#4285f4' },
    // Declared, not yet live: X sign-in needs its own OAuth app and an Identity Platform
    // OIDC provider. Listing it here is what makes turning it on a small change.
    { id: 'x', label: 'X', enabled: false, tint: '#0f1419' },
  ];
}
