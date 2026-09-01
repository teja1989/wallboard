import { isEnabled } from '@/config';
import type { AuthzContext } from '@/lib/authz/policy';
import type { Actor, EventDoc, EventRole } from '@/types/domain';

/**
 * Builds the authz context for an action inside a specific event, so that every call site
 * derives "may anonymous visitors post here?" the same way: the host's setting, gated by
 * the platform feature flag. A host cannot opt into something the platform has turned off.
 *
 * **Both conditions, and nothing else.** `|| eventRole !== null` was briefly added here, and
 * it inverts the feature: an anonymous visitor joins as `viewer` even on a members-only
 * event, `'viewer' !== null` is true, and the host's `whoCanPost: 'members'` stops meaning
 * anything. The double gate in `docs/SECURITY.md` — platform flag *and* host setting — is
 * the whole design, and a membership row is not consent from the host.
 */
export function eventAuthzContext(
  actor: Actor,
  event: Pick<EventDoc, 'settings'>,
  eventRole: EventRole | null,
  isOwnResource = false,
): AuthzContext {
  return {
    actor,
    eventRole,
    isOwnResource,
    anonymousPostingAllowed:
      event.settings.whoCanPost === 'anyone' && isEnabled('allowAnonymousPosting'),
  };
}
