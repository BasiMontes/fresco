# Comments for FRESCO-301

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-301)

---

### Basi Montes - 8/28/2026, 10:33:16 AM

## Spec Implementation Plan (Dev)

***Ticket******:*** FRESCO-301 — Stripe: job de reconciliación para webhooks de suscripción perdidos/fallidos
***Approach******:*** daily `pg*cron` + `pg*net` → new Next.js route `GET /api/cron/stripe-reconcile`, Bearer-auth via a new `CRON_SECRET`. Reuses `lib/stripe.ts` (no Stripe logic duplicated into Deno). Admin manual endpoint deferred (separate ticket if support ever needs it).

### Why this shape

- `ADR-0007` makes `POST /api/stripe/webhook` the ONLY writer of subscription state (`plan`, `plan*expires*at`, `stripe*customer*id`, `stripe*subscription*id`, `payment*failed*at`). A lost/failed webhook desyncs `user_profiles` from Stripe silently and permanently.
- The webhook + all Stripe helpers (`resolveRenewalUpdate`, `resolvePaymentStatusUpdate`, ...) live in the Next.js runtime. An Edge Function reconciler would have to re-implement that logic in Deno — the exact drift risk this ticket exists to kill. Keeping the reconciler in Next.js reuses the tested helpers directly.
- `pg*cron` stays the only scheduler (spirit of `ADR-0011`). What is new: `pg*net` calls an external Vercel URL instead of a Supabase-internal Edge Function — the first non-internal target.

### Reconcile logic

Iterate `user*profiles` rows where `stripe*subscription_id IS NOT NULL` (bounded by our users, not Stripe's catalog — avoids paginating `subscriptions.list`). Per row:

1. `stripe.subscriptions.retrieve(stripe*subscription*id)`.
2. Derive desired state:

| Stripe status | Desired state |
| --- | --- |
| `active` / `trialing` (price = Pro) | `plan: 'pro'`, `plan*expires*at` = `current*period*end` (or `trial*end` if trialing), `payment*failed_at` cleared |
| `past*due` | keep `plan: 'pro'`, set `payment*failed_at` if currently null |
| `unpaid` / `canceled` / `incomplete*expired` | `plan: 'free'`, `payment*failed_at` cleared |
| Stripe 404 `resource*missing` | treat as deleted → `plan: 'free'`, `payment*failed_at` cleared |

1. Compare with the row. On diff → service-client `update` + structured log (subscription id, from→to). Count reconciled.
2. Response: `{ checked, reconciled, drifted: [{ userId, field, from, to }] }`.

Idempotent and read-mostly: with healthy webhooks it updates 0 rows per run. Price-id guard preserved — never grants Pro for a non-Pro price. `stripe*customer*id` / `stripe*subscription*id` are never rewritten by the reconciler (matches the webhook's `deleted` handler, which keeps the ids for history).

### Files

| File | Change |
| --- | --- |
| `app/api/cron/stripe-reconcile/route.ts` | new route. `export const dynamic = 'force-dynamic'`. Bearer check against `CRON_SECRET` (401 on mismatch, 500 if unset). Iterate + reconcile. |
| `lib/stripe.ts` | + pure helper `resolveReconciledState(subscription, expectedPriceId)` returning the target `{ plan, planExpiresAt, paymentFailedAt }` (or a downgrade shape). Consolidates status→state so it is unit-tested next to the existing resolvers. |
| `lib/stripe.test.ts` | cases for the new helper: active, trialing, past*due, unpaid, canceled, price mismatch, missing current*period_end. |
| `app/api/cron/stripe-reconcile/route.test.ts` | optional light integration test (auth reject + happy path with a mocked Stripe + service client). |
| `supabase/migrations/<ts>*schedule*stripe*reconciliation.sql` | `cron.schedule('stripe-reconcile-subscriptions', '17 4 ** ** *', ...)` → `net.http*post` to the prod URL, `Authorization: Bearer <vault secret 'stripe*reconcile*cron*secret'>`. Follows the `schedule*weekly*push*reminders` migration pattern (Vault-sourced secret, never a literal). |
| `.env.example` | + `CRON*SECRET` (with a comment: used by the pg*cron reconcile job; set in Vercel Production scope + Supabase Vault). |
| `.context/ADR/ADR-0015-stripe-subscription-reconciliation-job.md` | `Proposed`. References `ADR-0007` (adds a second, controlled write path: derives only from Stripe, corrects drift, never grants Pro without the price-id check) + `ADR-0011` (extends pg*cron→pg*net to an external Vercel URL). |

### Manual steps (cannot live in the migration)

1. ***Vercel*** — set `CRON_SECRET` (random, e.g. `openssl rand -hex 32`) in the Production scope (min.); also Preview/Development for local + preview manual-test parity.
2. ***Supabase Vault*** — `select vault.create*secret('<CRON*SECRET value>', 'stripe*reconcile*cron*secret', 'Bearer token pg*cron uses to auth the Stripe reconcile route (FRESCO-301)');`
3. ***Deploy order*** — the endpoint must exist in prod before the migration's cron first fires. Merge + prod-deploy the route, then apply the migration.

### Shared-Supabase caveat

One Supabase project (`jdqemhewjrjuopssdurn`) backs dev/pre/pro. The cron job fires once and must hit ONE app URL: production (`fresco-pro.vercel.app`) — the only always-deployed target, same shared DB, same Stripe account (test mode today). Documented in the migration header + the ADR.

### Environment / DB notes

- `STRIPE*SECRET*KEY` is already present in the Next.js runtime on Vercel (webhook + checkout use it). No new Stripe secret.
- `user*profiles` columns to verify at implementation time (post `20260827212133*drop*dead*columns`): `plan`, `plan*expires*at`, `stripe*customer*id`, `stripe*subscription*id`, `payment*failed*at`.
- `Sentry` (ADR-0009) already wired — reconcile errors surface there; no new alerting in scope.

### Out of scope

- Admin manual reconcile endpoint.
- Drift alerting / dashboard (log-only; Sentry catches errors).
- Reconciling `stripe*customer*id` mismatches (webhook sets it once, never changes).

### Steps

1. `lib/stripe.ts` — add `resolveReconciledState` + interface; unit tests red→green.
2. `app/api/cron/stripe-reconcile/route.ts` — Bearer guard + iterate + reconcile, using the helper.
3. Route test (auth reject + happy path).
4. Migration — schedule the cron via pg_net + Vault secret.
5. `.env.example` — add `CRON_SECRET`.
6. `ADR-0015` — Proposed.
7. Verify: `bun test`, `bun run types:check`, `bun run lint:check`.

### Review Workload Forecast

Estimated: ~200 additions + ~10 deletions = ~210 total lines
400-line budget risk: Low
Chain strategy: single-pr
Decision needed before apply: No

### Estimated Effort

2 points (Fibonacci). One route + one pure helper + tests + one migration + one ADR; the `pg*cron`+`pg*net`+Vault pattern is already established (ADR-0011 / weekly-push).

---


_Synced from Jira by sync-jira-issues_
