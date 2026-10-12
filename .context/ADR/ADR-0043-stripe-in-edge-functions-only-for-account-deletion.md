# ADR-0043 — Stripe in Edge Functions only for account deletion

- **Status:** Proposed <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-12
- **Deciders:** Founder (acceptance pending); drafted by AI workflow (FRESCO-942, audit finding C-01)
- **Tags:** stripe, billing, edge-function, account-lifecycle, privacy
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`delete-account` removed the `auth.users` row and let the FK cascade erase everything else, including `user_profiles.stripe_customer_id` and `stripe_subscription_id`. Nothing called Stripe. A Pro user who deleted their account kept an active subscription and kept being charged, with no local row left to find the customer by (audit C-01). The Stripe customer, with its email, also survived the deletion, which is a data-erasure gap.

Until now Stripe has lived only in the Next.js app (ADR-0007: Checkout hosted, webhook is the only writer of plan state; ADR-0015: reconciliation job). The Edge Functions have no Stripe dependency. Deletion has to cancel billing *before* the cascade, and the function that performs it is an Edge Function (ADR-0023).

## Decision

**`delete-account` calls Stripe directly, and only for this purpose.** Before `auth.admin.deleteUser`:

1. Read `user_profiles.stripe_customer_id` with the service-role client. A read error aborts with 500 and nothing is deleted. No row or a null id means Stripe is skipped.
2. List the customer's subscriptions and cancel every non-terminal one (`active`, `trialing`, `past_due`, `unpaid`, `incomplete`, `paused`) with `invoice_now: false, prorate: false` and idempotency key `delete-account:<uid>:<subId>`. Then delete the Stripe customer.
3. A Stripe error with code `resource_missing` (an id from the other Stripe mode, or already deleted) means there is nothing to cancel with this key: log a warning and continue. Any other error (auth, network, rate limit) answers **502** with a retry message and the account is **not** deleted.

The code lives in `supabase/functions/_shared/stripe-billing.ts` (`cancelStripeBillingForCustomer`), using `npm:stripe` pinned in `supabase/functions/deno.json` to the same version as the app, with the same `apiVersion`, over the fetch HTTP client. The client is built lazily from the `STRIPE_SECRET_KEY` function secret, read only when a customer id exists; a missing key with a customer id is a failure (502), never a silent skip.

**Business decision (founder):** cancellation is immediate, with no refund and no proration. The deletion dialog says so.

**Boundaries kept:** this helper writes no plan or subscription column (ADR-0007: the webhook is the only writer); no other Edge Function may import it; checkout, portal and webhooks stay in the Next.js app.

## Consequences

- **Positive:** deleting an account ends billing and removes the Stripe customer. A Stripe outage cannot leave an orphan subscription, because the account survives until Stripe confirms.
- **Negative / trade-offs:** deletion now depends on Stripe availability for users with a customer id; the user must retry. The Edge Functions get a heavier dependency and a new secret (`STRIPE_SECRET_KEY`) that must be set per Supabase project. Under ADR-0020 there is one Supabase project for all environments, so it holds one Stripe mode's key; ids from the other mode are handled by the `resource_missing` rule, which means a test-mode customer is not cleaned up from live and the reverse.
- **Neutral / follow-ups:** setting the secret on Supabase is an owner action. Privacy-policy text and an e2e scenario against real Stripe are out of scope here.

## Alternatives considered

- **Call Stripe from the Next.js app before invoking the Edge Function.** Rejected: the dialog talks to the Edge Function directly, and splitting the steps across two services would let the client skip the cancellation.
- **Mark the subscription `cancel_at_period_end` instead of cancelling now.** Rejected by the founder: the account no longer exists, so the paid period has no one to serve.
- **Delete the account and clean Stripe up asynchronously.** Rejected: once the cascade runs the customer id is gone, so a failed async cleanup is unrecoverable.

## References

- `.context/ADR/ADR-0007-stripe-checkout-hosted-webhook-driven-subscription.md`, `ADR-0015-stripe-subscription-reconciliation-job.md`, `ADR-0020-single-supabase-project-until-pro.md`, `ADR-0023-delete-account-recent-reauth.md`.
- FRESCO-942; `.context/audits/2026-10-12-definitive/04-critical-audit.md` (C-01).
- `supabase/functions/delete-account/index.ts`, `supabase/functions/_shared/stripe-billing.ts`.
