import type Stripe from 'stripe';

/**
 * FRESCO-1002 (audit 7b: A7-PAY-05, A7-PAY-09, ADR-0062) — which Stripe failures are worth a
 * retry.
 *
 * The webhook used to answer 200 after ANY failure past the signature, on the reasoning that
 * retrying a bug repeats the bug. That is right for a bug and wrong for an outage: Stripe's
 * own 5xx, a dropped connection or a rate limit pass on their own, and a 200 told Stripe the
 * event was delivered, so the subscription change was lost until the daily reconcile cron.
 */

/** `StripeError.type` is the class name (`stripe/cjs/Error.js`), so it can be read without `instanceof`. */
const TRANSIENT_ERROR_TYPES: ReadonlySet<string> = new Set(['StripeAPIError', 'StripeConnectionError', 'StripeRateLimitError']);

/** True for a Stripe error that a later attempt may well get past: 5xx, 429, a failed connection. */
export function isTransientStripeError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { type, statusCode } = error as { type?: unknown, statusCode?: unknown };
  if (typeof type === 'string' && TRANSIENT_ERROR_TYPES.has(type)) {
    return true;
  }
  return typeof statusCode === 'number' && (statusCode >= 500 || statusCode === 429);
}

function isMissingResource(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'resource_missing';
}

/** Subscription states that are over for good. */
const ENDED_STATUSES: ReadonlyArray<Stripe.Subscription.Status> = ['canceled', 'incomplete_expired'];

export function isEndedSubscription(subscription: Pick<Stripe.Subscription, 'status'>): boolean {
  return ENDED_STATUSES.includes(subscription.status);
}

/**
 * The subscription as Stripe has it NOW, or `null` when Stripe no longer has it. An event is
 * a snapshot of the moment it fired and arrives out of order; what the account should be is
 * decided from this. Any other failure is thrown for the caller to answer 500 or 200.
 */
export async function retrieveLiveSubscription(stripe: Pick<Stripe, 'subscriptions'>, subscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  }
  catch (error) {
    if (isMissingResource(error)) {
      return null;
    }
    throw error;
  }
}
