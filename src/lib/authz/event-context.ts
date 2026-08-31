import { isEnabled } from '@/config';
import type { AuthzContext } from '@/lib/authz/policy';
import type { Actor, EventDoc, EventRole } from '@/types/domain';

/**
 * Builds the authz context for an action inside a specific event, so that every call site
 * derives "may anonymous visitors post here?" the same way: the host's setting, gated by
 * the platform feature flag. A host cannot opt into something the platform has turned off.
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
      (event.settings.whoCanPost === 'anyone' || eventRole !== null) &&
      isEnabled('allowAnonymousPosting'),
  };
}
