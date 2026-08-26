import 'server-only';
import { randomUUID } from 'node:crypto';
import { appConfig, billingConfig, serverConfig } from '@/config';
import type { BillingEvent, BillingGateway, CheckoutRequest, CheckoutSession } from './types';

/**
 * Development driver.
 *
 * Sends the browser to a local page that looks like a checkout and completes the purchase
 * against our own webhook. That is more work than returning a fake URL, and it is the
 * point: the upgrade flow — session, redirect, webhook, plan change, entitlement unlock —
 * runs identically in development, in CI and in production. Only the party taking the money
 * differs.
 *
 * Refuses to load outside development. A mock checkout reachable in production is a way to
 * give away the product.
 */
export const mockGateway: BillingGateway = {
  driver: 'mock',

  async createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession> {
    // A checkout that takes no money must never be reachable in production. This is the
    // last line of defence behind BILLING_DRIVER — if both fail, the product is free.
    if (serverConfig().isProduction) {
      throw new Error('The mock billing gateway cannot be used in production.');
    }

    const id = `mock_${randomUUID()}`;
    const params = new URLSearchParams({
      session: id,
      plan: request.planId,
      success: request.successUrl,
      cancel: request.cancelUrl,
      uid: request.actorUid,
    });
    if (request.eventId) params.set('event', request.eventId);

    return { id, url: `${appConfig.siteUrl}/billing/checkout?${params.toString()}` };
  },

  async createPortalUrl(): Promise<string | null> {
    // There is nothing to manage: a mock subscription has no renewal and no card.
    return null;
  },

  async parseWebhook(rawBody: string): Promise<BillingEvent> {
    // The mock checkout page posts this shape back to the webhook itself.
    const payload = JSON.parse(rawBody) as Partial<BillingEvent> & { type?: string };
    if (!payload.type) return { type: 'ignored', reason: 'No type on payload.' };

    // The subscription period is decided here, not by the caller — mirroring Stripe, where
    // the dates come from the provider rather than from whoever started the checkout.
    if (payload.type === 'subscription.active') {
      return {
        ...(payload as Extract<BillingEvent, { type: 'subscription.active' }>),
        currentPeriodEnd: Date.now() + billingConfig.assumedPeriodMs,
      };
    }

    return payload as BillingEvent;
  },
};
