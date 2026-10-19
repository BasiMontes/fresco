import type Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveDisputeCancellation, resolveDisputeChargeId } from './dispute';
import { resolveChargeCustomerId, resolveChargeSubscriptionId } from './refund';
import { findProfileByStripeCustomer, profileHoldsOtherMode } from './subscription';

/**
 * FRESCO-1003: a dispute cancels the subscription its charge paid for (see `dispute.ts`) and is
 * always reported to Sentry, cancelled or not: it is money at risk and a person to look at.
 * Ignored cases are logged, never thrown: they are not failures.
 */
export async function handleDisputeCreated({ dispute, eventId, livemode }: { dispute: Stripe.Dispute, eventId: string, livemode: boolean }): Promise<void> {
  const chargeId = resolveDisputeChargeId(dispute);
  const tags = { stripe_event_id: eventId, stripe_dispute_id: dispute.id, stripe_charge_id: chargeId };
  const extra = { amount: dispute.amount, currency: dispute.currency, reason: dispute.reason, status: dispute.status };

  // Reported first, so a lookup that fails below still leaves the signal behind.
  Sentry.captureMessage('Stripe dispute opened', { level: 'error', tags, extra });

  const charge = await stripe.charges.retrieve(chargeId);
  const stripeCustomerId = resolveChargeCustomerId(charge);
  if (!stripeCustomerId) {
    console.warn(`[/api/stripe/webhook] disputed charge ${chargeId} (event ${eventId}) has no customer; nothing to cancel`);
    return;
  }

  const profile = await findProfileByStripeCustomer(createServiceClient(), stripeCustomerId);
  if (!profile?.stripe_subscription_id) {
    console.info(`[/api/stripe/webhook] disputed charge ${chargeId} (event ${eventId}): no subscription on file for customer ${stripeCustomerId}; nothing to cancel`);
    return;
  }

  if (profileHoldsOtherMode(profile, livemode)) {
    console.error(`[/api/stripe/webhook] disputed charge ${chargeId} (event ${eventId}): the profile for customer ${stripeCustomerId} holds ids of the other Stripe mode; nothing to cancel`);
    return;
  }

  const chargeSubscriptionId = await resolveChargeSubscriptionId(stripe, charge);
  const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const decision = resolveDisputeCancellation({ subscription, chargeSubscriptionId });
  if (decision.action === 'ignore') {
    console.info(`[/api/stripe/webhook] disputed charge ${chargeId} (event ${eventId}) left the subscription alone: ${decision.reason}`);
    return;
  }

  // No proration and no final invoice: cancelling must not create a new charge on a card that
  // is already in dispute. The comment makes it traceable in the Stripe dashboard.
  await stripe.subscriptions.cancel(decision.subscriptionId, {
    cancellation_details: { comment: `dispute:${dispute.id}` },
    prorate: false,
    invoice_now: false,
  });
  Sentry.captureMessage('Stripe dispute: subscription cancelled', { level: 'warning', tags: { ...tags, stripe_subscription_id: decision.subscriptionId } });
}
