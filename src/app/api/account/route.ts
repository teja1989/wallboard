import { FieldValue } from 'firebase-admin/firestore';
import { collections, contentLimits, isEnabled, previewPlanId } from '@/config';
import { db } from '@/lib/firebase/admin';
import { accountPlan, billingFor } from '@/lib/services/billing';
import { listEventsForHost } from '@/lib/services/events';
import { recordAudit } from '@/lib/audit';
import { limitByUser, ok, parseBody, requireIdentifiedActor, route } from '@/lib/server/api';
import { requestContext } from '@/lib/server/request';
import { updateAccountSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Everything an account page needs, in one call.
 *
 * Scoped entirely to the caller's own session — there is no uid parameter, because a route
 * that accepted one would be a route for reading someone else's account.
 *
 * The plan is reported twice on purpose. `plan` is what has actually been paid for;
 * `effectivePlan` is what their events currently run on, which differs while billing is in
 * preview and every event is treated as Pro. Collapsing them would either promise a
 * customer something they have not bought, or hide what they are getting.
 */
export const GET = route(async () => {
  const actor = await requireIdentifiedActor();
  const [billing, events] = await Promise.all([
    billingFor(actor.uid),
    listEventsForHost(actor.uid, contentLimits.hostEventPageSize),
  ]);

  const plan = await accountPlan(actor.uid);
  const billingLive = isEnabled('billing');
  const now = Date.now();

  return ok({
    profile: {
      uid: actor.uid,
      email: actor.email,
      displayName: actor.displayName,
      photoUrl: actor.photoUrl,
      role: actor.role,
    },
    billing: {
      plan,
      effectivePlan: billingLive ? plan : previewPlanId,
      live: billingLive,
      currentPeriodEnd: billing?.currentPeriodEnd ?? null,
      hasCustomer: Boolean(billing?.customerId),
    },
    stats: {
      events: events.length,
      live: events.filter((event) => event.status === 'live' && event.expiresAt > now).length,
      // The number a host is proudest of, and the one that makes an account feel like it
      // holds something rather than merely existing.
      attending: events.reduce((sum, event) => sum + (event.rsvpTally?.attending ?? 0), 0),
    },
  });
});

/**
 * Changing the name that appears on an invitation and beside every post.
 *
 * The only mutable field. Email is the identity itself and changing it is a re-auth, not a
 * profile edit; role is not the account holder's to set.
 */
export const PATCH = route(async (request) => {
  const actor = await requireIdentifiedActor();
  await limitByUser('updateAccountPerUser', actor.uid);
  const { displayName } = await parseBody(request, updateAccountSchema);

  await db().collection(collections.users).doc(actor.uid).set(
    // `displayNameChosen` is what stops the next session mint from putting the provider's
    // name back over the top of this one.
    { displayName, displayNameChosen: true, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  // The name is stamped on invitations and beside every post, so a change to it is a change
  // to how someone appears to everyone they have invited — worth a line in the log.
  await recordAudit(
    actor,
    { action: 'user.renamed', targetType: 'user', targetId: actor.uid },
    requestContext(request),
  );

  return ok({ displayName });
});
