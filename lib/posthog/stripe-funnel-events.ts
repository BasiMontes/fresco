import type Stripe from 'stripe';
import { POSTHOG_EVENTS } from './event-names';

/**
 * FRESCO-366 / A4-B4: maps a Stripe subscription webhook transition to the
 * monetisation-funnel event it represents. Pure — `app/api/stripe/webhook/
 * route.ts` owns the capture + the `user_profiles` writes.
 *
 * These fire server-side (`captureServerEvent`) because the webhook has no
 * browser and because a payment event is exactly where ad-blocker loss on a
 * client capture would be unacceptable (ADR-0013).
 */

/**
 * `checkout.session.completed`. `app/api/stripe/checkout/route.ts` always
 * opens the subscription with `trial_period_days: 7`, so the normal path is
 * `status: 'trialing'` → the trial started. A non-trialing status means the
 * trial was skipped (config change, or Stripe decided none applied) and the
 * customer is paying from day one.
 */
export function resolveCheckoutFunnelEvent(status: Stripe.Subscription.Status): string {
  return status === 'trialing'
    ? POSTHOG_EVENTS.TRIAL_STARTED
    : POSTHOG_EVENTS.TRIAL_CONVERTED_TO_PAID;
}

/**
 * `customer.subscription.updated` landing on `status: 'active'`. Stripe
 * includes the pre-change field values in `event.data.previous_attributes`:
 *
 * - prior status `trialing` → the trial just converted to its first paid period.
 * - prior status `past_due` → a failed charge was recovered; no funnel event
 *   (it is neither a conversion nor a fresh renewal), returns `null`.
 * - anything else (prior status `active`, or absent) → a renewal / period roll.
 */
export function resolveActiveUpdateFunnelEvent(previousStatus: Stripe.Subscription.Status | undefined): string | null {
  if (previousStatus === 'trialing') {
    return POSTHOG_EVENTS.TRIAL_CONVERTED_TO_PAID;
  }
  if (previousStatus === 'past_due') {
    return null;
  }
  return POSTHOG_EVENTS.SUBSCRIPTION_RENEWED;
}

/**
 * Reads the `event.data.previous_attributes` bag (loosely typed on the
 * generic `Stripe.Event`) for the prior subscription status, if present.
 */
export function previousSubscriptionStatus(previousAttributes: unknown): Stripe.Subscription.Status | undefined {
  if (previousAttributes && typeof previousAttributes === 'object' && 'status' in previousAttributes) {
    const status = (previousAttributes as { status?: unknown }).status;
    return typeof status === 'string' ? status as Stripe.Subscription.Status : undefined;
  }
  return undefined;
}
