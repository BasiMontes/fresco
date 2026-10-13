# ADR-0015 — Stripe subscription reconciliation job

- **Status:** Accepted
- **Date:** 2026-08-28
- **Deciders:** Basi Montes
- **Tags:** payments, stripe, subscription, scheduling, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`ADR-0007` established `POST /api/stripe/webhook` as the **only** writer of subscription
state in `user_profiles` (`plan`, `plan_expires_at`, `stripe_customer_id`,
`stripe_subscription_id`, `payment_failed_at`). Stripe is the source of truth; the webhook
is the single write path.

Discovered during the `business-data-map` / `business-api-map` regeneration (PR #169): there
is no reconciliation job. If a webhook delivery is lost or never delivered (endpoint down
past Stripe's ~3-day retry window, endpoint misconfigured, a bug that 200s without
persisting), `user_profiles` diverges from Stripe **silently and permanently** — nobody
detects it until a user complains. The three existing `pg_cron` jobs
(`cleanup-abandoned-guest-users`, `send-weekly-reengagement-push`,
`cleanup-expired-rate-limits`) none of them touch Stripe.

Today there are 0 paying subscribers, so the current exposure is theoretical — but a
reconciliation path is a real requirement before payment volume exists, and retrofitting it
after a divergence incident is worse.

All the Stripe→`user_profiles` mapping logic (`resolveRenewalUpdate`,
`resolvePaymentStatusUpdate`, `resolveProUpdateFromSession`, price-id guard) lives in the
**Next.js runtime** (`lib/stripe.ts`), unit-tested in `lib/stripe.test.ts`. A Supabase Edge
Function cannot import that module (different runtime), so an Edge-Function reconciler would
have to re-implement it in Deno — creating exactly the two-implementations drift risk this
job exists to eliminate.

## Decision

We will add a **daily reconciliation job**: `pg_cron` + `pg_net` invokes a new Next.js route
`GET /api/cron/stripe-reconcile` (Bearer-authenticated with a dedicated `CRON_SECRET`,
Vault-sourced in the scheduling migration). The route iterates `user_profiles` rows with a
non-null `stripe_subscription_id`, fetches each subscription from the Stripe API, derives
the target state with the **same `lib/stripe.ts` helpers the webhook uses**, and writes the
diff (if any) via the service-role client.

This is a **second write path into subscription state**, and it is deliberately constrained:

- It **only derives from Stripe** — it never trusts client input and never invents state.
- It is **drift-correcting, not authoritative** — in steady state (healthy webhooks) it
  writes 0 rows.
- It **upholds every invariant `ADR-0007` set**, including the price-id guard: it never
  grants `plan: 'pro'` for a subscription whose price is not the Pro price.
- It **never rewrites** `stripe_customer_id` / `stripe_subscription_id`, and on downgrade
  it leaves `plan_expires_at` untouched — byte-for-byte the same column writes the webhook's
  `customer.subscription.deleted` handler makes, so the two writers never disagree.

`pg_cron` remains the only scheduler in the project (consistent with `ADR-0011`). What is
new relative to `ADR-0011`: the `pg_net` call targets an **external Vercel URL**
(`fresco-pro.vercel.app`) rather than a Supabase-internal Edge Function — the first
non-internal `net.http_post` target. Because one Supabase project backs all three
environments and there is one Stripe account, the job fires once and hits the production
app URL only.

## Consequences

- **Positive:** subscription state can no longer diverge from Stripe undetectably. Zero
  logic duplication — the reconciler reuses the tested webhook mapping helpers directly.
  One scheduler (`pg_cron`) for all time-based work. The schedule lives in a
  version-controlled migration, not a dashboard.
- **Negative / trade-offs:** a second write path into `user_profiles` subscription state —
  mitigated by the constraints above, but every future change to that column set now has
  two call sites to keep consistent (the webhook and `resolveReconciledState`). `pg_net`
  now depends on the production Vercel deploy being reachable — a prod outage means a
  skipped reconcile run (self-heals next run; acceptable given daily cadence and Stripe's
  own 3-day retry). The cron auth depends on a Vault secret + a Vercel env var staying in
  sync; a mismatch makes every run 401 (caught in Vercel/Sentry logs, same failure mode as
  the weekly-push job's `edge_function_service_role_key`).
- **Neutral / follow-ups:** an admin-triggered manual reconcile endpoint is out of scope
  and can be added later without superseding this ADR. If drift is ever observed in
  practice, alerting/dashboarding on the `drifted` count is a follow-up. Daily cadence is a
  starting point — revisit if payment volume or a real incident argues for hourly.

## Alternatives considered

- **`pg_cron` + `pg_net` → a new Supabase Edge Function** — rejected: would re-implement
  ~150 lines of `lib/stripe.ts` mapping logic in Deno, the exact drift risk this job
  targets; needs `STRIPE_SECRET_KEY` added as an Edge secret. The `ADR-0011`-precedent match
  is not worth the duplication.
- **Manual admin reconcile endpoint only, no cron** — rejected: leaves the "nobody detects
  it" gap the ticket calls out. A human has to know to run it.
- **Vercel Cron hitting the route** — rejected for the same reason `ADR-0011` rejected it:
  a second scheduling surface. `pg_cron` stays the one scheduler.
- **A dedicated `subscriptions` table reconciled against Stripe** — rejected: `ADR-0007`
  explicitly keeps subscription state as `user_profiles` columns; introducing a parallel
  table would supersede that decision for no benefit here.

## References

- `.context/ADR/ADR-0007-stripe-checkout-hosted-webhook-driven-subscription.md` — the
  single-writer invariant this job extends under constraint.
- `.context/ADR/ADR-0011-pg-cron-pg-net-scheduled-http-triggers.md` — the scheduling
  pattern; this is its first external-URL target.
- `app/api/stripe/webhook/route.ts` + `lib/stripe.ts` — the mapping helpers the reconciler
  reuses.
- `supabase/migrations/20260823212400_schedule_weekly_push_reminders.sql` — the
  Vault-sourced-secret `pg_cron`+`pg_net` migration pattern to follow.
- FRESCO-301 — the tech-debt ticket; `spec_implementation_plan` fallback comment carries the
  step-level plan.

## Addendum 2026-10-13 (FRESCO-909, audit C-03): the inverse sweep

The decision above stands. The job as accepted starts from `user_profiles` rows that already
carry a `stripe_subscription_id`, so it can never find the customer this ADR's own Context
section worries about most: one who paid while the webhook never landed. That row has no
subscription id yet, and the job's `IS NOT NULL` filter skips it. C-03 made this concrete:
a webhook event claimed by a worker that then died was recorded as processed and never
retried, and the cron could not cure it.

Two changes close the gap, without changing who may write subscription state:

- **The webhook claim now expires** (`claimed_at` / `completed_at` on `stripe_webhook_events`,
  PRs #622 and #623). A claim with no completion past the TTL is retaken by the next delivery;
  a younger one is answered 409 so Stripe keeps retrying.
- **The cron gains a second pass that starts from Stripe**
  (`sweepPaidCheckoutsWithoutPro`, `lib/billing/checkout-sweep.ts`): it lists the subscription
  Checkout Sessions completed in the last 48 h and, for any user whose stored subscription is
  not the one they paid for, grants Pro through `grantProFromCheckoutSession`
  (`lib/billing/grant-pro.ts`), the same function the webhook now calls.

Constraints, so this stays inside the invariants above:

- **One grant path.** The sweep does not re-implement the mapping: payment settled,
  subscription live, Pro price and `client_reference_id` are all enforced inside
  `grantProFromCheckoutSession`, which refuses otherwise. A refusal is counted and logged, not
  written around.
- **Only the newest session per user is considered**, so an older session never overwrites a
  later subscription. A user whose stored id already matches is skipped, which also leaves a
  deliberately downgraded row alone (the main loop owns drift on known subscriptions).
- **Fail-soft and idempotent.** A session that errors never stops the rest, and a Stripe
  listing error leaves the reconcile result of the run intact (`checkoutSweep: null`). With
  healthy webhooks the pass grants 0 rows. Replaying a grant for an already-stored
  subscription rewrites the same values and sends no second email or funnel event.
- **The 48 h window** matches the daily cadence plus one missed run. Widen it if the cron is
  ever expected to be down longer; the response field `checkoutSweep.granted` is the signal
  that webhooks are losing events.

This adds a third call site for the subscription columns (webhook, `resolveReconciledState`,
the sweep), all routed through `lib/stripe.ts` helpers and `lib/billing/subscription.ts`.
