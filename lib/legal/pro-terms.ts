/**
 * FRESCO-794 (ADR-0040) — the commercial facts about the Pro plan that both the
 * checkout and the pre-contract summary must agree on. One definition, so what
 * the user is told before paying is what Stripe is asked to do.
 */

/** Days of the free trial. Passed to Stripe as `trial_period_days` (`/api/stripe/checkout`) and shown in the summary. */
export const PRO_TRIAL_DAYS = 7;

export interface TrialHistory {
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

/**
 * A user whose profile carries a Stripe customer or subscription id has already
 * been through a checkout (the webhook writes them on the first completed one
 * and nothing clears them), so the trial is used up (FRESCO-778, audit-6 A6-S3).
 * That user subscribes again WITHOUT a trial and with a card, and is charged
 * from the first day.
 */
export function isTrialAvailable(profile: Partial<TrialHistory> | null | undefined): boolean {
  return !(profile?.stripe_customer_id || profile?.stripe_subscription_id);
}
