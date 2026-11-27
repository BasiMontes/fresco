/**
 * FRESCO-1285 — how long a payment waits for a Stripe that does not answer. With the SDK defaults (80 s per attempt,
 * two retries) one call took 241 s to give up (chaos experiments S1a/S1b). The owner approved these ceilings on
 * 2026-11-27; they are reasoned limits, real Stripe latency was not measured.
 *
 * The three layers fit together: a silent Stripe fails the first call at about 17 s (two attempts), the screen gives
 * up at 20 s and the function is cut at 30 s (`maxDuration` in the checkout and portal routes, which Next.js requires
 * as a literal). Aborting the screen does not cancel what Stripe already did; within the same minute the checkout
 * reuses the session through its idempotency key (`checkout-guard.ts`).
 */

/** For the shared server client (`lib/stripe.ts`), so the webhook and the daily reconciliation use them too. */
export const STRIPE_CLIENT_LIMITS = { timeout: 8_000, maxNetworkRetries: 1 } as const;

/** How long the pay and "manage subscription" buttons wait for our own route. */
export const STRIPE_SCREEN_TIMEOUT_MS = 20_000;

export const STRIPE_TIMEOUT_MESSAGE = 'Está tardando más de lo normal. Inténtalo de nuevo.';
