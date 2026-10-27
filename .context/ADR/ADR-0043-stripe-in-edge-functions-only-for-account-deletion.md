# ADR-0043 — Stripe in Edge Functions only for account deletion

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-12
- **Deciders:** Basi Montes (accepted in writing on 2026-10-27 after reading the summary; the 14-day withdrawal refund stays an open legal question, see below); drafted by AI workflow (FRESCO-942, audit finding C-01)
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
2. List the customer's subscriptions and cancel every non-terminal one (`active`, `trialing`, `past_due`, `unpaid`, `incomplete`, `paused`) with `invoice_now: false, prorate: false` and idempotency key `delete-account:<uid>:<subId>`.
3. **Refund the unused period** of each subscription's latest paid invoice (policy below), then delete the Stripe customer.
4. A Stripe error with code `resource_missing` (an id from the other Stripe mode, or already deleted) means there is nothing to cancel with this key: log a warning and continue. Any other error (auth, network, rate limit) answers **502** with a retry message and the account is **not** deleted.

The code lives in `supabase/functions/_shared/stripe-billing.ts` (`cancelStripeBillingForCustomer`), using `npm:stripe` pinned in `supabase/functions/deno.json` to the same version as the app, with the same `apiVersion`, over the fetch HTTP client. The client is built lazily from the `STRIPE_SECRET_KEY` function secret, read only when a customer id exists; a missing key with a customer id is a failure (502), never a silent skip.

**Refund policy (founder decision, replaces an earlier "no refund" draft):** cancellation is immediate and the user gets the proportional refund of the unused period, as the published terms promise ("la parte proporcional no disfrutada", `components/legal/legal-content-data.ts:129`). The deletion dialog says so. Rules:

- Refund only if the most recent paid invoice with `amount_paid > 0` (looked up among the last 5) exists; trials and unpaid invoices refund nothing.
- Unused fraction = `max(0, period_end - T) / (period_end - period_start)`, capped at 1. The period comes only from the invoice's recurring subscription lines (`parent.type = subscription_item_details`, not a proration, positive amount, same subscription); proration, one-off and credit lines are ignored.
- `T` is the `ended_at` returned by `subscriptions.cancel` on the first run (now only if absent) and the subscription's own `ended_at` on a retry, so both runs compute the same amount, and a subscription that ran to period end refunds 0.
- **Cancellation marker:** this flow cancels with `cancellation_details.comment = "delete-account:<userId>"`. An already `canceled` subscription is refunded only when its comment carries the marker for this same user, so an old portal or dunning cancellation is never refunded from a past date, while a retry the next day still completes the job.
- **Top-up semantics:** target = `round(amount_paid * fraction)`; refund `max(0, target - alreadyRefunded)`, never above `amount_paid - alreadyRefunded` (failed or canceled refunds do not count). Idempotency key `delete-account-refund:<uid>:<invoiceId>:<amount>`. Retries therefore never refund twice: top-up semantics make the second run's amount 0, and the amount-keyed idempotency covers a request still in flight.
- Order: cancel, refund, delete customer, delete user. A refund failure other than the exceptions below answers 502 and the account is kept.
- **Exception, erasure wins:** if the payment can no longer be refunded, the deletion goes ahead and the owner refunds by hand. This applies when Stripe answers `charge_already_refunded`, `charge_disputed` or `refund_disputed_payment` (codes confirmed in Stripe's error-codes reference; no broad `invalid_request_error` catch-all), when the payment is older than Stripe's 180-day card refund window (checked up front from `status_transitions.paid_at`, because the exact error code for an expired charge is not confirmed), when the payment is out of band (`payment_record`) or has no `payment_intent`/`charge`, and when the invoice has no identifiable subscription line. In each case `logger.error` records user, customer, subscription, invoice and `amountOwed`, which reaches Sentry.

**Open legal question:** the terms also promise a full refund within 14 days of contracting unless the user waived it (consent `withdrawal_waiver`). This ADR implements only the proportional refund; the 14-day case is not handled.

**Boundaries kept:** this helper writes no plan or subscription column (ADR-0007: the webhook is the only writer); no other Edge Function may import it; checkout, portal and webhooks stay in the Next.js app.

## Consequences

- **Positive:** deleting an account ends billing and removes the Stripe customer. A Stripe outage cannot leave an orphan subscription, because the account survives until Stripe confirms.
- **Negative / trade-offs:** deletion now depends on Stripe availability for users with a customer id; the user must retry. The Edge Functions get a heavier dependency and a new secret (`STRIPE_SECRET_KEY`) that must be set per Supabase project. Under ADR-0020 there is one Supabase project for all environments, so it holds one Stripe mode's key; ids from the other mode are handled by the `resource_missing` rule, which means a test-mode customer is not cleaned up from live and the reverse.
- **Neutral / follow-ups:** setting the secret on Supabase is an owner action. Privacy-policy text and an e2e scenario against real Stripe are out of scope here.

## Known limitations

- A user whose `stripe_customer_id` is still null (the webhook has not written it yet) is skipped, so a subscription created moments before deletion is not cancelled. Tracked in FRESCO-909; the customer-by-email lookup is deferred.

## Alternatives considered

- **Call Stripe from the Next.js app before invoking the Edge Function.** Rejected: the dialog talks to the Edge Function directly, and splitting the steps across two services would let the client skip the cancellation.
- **Mark the subscription `cancel_at_period_end` instead of cancelling now.** Rejected by the founder: the account no longer exists, so the paid period has no one to serve.
- **Cancel with no refund.** Rejected by the founder: it contradicts the published terms.
- **Let Stripe prorate (`prorate: true`, `invoice_now: true`).** Rejected: it issues a credit on a customer we are about to delete rather than money back, and it creates a new invoice.
- **Delete the account and clean Stripe up asynchronously.** Rejected: once the cascade runs the customer id is gone, so a failed async cleanup is unrecoverable.

## References

- `.context/ADR/ADR-0007-stripe-checkout-hosted-webhook-driven-subscription.md`, `ADR-0015-stripe-subscription-reconciliation-job.md`, `ADR-0020-single-supabase-project-until-pro.md`, `ADR-0023-delete-account-recent-reauth.md`.
- FRESCO-942; `.context/audits/2026-10-12-definitive/04-critical-audit.md` (C-01).
- `supabase/functions/delete-account/index.ts`, `supabase/functions/_shared/stripe-billing.ts`, `components/legal/legal-content-data.ts:129`.

## Addendum 2026-10-13 (FRESCO-945): the null-customer limitation is closed

The "Known limitations" entry above is resolved. When `user_profiles.stripe_customer_id` is null and the caller is a registered account, `delete-account` now looks the customer up in Stripe before deleting (`findStripeCustomerForUser` in `_shared/stripe-billing.ts`): it lists the Checkout Sessions completed in the last 72 hours, filters by `client_reference_id === user.id` (Stripe cannot filter on that field), and passes the most recent match's customer to `cancelStripeBillingForCustomer`. Nothing is written to the profile (ADR-0007 still holds). With no match the account is deleted as before.

Failure modes, decided separately because they have different costs:

- **A Stripe error during the lookup fails closed** (502, account not deleted), like a failed cancellation: the alternative is deleting the only link to a subscription that may still bill.
- **A missing `STRIPE_SECRET_KEY` does NOT fail closed for the lookup.** It is reported to Sentry and the account is deleted. The lookup now runs for every registered account without a stored customer id, which is most of them, so failing closed on a misconfigured environment would stop nearly everyone from deleting their account. An account that already has a customer id still fails closed without the key, as before.

The 72-hour window is wider than the webhook retry window and the daily checkout sweep of ADR-0015 (FRESCO-909).
