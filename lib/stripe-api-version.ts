/**
 * The Stripe API version every client in this repo pins (FRESCO-1268).
 *
 * It is the version the installed SDK was generated against, so it moves WITH `stripe` in `package.json`:
 * a new SDK narrows `apiVersion` to its own literal and `tsc` fails here, in one place, instead of in every
 * file that builds a client. Pinning keeps the effective version from silently following the account default.
 *
 * Bump it when `stripe` is bumped, after reading Stripe's changelog (`https://docs.stripe.com/changelog`).
 * Versions inside one release name, such as `endive`, only add; a new release name can break.
 *
 * The Edge Functions (Deno) pin their own, in `supabase/functions/_shared/stripe-billing.ts`, next to their own
 * `stripe` pin in `supabase/functions/deno.json`; Dependabot does not watch that one.
 *
 * Kept free of `server-only` and of any import so scripts, Playwright steps and tests can import it too.
 */
export const STRIPE_API_VERSION = '2026-11-18.endive';
