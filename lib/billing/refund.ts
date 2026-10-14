import type Stripe from 'stripe';

/**
 * FRESCO-900 — what a `charge.refunded` event means for the subscription.
 *
 * A charge refunded from the Stripe dashboard used to leave the subscription
 * active: the account stayed Pro and the next cycle charged the person again.
 * Lowering `plan` alone would not hold either, since the next
 * `customer.subscription.updated` or the reconciliation job (ADR-0015) would put
 * it back. The subscription itself is cancelled; `customer.subscription.deleted`
 * (already handled) then downgrades the account.
 *
 * Cancel only on a FULL refund of the CURRENT period's charge:
 * - a partial refund is a goodwill gesture, the person stays Pro;
 * - a charge from an earlier period is bookkeeping, not this period's access;
 * - an ended subscription has nothing left to cancel;
 * - the period start is the proof that the charge belongs to the current period.
 *   `Charge` no longer carries `invoice`, so the charge's own date is compared to
 *   the subscription's `current_period_start`. When it cannot be read, nothing is
 *   cancelled: no proof, no cancellation.
 */
export type RefundDecision
  = | { action: 'cancel', subscriptionId: string }
    | { action: 'ignore', reason: 'partial_refund' | 'already_ended' | 'unknown_period' | 'not_current_period' };

export function resolveRefundCancellation({ charge, subscription }: { charge: Stripe.Charge, subscription: Stripe.Subscription }): RefundDecision {
  if (!charge.refunded) {
    return { action: 'ignore', reason: 'partial_refund' };
  }
  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    return { action: 'ignore', reason: 'already_ended' };
  }
  const periodStart = subscription.items.data[0]?.current_period_start;
  if (typeof periodStart !== 'number') {
    return { action: 'ignore', reason: 'unknown_period' };
  }
  if (charge.created < periodStart) {
    return { action: 'ignore', reason: 'not_current_period' };
  }
  return { action: 'cancel', subscriptionId: subscription.id };
}

/** The Stripe customer a charge belongs to (bare id or expanded object), or `null` when it has none. */
export function resolveChargeCustomerId(charge: Stripe.Charge): string | null {
  const customer = charge.customer;
  if (!customer) {
    return null;
  }
  return typeof customer === 'string' ? customer : customer.id;
}
