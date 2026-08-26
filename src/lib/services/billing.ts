import 'server-only';
import { collections, planById, type PlanId } from '@/config';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/firebase/admin';
import { eventRef, requireEvent } from '@/lib/services/events';
import type { BillingEvent } from '@/lib/billing/gateway';

/**
 * Applying what someone paid for.
 *
 * Everything here is driven by a *verified* webhook, never by the browser coming back from
 * checkout. A success redirect is a URL anyone can visit; only the webhook is proof that
 * money changed hands.
 *
 * Every grant is idempotent. Webhooks are delivered at least once, retried on any non-2xx,
 * and occasionally arrive out of order — so applying the same one twice has to be a no-op
 * rather than two upgrades or a downgrade landing after an upgrade.
 */

export interface UserBilling {
  plan: PlanId;
  customerId: string | null;
  /** Epoch ms. A subscription past this is treated as ended. */
  currentPeriodEnd: number | null;
  updatedAt: number;
}

function userRef(uid: string) {
  return db().collection(collections.users).doc(uid);
}

/**
 * The plan a host's own account carries.
 *
 * Read at event creation so a Pro subscriber's events start on Pro. Lapsed subscriptions
 * fall back to free here rather than needing a sweep to catch them — the period end is the
 * source of truth, so a missed cancellation webhook cannot leave someone on Pro forever.
 */
export async function accountPlan(uid: string): Promise<PlanId> {
  const snapshot = await userRef(uid).get();
  if (!snapshot.exists) return 'free';

  const billing = snapshot.get('billing') as UserBilling | undefined;
  if (!billing || billing.plan === 'free') return 'free';

  if (billing.currentPeriodEnd !== null && billing.currentPeriodEnd < Date.now()) return 'free';
  return billing.plan;
}

export async function billingFor(uid: string): Promise<UserBilling | null> {
  const snapshot = await userRef(uid).get();
  return snapshot.exists ? ((snapshot.get('billing') as UserBilling | undefined) ?? null) : null;
}

/**
 * Applies a verified billing event.
 *
 * Returns a short description of what changed, for the audit trail — or null when the event
 * was a duplicate or irrelevant, so the caller can answer 200 without pretending work
 * happened.
 */
export async function applyBillingEvent(billingEvent: BillingEvent): Promise<string | null> {
  switch (billingEvent.type) {
    case 'event.unlocked':
      return unlockEvent(billingEvent);
    case 'subscription.active':
      return activateSubscription(billingEvent);
    case 'subscription.ended':
      return endSubscription(billingEvent);
    case 'ignored':
      return null;
  }
}

async function unlockEvent(
  billingEvent: Extract<BillingEvent, { type: 'event.unlocked' }>,
): Promise<string | null> {
  const event = await requireEvent(billingEvent.eventId);

  // The upgrade applies to the event, so the person paying must be the person hosting it.
  // Without this, anyone who learned an event id could attach their payment to someone
  // else's event — harmless in isolation, but it makes refunds and support unanswerable.
  if (event.hostUid !== billingEvent.actorUid) {
    console.error(
      `[billing] refusing to unlock ${billingEvent.eventId}: paid by ${billingEvent.actorUid}, hosted by ${event.hostUid}`,
    );
    return null;
  }

  if (event.plan === billingEvent.planId) return null;

  await eventRef(event.id).update({
    plan: billingEvent.planId,
    billing: {
      reference: billingEvent.reference,
      paidAt: Date.now(),
      paidByUid: billingEvent.actorUid,
    },
  });

  await recordAudit(
    { uid: billingEvent.actorUid, role: 'user' },
    {
      action: 'billing.eventUnlocked',
      targetType: 'event',
      targetId: event.id,
      eventId: event.id,
      metadata: { plan: billingEvent.planId, reference: billingEvent.reference },
    },
    { ip: null, userAgent: 'billing-webhook' },
  );

  return `${planById(billingEvent.planId).label} applied to ${event.id}`;
}

async function activateSubscription(
  billingEvent: Extract<BillingEvent, { type: 'subscription.active' }>,
): Promise<string | null> {
  const existing = await billingFor(billingEvent.actorUid);

  // Webhooks can arrive out of order. An older period end must never overwrite a newer one,
  // or a renewal followed by a late duplicate would shorten the subscription.
  if (
    existing?.plan === billingEvent.planId &&
    (existing.currentPeriodEnd ?? 0) >= billingEvent.currentPeriodEnd
  ) {
    return null;
  }

  const billing: UserBilling = {
    plan: billingEvent.planId,
    customerId: billingEvent.customerId || null,
    currentPeriodEnd: billingEvent.currentPeriodEnd,
    updatedAt: Date.now(),
  };
  await userRef(billingEvent.actorUid).set({ billing }, { merge: true });

  await recordAudit(
    { uid: billingEvent.actorUid, role: 'user' },
    {
      action: 'billing.subscriptionActive',
      targetType: 'user',
      targetId: billingEvent.actorUid,
      metadata: { plan: billingEvent.planId, until: billingEvent.currentPeriodEnd },
    },
    { ip: null, userAgent: 'billing-webhook' },
  );

  return `${planById(billingEvent.planId).label} active for ${billingEvent.actorUid}`;
}

async function endSubscription(
  billingEvent: Extract<BillingEvent, { type: 'subscription.ended' }>,
): Promise<string | null> {
  const existing = await billingFor(billingEvent.actorUid);
  if (!existing || existing.plan === 'free') return null;

  const billing: UserBilling = {
    plan: 'free',
    customerId: existing.customerId,
    currentPeriodEnd: null,
    updatedAt: Date.now(),
  };
  await userRef(billingEvent.actorUid).set({ billing }, { merge: true });

  await recordAudit(
    { uid: billingEvent.actorUid, role: 'user' },
    {
      action: 'billing.subscriptionEnded',
      targetType: 'user',
      targetId: billingEvent.actorUid,
      metadata: {},
    },
    { ip: null, userAgent: 'billing-webhook' },
  );

  // Events already unlocked keep their plan. Someone who paid for a wedding and later
  // cancelled a subscription has not un-paid for the wedding.
  return `subscription ended for ${billingEvent.actorUid}`;
}
