import type Stripe from 'stripe';

/**
 * FRESCO-1003 (audit 7b A7-PAY-04) — what a `charge.dispute.created` event means for the
 * subscription.
 *
 * A dispute is a chargeback: the cardholder asked the bank for the money back. Until now nothing
 * reacted, so the account stayed Pro and the next cycle charged the same card again, which grows
 * the dispute count Stripe watches. The subscription the disputed charge paid for is cancelled
 * (`customer.subscription.deleted` then downgrades the account, like a refund).
 *
 * Unlike a refund (`refund.ts`) the period does not matter: a dispute about an older charge of
 * the same subscription is still a reason to stop charging that card. What does matter is that the
 * charge belongs to the subscription being cancelled: a customer who resubscribed keeps an old
 * subscription's charge on the same Stripe customer, and its dispute must not cancel the new one.
 * `chargeSubscriptionId` is the subscription that charge paid for (`resolveChargeSubscriptionId`),
 * `null` when it cannot be told: no proof, no cancellation.
 */
export type DisputeDecision
  = | { action: 'cancel', subscriptionId: string }
    | { action: 'ignore', reason: 'unknown_charge_subscription' | 'other_subscription' | 'already_ended' };

export function resolveDisputeCancellation({ subscription, chargeSubscriptionId }: { subscription: Stripe.Subscription, chargeSubscriptionId: string | null }): DisputeDecision {
  if (!chargeSubscriptionId) {
    return { action: 'ignore', reason: 'unknown_charge_subscription' };
  }
  if (chargeSubscriptionId !== subscription.id) {
    return { action: 'ignore', reason: 'other_subscription' };
  }
  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    return { action: 'ignore', reason: 'already_ended' };
  }
  return { action: 'cancel', subscriptionId: subscription.id };
}

/** The id of the disputed charge (a bare id on a delivered event, an object when expanded). */
export function resolveDisputeChargeId(dispute: Stripe.Dispute): string {
  return typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
}
