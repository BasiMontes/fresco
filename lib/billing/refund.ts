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
    | { action: 'ignore', reason: 'partial_refund' | 'unknown_charge_subscription' | 'other_subscription' | 'already_ended' | 'unknown_period' | 'not_current_period' };

/**
 * FRESCO-1002 (audit 7b: A7-PAY-05): the charge must belong to the subscription being
 * cancelled. A customer who resubscribed has an old charge and a current subscription on the
 * same Stripe customer; refunding the old one used to cancel the current one. `chargeSubscriptionId`
 * is the subscription that charge paid for (`resolveChargeSubscriptionId`), `null` when it
 * cannot be told: no proof, no cancellation.
 */
export function resolveRefundCancellation({ charge, subscription, chargeSubscriptionId }: { charge: Stripe.Charge, subscription: Stripe.Subscription, chargeSubscriptionId: string | null }): RefundDecision {
  if (!charge.refunded) {
    return { action: 'ignore', reason: 'partial_refund' };
  }
  if (!chargeSubscriptionId) {
    return { action: 'ignore', reason: 'unknown_charge_subscription' };
  }
  if (chargeSubscriptionId !== subscription.id) {
    return { action: 'ignore', reason: 'other_subscription' };
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

/**
 * The subscription a charge paid for: charge, its PaymentIntent, the invoice that PaymentIntent
 * settled, and that invoice's subscription. `Charge` carries neither `invoice` nor
 * `subscription` on the pinned API version. `null` when any link is missing (a one-off charge,
 * a charge outside Billing). Throws on a Stripe error.
 */
export async function resolveChargeSubscriptionId(stripe: Pick<Stripe, 'invoicePayments' | 'invoices'>, charge: Stripe.Charge): Promise<string | null> {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) {
    return null;
  }

  const payments = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntentId }, limit: 1 });
  const invoiceRef = payments.data[0]?.invoice;
  if (!invoiceRef) {
    return null;
  }

  const invoice = typeof invoiceRef === 'string' ? await stripe.invoices.retrieve(invoiceRef) : invoiceRef;
  if ('deleted' in invoice && invoice.deleted) {
    return null;
  }
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) {
    return null;
  }
  return typeof subscription === 'string' ? subscription : subscription.id;
}
