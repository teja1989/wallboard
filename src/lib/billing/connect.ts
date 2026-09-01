import 'server-only';
import { calculateContributionFees, serverConfig } from '@/config';
import { db } from '@/lib/firebase/admin';
import { recordContribution } from '@/lib/services/funds';
import type { Actor, CashFundDoc, EventDoc } from '@/types/domain';

const STRIPE_API = 'https://api.stripe.com/v1';

function stripeKey(): string {
  const key = serverConfig().stripe.secretKey;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.');
  return key;
}

async function stripeRequest<T = unknown>(
  path: string,
  method = 'POST',
  form?: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeKey()}`,
  };
  let body: string | undefined;

  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  }

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers,
    body,
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const errorMsg =
      typeof payload.error === 'object' && payload.error !== null
        ? JSON.stringify((payload.error as { message?: string }).message || payload.error)
        : String(response.status);
    throw new Error(`Stripe Connect ${path} failed: ${errorMsg}`);
  }

  return payload as T;
}

export interface ConnectAccountStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  accountId: string | null;
}

export const connectBillingService = {
  /**
   * Creates or retrieves a Stripe Express account for a host.
   */
  async getOrCreateHostAccount(hostUid: string, email: string | null): Promise<string> {
    const userDoc = await db().collection('users').doc(hostUid).get();
    const existingAccountId = userDoc.get('stripeConnectAccountId') as string | undefined;

    if (existingAccountId) return existingAccountId;

    if (serverConfig().billing.driver === 'mock') {
      const mockId = `acct_mock_${hostUid.slice(0, 12)}`;
      await db()
        .collection('users')
        .doc(hostUid)
        .set({ stripeConnectAccountId: mockId, stripePayoutsEnabled: true }, { merge: true });
      return mockId;
    }

    const form: Record<string, string> = {
      type: 'express',
      'capabilities[transfers][requested]': 'true',
      'capabilities[card_payments][requested]': 'true',
      business_type: 'individual',
      'metadata[hostUid]': hostUid,
    };
    if (email) form.email = email;

    const account = await stripeRequest<{ id: string }>('/accounts', 'POST', form);
    await db()
      .collection('users')
      .doc(hostUid)
      .set({ stripeConnectAccountId: account.id, stripePayoutsEnabled: false }, { merge: true });

    return account.id;
  },

  /**
   * Generates a 2-minute mobile-friendly onboarding link for the host.
   */
  async createOnboardingLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<string> {
    if (serverConfig().billing.driver === 'mock' || accountId.startsWith('acct_mock_')) {
      const sep = returnUrl.includes('?') ? '&' : '?';
      return `${returnUrl}${sep}connect=mock_success`;
    }

    const link = await stripeRequest<{ url: string }>('/account_links', 'POST', {
      account: accountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    });

    return link.url;
  },

  /**
   * Queries payout readiness for the host.
   */
  async getAccountStatus(hostUid: string): Promise<ConnectAccountStatus> {
    const userDoc = await db().collection('users').doc(hostUid).get();
    const accountId = userDoc.get('stripeConnectAccountId') as string | undefined;

    if (!accountId) {
      return { connected: false, payoutsEnabled: false, detailsSubmitted: false, accountId: null };
    }

    if (serverConfig().billing.driver === 'mock' || accountId.startsWith('acct_mock_')) {
      return { connected: true, payoutsEnabled: true, detailsSubmitted: true, accountId };
    }

    try {
      const account = await stripeRequest<{
        payouts_enabled?: boolean;
        details_submitted?: boolean;
      }>(`/accounts/${accountId}`, 'GET');

      const payoutsEnabled = Boolean(account.payouts_enabled);
      const detailsSubmitted = Boolean(account.details_submitted);

      await db()
        .collection('users')
        .doc(hostUid)
        .set({ stripePayoutsEnabled: payoutsEnabled }, { merge: true });

      return { connected: true, payoutsEnabled, detailsSubmitted, accountId };
    } catch {
      return { connected: true, payoutsEnabled: false, detailsSubmitted: false, accountId };
    }
  },

  /**
   * Creates a gift contribution checkout session with 2.5% platform take-rate
   * and destination routing to the host's connected Stripe account.
   */
  async createContributionCheckout(
    event: EventDoc,
    fund: CashFundDoc,
    input: {
      amount: number;
      contributorName: string;
      message?: string;
      isAnonymous?: boolean;
      postToWall?: boolean;
    },
    actor: Actor,
    returnUrls: { success: string; cancel: string },
  ): Promise<{ url: string; contributionId?: string }> {
    const fees = calculateContributionFees(input.amount);
    const hostStatus = await this.getAccountStatus(event.hostUid);

    // In mock mode: immediately record contribution and return success redirect
    if (
      serverConfig().billing.driver === 'mock' ||
      !hostStatus.accountId ||
      hostStatus.accountId.startsWith('acct_mock_')
    ) {
      const recorded = await recordContribution(
        event,
        {
          fundId: fund.id,
          amount: input.amount,
          contributorName: input.contributorName,
          message: input.message ?? '',
          isAnonymous: input.isAnonymous ?? false,
          postToWall: input.postToWall ?? true,
        },
        actor,
      );
      return {
        url: `${returnUrls.success}&contrib=${recorded.contribution.id}`,
        contributionId: recorded.contribution.id,
      };
    }

    // Production Stripe Connect Destination Checkout
    const giftCents = Math.round(input.amount * 100);
    const feeCents = Math.round((fees.platformFee + fees.processingFee) * 100);
    const appFeeCents = Math.round(fees.platformFee * 100);

    const form: Record<string, string> = {
      mode: 'payment',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `Gift for ${fund.title}`,
      'line_items[0][price_data][unit_amount]': String(giftCents),
      'line_items[0][quantity]': '1',

      'line_items[1][price_data][currency]': 'usd',
      'line_items[1][price_data][product_data][name]': 'Platform & Processing Fee',
      'line_items[1][price_data][unit_amount]': String(feeCents),
      'line_items[1][quantity]': '1',

      'payment_intent_data[application_fee_amount]': String(appFeeCents),
      'payment_intent_data[transfer_data][destination]': hostStatus.accountId,

      success_url: returnUrls.success,
      cancel_url: returnUrls.cancel,
      client_reference_id: actor.uid,

      'metadata[type]': 'cash_fund_contribution',
      'metadata[eventId]': event.id,
      'metadata[fundId]': fund.id,
      'metadata[contributorName]': input.contributorName,
      'metadata[giftAmount]': String(input.amount),
      'metadata[message]': input.message || '',
      'metadata[isAnonymous]': String(Boolean(input.isAnonymous)),
      'metadata[postToWall]': String(Boolean(input.postToWall)),
      'metadata[actorUid]': actor.uid,
    };

    const session = await stripeRequest<{ id: string; url: string }>(
      '/checkout/sessions',
      'POST',
      form,
    );

    return { url: session.url };
  },
};
