import type Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { resolveProUpdateFromSession, stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/stripe/webhook — the ONLY writer of `user_profiles.plan` /
 * `stripe_customer_id` / `stripe_subscription_id` / `plan_expires_at`
 * (ADR-0007). Never called from the client or from the Checkout return page
 * — Stripe calls this directly, signed with `STRIPE_WEBHOOK_SECRET`.
 *
 * Reads the raw body via `request.text()` (App Router route handlers don't
 * parse the body automatically, unlike the old Pages Router — no extra
 * config needed) because `stripe.webhooks.constructEvent` verifies the
 * signature against the exact raw bytes Stripe sent; a re-serialized JSON
 * body would fail verification.
 *
 * Only `checkout.session.completed` is handled today — every other event
 * type is a 200 no-op. FRESCO-230 (reflect ongoing subscription status),
 * FRESCO-231 (cancel/manage), and FRESCO-232 (failed payment) add their own
 * `case`s to this same handler later; they reuse this one endpoint rather
 * than each registering a separate webhook.
 *
 * Once the signature verifies, a downstream failure (e.g. the Supabase
 * write) is logged with the Stripe event id and this still returns 200 —
 * deliberate, not an oversight: a non-2xx response makes Stripe retry
 * delivery, and retrying a bug just repeats the same failure. Manual replay
 * from the Stripe Dashboard is the recovery path for a logged failure.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error('[/api/stripe/webhook] missing signature header or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
  catch (error) {
    console.error('[/api/stripe/webhook] signature verification failed', error);
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  try {
    const session = event.data.object;

    if (!session.subscription) {
      throw new Error('checkout.session.completed without a subscription id.');
    }

    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTH;
    if (!priceId) {
      throw new Error('STRIPE_PRICE_ID_PRO_MONTH is not configured.');
    }
    const update = resolveProUpdateFromSession(session, subscription, priceId);

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('user_profiles')
      .update({
        plan: 'pro',
        stripe_customer_id: update.stripeCustomerId,
        stripe_subscription_id: update.stripeSubscriptionId,
        plan_expires_at: update.planExpiresAt,
      })
      .eq('id', update.userId);

    if (error) {
      throw error;
    }
  }
  catch (error) {
    // Signature already verified above — log + still 200 to avoid a Stripe
    // retry storm on a bug. See doc comment.
    console.error(`[/api/stripe/webhook] failed to process event ${event.id}`, error);
  }

  return NextResponse.json({ received: true });
}
