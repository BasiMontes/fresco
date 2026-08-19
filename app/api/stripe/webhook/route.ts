import type Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { resolveCancellationCustomerId, resolvePaymentStatusUpdate, resolveProUpdateFromSession, resolveRenewalUpdate, stripe } from '@/lib/stripe';
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
 * Handles `checkout.session.completed` (initial purchase), `customer.
 * subscription.updated` (renewal — keeps `plan: 'pro'` and refreshes
 * `plan_expires_at`; also carries the FRESCO-232 payment-failed signal —
 * `past_due` sets `payment_failed_at` while Stripe keeps retrying, `unpaid`
 * downgrades straight to `plan: 'free'` once Stripe gives up retrying, and a
 * recovered `active` clears the aviso), and `customer.subscription.deleted`
 * (the subscription's paid period actually ended some other way — downgrades
 * to `plan: 'free'`). Every other event type is a 200 no-op. FRESCO-231
 * (cancel/manage) reuses this same handler rather than registering a
 * separate webhook.
 *
 * A user *requesting* cancellation is NOT handled specially: Stripe fires
 * `customer.subscription.updated` with `status` still `'active'` and
 * `cancel_at_period_end: true` in that case, which the renewal branch below
 * already treats as a normal active-subscription update (keeps Pro) — per
 * this story's AC, cancellation should only take effect once the paid period
 * actually ends, which is `customer.subscription.deleted`.
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

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, event.id);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, event.id);
        break;
      default:
        // No-op — every event type this handler doesn't react to yet.
        break;
    }
  }
  catch (error) {
    // Signature already verified above — log + still 200 to avoid a Stripe
    // retry storm on a bug. See doc comment.
    console.error(`[/api/stripe/webhook] failed to process event ${event.id}`, error);
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
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
      // FRESCO-232: a fresh checkout starts a clean subscription — clear any
      // failed-payment aviso left over from a prior one (out-of-order webhook
      // delivery, or a resubscribe after a lapsed Pro period).
      payment_failed_at: null,
    })
    .eq('id', update.userId);

  if (error) {
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, eventId: string): Promise<void> {
  const paymentStatus = resolvePaymentStatusUpdate(subscription);
  if (!paymentStatus) {
    // Status outside {past_due, unpaid, active} (e.g. `canceled`,
    // `incomplete`) — out of scope for both the renewal and the
    // payment-failed signal.
    return;
  }

  const supabase = createServiceClient();
  const { data: profile, error: lookupError } = await supabase
    .from('user_profiles')
    .select('id, stripe_subscription_id')
    .eq('stripe_customer_id', paymentStatus.stripeCustomerId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  // Code review on PR #101: Stripe doesn't guarantee webhook delivery order,
  // and a customer can have more than one subscription over time (cancel,
  // then resubscribe before the old one's deferred `deleted` event arrives).
  // Matching by customer id alone risks a stale/out-of-order event for a
  // DIFFERENT subscription overwriting this customer's current
  // plan_expires_at -- cross-check the event's subscription id against the
  // one already on file, not just the customer id.
  if (!profile || profile.stripe_subscription_id !== subscription.id) {
    console.error(`[/api/stripe/webhook] no matching user_profiles row for Stripe customer ${paymentStatus.stripeCustomerId} + subscription ${subscription.id} (event ${eventId}) -- likely an out-of-order webhook delivery; self-heals on the next matching event`);
    return;
  }

  if (paymentStatus.kind === 'retrying') {
    // FRESCO-232: charge failed, still within Stripe's own retry window —
    // `plan` is deliberately untouched (stays `'pro'`), only the aviso flag
    // is set.
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ payment_failed_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (updateError) {
      throw updateError;
    }
    return;
  }

  if (paymentStatus.kind === 'exhausted') {
    // FRESCO-232 (AC3): Stripe gave up retrying without necessarily
    // canceling the subscription outright (depends on the account's dunning
    // config — "Cancel subscription" vs. "Mark uncollectible" after retries
    // exhaust). Downgrading here, rather than only reacting to
    // `customer.subscription.deleted`, makes AC3 hold regardless of that
    // dashboard setting.
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ plan: 'free', payment_failed_at: null })
      .eq('id', profile.id);

    if (updateError) {
      throw updateError;
    }
    return;
  }

  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTH;
  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID_PRO_MONTH is not configured.');
  }
  const update = resolveRenewalUpdate(subscription, priceId);

  const { error: updateError } = await supabase
    .from('user_profiles')
    // FRESCO-232: a renewal-shaped `active` update also means any prior
    // failed-payment aviso just resolved (retry succeeded) -- clear it here
    // rather than in a separate write.
    .update({ plan: 'pro', plan_expires_at: update.planExpiresAt, payment_failed_at: null })
    .eq('id', profile.id);

  if (updateError) {
    throw updateError;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string): Promise<void> {
  const stripeCustomerId = resolveCancellationCustomerId(subscription);
  const supabase = createServiceClient();
  const { data: profile, error: lookupError } = await supabase
    .from('user_profiles')
    .select('id, stripe_subscription_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  // Same out-of-order-delivery guard as handleSubscriptionUpdated: a
  // `deleted` event for an OLD subscription arriving after the customer
  // resubscribed (new stripe_subscription_id on file) must NOT downgrade a
  // now-legitimately-active Pro customer.
  if (!profile || profile.stripe_subscription_id !== subscription.id) {
    console.error(`[/api/stripe/webhook] no matching user_profiles row for Stripe customer ${stripeCustomerId} + subscription ${subscription.id} (event ${eventId}) -- likely a stale/out-of-order delete for a superseded subscription`);
    return;
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    // FRESCO-232: also clear a stale payment-failed aviso -- the account is
    // Free now, the aviso no longer applies.
    .update({ plan: 'free', payment_failed_at: null })
    .eq('id', profile.id);

  if (updateError) {
    throw updateError;
  }
}
