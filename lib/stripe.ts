import Stripe from 'stripe';

// Server-only Stripe client (ADR-0007: Stripe Checkout, hosted, `subscription`
// mode). NEVER import this from a Client Component or any code path reachable
// by the browser — `STRIPE_SECRET_KEY` is a full-account secret, not a
// publishable key. Consumed today by `app/api/stripe/checkout/route.ts` and
// `app/api/stripe/webhook/route.ts` only.
//
// No dedicated zod schema for this one var (unlike `lib/env.ts`/
// `api/config/env.ts`) — a single required string doesn't earn a new schema
// file per STORY-FRESCO-228's implementation plan; this mirrors the same
// fail-fast-at-first-use judgment call those files make, just inlined.

function requireStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is required — copy .env.example to .env and fill it in');
  }

  return key;
}

/** Initialized Stripe SDK client. Import this instead of constructing `new Stripe(...)` at call sites. */
export const stripe = new Stripe(requireStripeSecretKey(), {
  // Pinned to the version this SDK (`stripe@22.5.0`) was generated against —
  // otherwise the effective API version is whatever Stripe's account default
  // is at call time, an implicit and silently-shiftable surface.
  apiVersion: '2026-07-29.dahlia',
});

export interface ProUpdateFromSession {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  /** ISO timestamp — the trial's end date, becomes `user_profiles.plan_expires_at`. */
  planExpiresAt: string
}

/**
 * Pure mapping from a completed Checkout Session + its Subscription to the
 * `user_profiles` write the webhook handler (`checkout.session.completed`)
 * performs. Kept side-effect-free and network-free on purpose — the network
 * calls (creating the session, fetching the subscription, verifying the
 * webhook signature, writing to Supabase) all live in
 * `app/api/stripe/webhook/route.ts`, so this is the one piece of that flow
 * that's trivially unit-testable (`lib/stripe.test.ts`).
 *
 * `client_reference_id` is set to the authenticated Supabase user id at
 * Checkout Session creation time (`app/api/stripe/checkout/route.ts`) — see
 * ADR-0007. `plan_expires_at` reads the subscription's `trial_end` (STORY-
 * FRESCO-228 scope only covers the trial-start write; a later story updates
 * this again once the trial converts to `current_period_end`).
 *
 * Throws — rather than returning a partial/undefined shape — if the session
 * or subscription is missing a field this flow depends on. The webhook route
 * handler is the only caller, and it deliberately catches downstream errors
 * after signature verification (logs + still returns 200, to avoid Stripe
 * retry storms) — so a thrown error here surfaces as a logged, non-fatal
 * failure, not a crash.
 */
export function resolveProUpdateFromSession(
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription,
  expectedPriceId: string,
): ProUpdateFromSession {
  const userId = session.client_reference_id;
  if (!userId) {
    throw new Error('Checkout session is missing client_reference_id — cannot map it to a user_profiles row.');
  }

  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!stripeCustomerId) {
    throw new Error('Checkout session is missing a Stripe customer id.');
  }

  if (!subscription.trial_end) {
    throw new Error('Subscription is missing trial_end — cannot compute plan_expires_at.');
  }

  // Code review on PR #100: without this check, ANY completed subscription
  // checkout in the Stripe account (not just the Pro price) would grant
  // `plan: 'pro'` — this is the only server-side check standing between
  // that and a Pro grant, since Checkout Session creation trusts whatever
  // price id the client requested.
  const actualPriceId = subscription.items.data[0]?.price.id;
  if (actualPriceId !== expectedPriceId) {
    throw new Error(`Subscription price ${actualPriceId ?? '(none)'} does not match expected Pro price ${expectedPriceId} — refusing to grant Pro.`);
  }

  return {
    userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    planExpiresAt: new Date(subscription.trial_end * 1000).toISOString(),
  };
}
