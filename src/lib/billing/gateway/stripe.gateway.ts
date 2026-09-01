import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { billingConfig, serverConfig, type PlanId } from '@/config';
import type { BillingEvent, BillingGateway, CheckoutRequest, CheckoutSession } from './types';

/**
 * Production driver.
 *
 * Spoken over Stripe's REST API with fetch rather than the SDK. The surface used here is
 * three endpoints, and the SDK is a large dependency that pulls Node built-ins into places
 * a bundler would rather it did not.
 *
 * Signature verification is implemented directly against Stripe's scheme, because the one
 * thing that must not be delegated to a convenience wrapper is the check that decides
 * whether a stranger can grant themselves a paid plan.
 */

const API = 'https://api.stripe.com/v1';

function secretKey(): string {
  const key = serverConfig().stripe.secretKey;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.');
  return key;
}

async function stripePost(path: string, form: Record<string, string>): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(form).toString(),
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? JSON.stringify((payload as { error: unknown }).error).slice(0, 300)
        : String(response.status);
    throw new Error(`Stripe ${path} failed: ${message}`);
  }
  return payload;
}

/**
 * Stripe signs `t=<timestamp>,v1=<hmac>`; the signed payload is `timestamp.body`.
 *
 * The timestamp window matters as much as the digest: without it, a signature captured
 * once could be replayed forever.
 */
function verifySignature(rawBody: string, header: string | null): void {
  const secret = serverConfig().stripe.webhookSecret;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set.');
  if (!header) throw new Error('Missing Stripe signature.');

  const parts = Object.fromEntries(
    header.split(',').map((piece) => {
      const [key, ...rest] = piece.split('=');
      return [key?.trim() ?? '', rest.join('=')];
    }),
  );

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) throw new Error('Malformed Stripe signature.');

  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > billingConfig.webhookToleranceSeconds) {
    throw new Error('Stripe signature is outside the accepted time window.');
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const given = parts.v1 ?? '';
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Stripe signature does not match.');
  }
}

interface StripeSession {
  id: string;
  url?: string;
  mode?: string;
  client_reference_id?: string;
  customer?: string;
  payment_intent?: string;
  subscription?: string;
  metadata?: Record<string, string>;
}

export const stripeGateway: BillingGateway = {
  driver: 'stripe',

  async createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession> {
    const price = billingConfig.priceIds[request.planId];
    if (!price) throw new Error(`No Stripe price configured for the ${request.planId} plan.`);

    const subscription = request.planId === 'pro';
    const form: Record<string, string> = {
      mode: subscription ? 'subscription' : 'payment',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      // Carries the buyer through the webhook, so the grant lands on the right account
      // even though the webhook arrives on a connection with no session.
      client_reference_id: request.actorUid,
      'metadata[actorUid]': request.actorUid,
      'metadata[planId]': request.planId,
    };
    if (request.eventId) form['metadata[eventId]'] = request.eventId;
    if (request.actorEmail) form.customer_email = request.actorEmail;

    const session = (await stripePost('/checkout/sessions', form)) as StripeSession;
    if (!session.url) throw new Error('Stripe returned a session with no URL.');
    return { id: session.id, url: session.url };
  },

  async createPortalUrl(customerId: string, returnUrl: string): Promise<string | null> {
    const portal = (await stripePost('/billing_portal/sessions', {
      customer: customerId,
      return_url: returnUrl,
    })) as { url?: string };
    return portal.url ?? null;
  },

  async parseWebhook(rawBody: string, signature: string | null): Promise<BillingEvent> {
    verifySignature(rawBody, signature);

    const event = JSON.parse(rawBody) as {
      type: string;
      data: { object: StripeSession & Record<string, unknown> };
    };
    const object = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const actorUid = object.metadata?.actorUid ?? object.client_reference_id ?? '';
        const planId = (object.metadata?.planId ?? 'event') as PlanId;
        const eventId = object.metadata?.eventId;

        if (!actorUid) return { type: 'ignored', reason: 'Session carried no account.' };

        if (object.mode === 'subscription') {
          return {
            type: 'subscription.active',
            actorUid,
            planId: 'pro',
            customerId: String(object.customer ?? ''),
            // Refreshed by the subscription events; this is a floor, not the truth.
            currentPeriodEnd: Date.now() + billingConfig.assumedPeriodMs,
          };
        }

        if (!eventId) return { type: 'ignored', reason: 'Payment carried no event.' };
        return {
          type: 'event.unlocked',
          eventId,
          planId,
          actorUid,
          reference: String(object.payment_intent ?? object.id),
        };
      }

      case 'customer.subscription.updated': {
        const status = String((object as Record<string, unknown>).status ?? '');
        const actorUid = object.metadata?.actorUid ?? '';
        if (!actorUid) return { type: 'ignored', reason: 'Subscription carried no account.' };

        // `past_due` deliberately keeps the plan: cutting someone off mid-event over a
        // card that will probably retry successfully is a worse outcome than a few days
        // of unpaid Pro.
        if (status === 'active' || status === 'trialing' || status === 'past_due') {
          return {
            type: 'subscription.active',
            actorUid,
            planId: 'pro',
            customerId: String(object.customer ?? ''),
            currentPeriodEnd:
              Number((object as Record<string, unknown>).current_period_end ?? 0) * 1000,
          };
        }
        return { type: 'subscription.ended', actorUid, customerId: String(object.customer ?? '') };
      }

      case 'customer.subscription.deleted': {
        const actorUid = object.metadata?.actorUid ?? '';
        if (!actorUid) return { type: 'ignored', reason: 'Subscription carried no account.' };
        return { type: 'subscription.ended', actorUid, customerId: String(object.customer ?? '') };
      }

      default:
        return { type: 'ignored', reason: event.type };
    }
  },
};
