# ADR-0062 — Stripe webhook: a transient Stripe failure answers 500 so Stripe retries; state is decided from the live subscription

- **Status:** Proposed <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-17
- **Deciders:** Basi Montes (plan approved in conversation on 2026-10-17; acceptance of this record pending)
- **Tags:** payments, stripe, reliability, webhook
- **Supersedes:** — (narrows the "always 200 after the signature" rule documented in `app/api/stripe/webhook/route.ts` since FRESCO-410; no earlier ADR recorded it)
- **Superseded by:** —

---

## Context

Audit 7b (A7-PAY-02, A7-PAY-05, A7-PAY-09) found three ways the webhook loses or misapplies a subscription change:

- After the signature verified, every failure was logged and answered 200 ("retrying a bug repeats the bug"). A Stripe outage is not a bug: a 5xx, a rate limit or a dropped connection passes by itself. The 200 told Stripe the event was delivered, so a paid renewal or a cancellation was lost until the daily reconcile cron (ADR-0015) found it.
- `customer.subscription.updated` and `deleted` decided from the event payload. Stripe does not guarantee order, so an `active` update that left Stripe before the deletion but arrived after it could write Pro back onto an ended subscription.
- A refunded charge cancelled `profile.stripe_subscription_id` without checking that the charge paid for that subscription, so refunding an old subscription's charge cancelled the current one.

## Decision

1. **Transient Stripe failures answer 500.** After the signature, a thrown error that `isTransientStripeError` recognises (`StripeAPIError`, `StripeConnectionError`, `StripeRateLimitError`, or a 5xx/429 status; `lib/billing/stripe-errors.ts`) releases the event claim and answers **500**, so Stripe retries with its backoff. Every other failure (a bug, a bad request, a database error) keeps the old behaviour: logged, claim released, **200**, manual replay as recovery.
2. **Subscription events decide from the live subscription.** `updated` and `deleted` re-read the subscription with `subscriptions.retrieve` after the profile and mode checks. `updated` recomputes the payment status and the renewal date from it; one Stripe reports as ended or no longer has writes nothing. `deleted` is ignored when Stripe still reports the subscription live.
3. **A refund cancels only the subscription its charge paid for.** The charge is resolved to its subscription (charge, PaymentIntent, invoice payment, invoice, subscription: `resolveChargeSubscriptionId`). If it cannot be resolved, or differs from the stored one, nothing is cancelled: no proof, no cancellation.

The invariant: **a webhook delivery that failed for a reason outside our code is never acknowledged, and a subscription event never writes state the live subscription contradicts.**

## Consequences

- **Positive:** a Stripe outage no longer drops renewals or cancellations; out-of-order delivery cannot resurrect an ended subscription; a refund cannot cancel the wrong subscription.
- **Negative / trade-offs:**
  - One extra `subscriptions.retrieve` per `updated`/`deleted` event, and two to three Stripe calls per refunded charge. The webhook only sees subscription events of a small user base, so the extra calls stay well inside Stripe's rate limit and the route's 60 s `maxDuration`.
  - A sustained Stripe outage makes Stripe retry for up to three days and the deploy answers 500 meanwhile; the claim TTL (`WEBHOOK_CLAIM_TTL_MS`) and the event claim keep the retries idempotent.
  - The classifier is by error type and status. A new transient error class is a 200 until it is added; it is a one-line change and the reconcile cron remains the backstop.
- **Neutral / follow-ups:**
  - Transient Supabase failures are not covered (they keep answering 200 and the cron backstop). Worth a separate ticket if Sentry shows them.
  - `checkout.session.completed` already reads the subscription live (FRESCO-816); unchanged.

## Alternatives considered

- **Answer 500 for every failure.** Rejected: a deterministic bug would be retried for three days and fill Sentry, with the same outcome each time.
- **Trust the event payload and rely on the reconcile cron.** Rejected: that is the current behaviour; the cron runs once a day, so the account is wrong for up to 24 hours, in the paying customer's disfavour or ours.
- **Resolve the refund through `charge.metadata` or the latest invoice of the customer.** Rejected: metadata is empty for Billing charges, and "latest invoice" is exactly the guess that picks the wrong subscription.

## References

- `.context/audits/2026-10-16-audit-7/w1-02-payments.md` (A7-PAY-02, A7-PAY-05, A7-PAY-09)
- `app/api/stripe/webhook/route.ts`, `lib/billing/stripe-errors.ts`, `lib/billing/refund.ts`, `lib/billing/refund-handler.ts`
- `app/api/stripe/webhook/route.test.ts`, `lib/billing/stripe-errors.test.ts`, `lib/billing/refund.test.ts`
- ADR-0007 (the webhook is the only writer of subscription state), ADR-0015 (reconcile cron), ADR-0061, FRESCO-816, FRESCO-909, FRESCO-900
