# Stripe settings: what was read, when, and where

> FRESCO-987. Read-only reading of the Stripe account behind the test key, to settle audit 7b findings
> `A7-LAUNCH-04` ("IVA incluido") and `A7-LAUNCH-05` (cancelling in the Billing Portal), which the audit
> could not verify. Method: `bunx varlock run -- bun scripts/check-stripe-go-live.ts`
> ([`stripe-go-live.md`](./stripe-go-live.md) explains each line). Nothing was written to Stripe.
> Live mode is read only once a live account exists; at the date of the reading below there was none.

## Reading of 2026-10-20, test mode

The reading uses the test key of the machine that ran it, so it describes the test-mode account, not each
deployed environment one by one. It was not checked whether `dev`, `pre` and `pro` hold that same key; the
Vercel lines only confirm that the variable names are set. The live account does not exist.

| Setting | Value read | Verdict |
|---|---|---|
| Webhook endpoint | enabled, subscribed to every event the handler uses (`lib/billing/handled-events.ts`, `charge.refunded` and the dispute included) | pass |
| Billing Portal default configuration | active | pass |
| Portal: `subscription_cancel` | enabled | pass, **`A7-LAUNCH-05` discarded** |
| Portal: `payment_method_update` | enabled | pass |
| Price month: `tax_behavior` | `unspecified` | **fail, `A7-LAUNCH-04` confirmed** |
| Price year: `tax_behavior` | `unspecified` | **fail, `A7-LAUNCH-04` confirmed** |
| Vercel production variable names | all required names set | pass |
| Supabase Edge secret names | all required names set | pass |
| Failed-payment retries (dunning) | not exposed by the API | manual, owner confirms in the dashboard |

## What the code does about it

Checkout sets no `automatic_tax` (a comment in `lib/billing/confirmation-email.ts` says so) and prints
"IVA incluido" only when the Price is `inclusive` (`stripe-go-live.md`). With both prices `unspecified` the app
therefore claims nothing false at the date of the reading: it just never says the price includes VAT, and Stripe holds no tax
treatment for the amount. The gap is on the Stripe side, not in the copy.

## Not readable through the API

| Setting | Where to look | State |
|---|---|---|
| Smart Retries and the final action of failed payments | Dashboard, Settings, Billing, Subscriptions and emails | owner, pending |
| Customer receipts and the trial-end email | Same page, "Customer emails" | owner, pending |
| Payment methods offered by Checkout | The session sets no `payment_method_types`, so the dashboard's payment-method settings decide | owner, pending |

## Follow-ups

- A Price with no `tax_behavior` has its own card under FRESCO-884. Stripe lets an `unspecified` price take a
  `tax_behavior` once, and the value cannot change afterwards, so the owner decides `inclusive` (the copy already
  assumes it) before any price is used in live mode.
- Repeat this reading with the live key when the live account exists, and add a `live` row to each line above.
