import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveChargeCustomerId, resolveChargeSubscriptionId, resolveRefundCancellation } from './refund';
import { findProfileByStripeCustomer, profileHoldsOtherMode } from './subscription';

/**
 * FRESCO-900: a full refund of this period's charge cancels the subscription (see the
 * route doc). Ignored cases are logged, never thrown: they are not failures.
 */
export async function handleChargeRefunded({ charge, eventId, livemode }: { charge: Stripe.Charge, eventId: string, livemode: boolean }): Promise<void> {
  // A partial refund is a goodwill gesture; skip before any lookup.
  if (!charge.refunded) {
    return;
  }

  const stripeCustomerId = resolveChargeCustomerId(charge);
  if (!stripeCustomerId) {
    console.warn(`[/api/stripe/webhook] refunded charge ${charge.id} (event ${eventId}) has no customer; nothing to cancel`);
    return;
  }

  const profile = await findProfileByStripeCustomer(createServiceClient(), stripeCustomerId);
  if (!profile?.stripe_subscription_id) {
    console.info(`[/api/stripe/webhook] refunded charge ${charge.id} (event ${eventId}): no subscription on file for customer ${stripeCustomerId}; nothing to cancel`);
    return;
  }

  if (profileHoldsOtherMode(profile, livemode)) {
    console.error(`[/api/stripe/webhook] refunded charge ${charge.id} (event ${eventId}): the profile for customer ${stripeCustomerId} holds ids of the other Stripe mode; nothing to cancel`);
    return;
  }

  // FRESCO-1002: cancel only the subscription this charge paid for, never the one on file by default.
  const chargeSubscriptionId = await resolveChargeSubscriptionId(stripe, charge);
  const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const decision = resolveRefundCancellation({ charge, subscription, chargeSubscriptionId });
  if (decision.action === 'ignore') {
    console.info(`[/api/stripe/webhook] refunded charge ${charge.id} (event ${eventId}) left the subscription alone: ${decision.reason}`);
    return;
  }

  // No proration and no final invoice: this cancellation must not create a second refund
  // or a new charge. The comment makes it traceable in the Stripe dashboard.
  await stripe.subscriptions.cancel(decision.subscriptionId, {
    cancellation_details: { comment: `refund:${charge.id}` },
    prorate: false,
    invoice_now: false,
  });
}
