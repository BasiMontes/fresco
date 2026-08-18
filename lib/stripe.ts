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

let cachedStripe: Stripe | undefined;

function getStripe(): Stripe {
  cachedStripe ??= new Stripe(requireStripeSecretKey(), {
    // Pinned to the version this SDK (`stripe@22.5.0`) was generated against —
    // otherwise the effective API version is whatever Stripe's account default
    // is at call time, an implicit and silently-shiftable surface.
    apiVersion: '2026-07-29.dahlia',
  });

  return cachedStripe;
}

/**
 * Initialized Stripe SDK client. Import this instead of constructing
 * `new Stripe(...)` at call sites.
 *
 * Lazy via a Proxy (mirrors `lib/env.ts`'s `clientEnv`) — validation runs on
 * the FIRST property read, not at module import. A staging build (2026-08-18)
 * broke on this: Next.js's page-data-collection pass imports the whole module
 * graph, including route handlers that only reference `stripe` when actually
 * invoked — an eager `new Stripe(...)` at module scope crashed the build the
 * moment `STRIPE_SECRET_KEY` was unset anywhere, not just when the route
 * actually ran.
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const real = getStripe();
    return Reflect.get(real, prop, real);
  },
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

export interface RenewalUpdate {
  stripeCustomerId: string
  /** ISO timestamp — the current billing period's end, becomes `user_profiles.plan_expires_at`. */
  planExpiresAt: string
}

/**
 * Pure mapping from a `customer.subscription.updated` event's Subscription to
 * the `user_profiles` write the webhook handler performs on renewal (STORY-
 * FRESCO-230). Only called when the caller has already routed on event type —
 * this function itself gates on `status` so a caller mistake (e.g. wiring it
 * up to the wrong event) fails loudly instead of silently granting Pro.
 *
 * `current_period_end` is read off `subscription.items.data[0]`, not the
 * top-level `Subscription` object — on the pinned API version
 * (`2026-07-29.dahlia`) that field lives on `Stripe.SubscriptionItem`, not
 * `Stripe.Subscription` (confirmed against the installed SDK's own
 * `.d.ts` files; the top-level field no longer exists on this API version's
 * type).
 *
 * A subscription with `status !== 'active'` is deliberately NOT handled here
 * — this keeps the function correct-by-construction for the "cancel request
 * doesn't downgrade mid-period" AC: Stripe sets `cancel_at_period_end: true`
 * but leaves `status: 'active'` until the period actually ends, so this
 * helper still returns a Pro-preserving update in that case, no special-case
 * branching on `cancel_at_period_end` needed. The eventual downgrade happens
 * via `resolveCancellationCustomerId` on `customer.subscription.deleted`.
 */
export function resolveRenewalUpdate(subscription: Stripe.Subscription): RenewalUpdate {
  if (subscription.status !== 'active') {
    throw new Error(`Subscription ${subscription.id} is not active (status: ${subscription.status}) — refusing to resolve a renewal update.`);
  }

  const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!stripeCustomerId) {
    throw new Error('Subscription is missing a Stripe customer id.');
  }

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
  if (!currentPeriodEnd) {
    throw new Error('Subscription is missing current_period_end — cannot compute plan_expires_at.');
  }

  return {
    stripeCustomerId,
    planExpiresAt: new Date(currentPeriodEnd * 1000).toISOString(),
  };
}

/**
 * Pure mapping from a `customer.subscription.deleted` event's Subscription to
 * the Stripe customer id the webhook handler uses to look up the
 * `user_profiles` row to downgrade to `plan: 'free'` (STORY-FRESCO-230). This
 * event fires when Stripe actually ends the subscription (the paid period is
 * over) — not when a user merely requests cancellation.
 */
export function resolveCancellationCustomerId(subscription: Stripe.Subscription): string {
  const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!stripeCustomerId) {
    throw new Error('Subscription is missing a Stripe customer id.');
  }

  return stripeCustomerId;
}
