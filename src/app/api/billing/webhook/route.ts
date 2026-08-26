import { NextResponse } from 'next/server';
import { billingGateway } from '@/lib/billing/gateway';
import { applyBillingEvent } from '@/lib/services/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The payment webhook.
 *
 * Deliberately outside the usual `route()` wrapper, because a webhook's response contract
 * belongs to the provider, not to our API. Stripe retries anything that is not a 2xx, so:
 *
 *  - a bad signature is 400 and must never be retried into success
 *  - a genuine processing failure is 500, because a retry is exactly what we want
 *  - an event we do not care about is 200, or Stripe will redeliver it for days
 *
 * The raw body is read as text before anything else. Parsing it first would destroy the
 * bytes the signature was computed over.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  let billingEvent;
  try {
    billingEvent = await billingGateway().parseWebhook(rawBody, signature);
  } catch (error) {
    // Never log the body: it carries customer details, and this path is reachable by
    // anyone who finds the URL.
    console.error('[billing] rejected webhook:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 400 });
  }

  try {
    const applied = await applyBillingEvent(billingEvent);
    return NextResponse.json({ ok: true, applied: applied ?? 'no-op' });
  } catch (error) {
    console.error('[billing] failed to apply event', billingEvent.type, error);
    return NextResponse.json({ ok: false, error: 'processing_failed' }, { status: 500 });
  }
}
