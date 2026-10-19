/**
 * The Stripe event types the webhook route acts on, and so the ones every webhook endpoint of
 * every mode must be subscribed to. One list for both readers: the route claims only these in
 * `stripe_webhook_events`, and `scripts/check-stripe-go-live.ts` (FRESCO-1004) fails when an
 * endpoint lacks any of them, so a handler added here is checked at go-live without a second edit.
 *
 * `checkout.session.async_payment_succeeded` is the grant of a delayed payment method (SEPA and
 * the like); a card never emits it, but the endpoint has to be subscribed before such a method
 * is switched on.
 */
export const HANDLED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'charge.refunded',
  'charge.dispute.created',
]);
