# Code Review — FRESCO-228

PR: [#100](https://github.com/BasiMontes/fresco/pull/100) (`feat/FRESCO-228-stripe-checkout-pro` → `staging`)
Reviewer: independent adversarial subagent (fresh context, no implementation stake)

## Findings + adjudication

| Severity | Finding | Verdict | Action |
|---|---|---|---|
| BLOCKER | `profiles_update_own` RLS + table-wide grant let any authenticated user self-write `plan`/`stripe_*` columns directly — contradicts ADR-0007's "webhook is the only writer" invariant | legitimate — verified the migration files myself (`20260725120100`, `20260729120000`), RLS is row-scoped not column-scoped, confirmed | fixed — `20260818190000_protect_subscription_columns_from_client_writes.sql`, `BEFORE UPDATE` trigger rejects non-service-role writes to the 4 subscription columns |
| MAJOR | `.env.example` missing the 3 Stripe vars | legitimate | NOT fixed — blocked by this session's own `.env*` permission deny (confirmed twice). User must add manually; content handed off in chat. |
| MAJOR | Scope requires "Precio mostrado: €4.99/mes"; not shown anywhere | legitimate — grepped, zero matches | fixed — price + trial copy added to the CTA card |
| MAJOR | Webhook grants Pro for any completed subscription checkout, no price/product check | legitimate | fixed — `resolveProUpdateFromSession` now takes `expectedPriceId` and throws on mismatch; new unit test |
| MINOR | `success_url`/`cancel_url` built from `request.nextUrl.origin`, no canonical site-URL env var | legitimate, low impact | deferred — no existing repo convention to reuse; not worth introducing a new env var for this story alone |
| MINOR | `apiVersion` not pinned on the Stripe client | legitimate | fixed — pinned to `2026-07-29.dahlia` (matches installed `stripe@22.5.0`) |
| MINOR | Downstream DB-write failure after signature verification is a log-only dead end | not a defect — deliberate tradeoff, documented in the implementation plan and the route's own doc comment | no change |
| NIT | No test coverage on the Route Handlers themselves (only the pure helper) | not a deviation — matches this repo's existing convention (no other `app/api/**` route has a colocated test either) | no change |
| NIT | No existing Stripe `customer` id reused on re-subscribe (orphans old customer) | out of scope — FRESCO-228 is first-subscribe only; re-subscribe is a 230/231 concern | no change (flagged for later story) |

## Spec Compliance Matrix

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Iniciar checkout desde el perfil | test:`lib/stripe.test.ts` (mapping) + manual | Live-UI pass (Playwright, `LOCAL_USER_EMAIL`, Free plan): clicked CTA on `/profile`, redirected to `checkout.stripe.com/c/pay/cs_test_...`, zero console errors | covered |
| Trial sin tarjeta | manual | Same live-UI pass: Checkout page shows "7 días gratis" badge, only an email field + "Comenzar prueba" button — no card field | covered |
| Pago completado activa Pro | test:`lib/stripe.test.ts` (`resolveProUpdateFromSession`, 6/6) + code review (raw-body signature verification confirmed before any write) | webhook handler, `app/api/stripe/webhook/route.ts` | covered (unit + static) — full webhook-trigger E2E not run; out of this skill's scope (no E2E/integration automation per sprint-development gotcha #10). Manual recipe (`stripe listen` + a real trial signup) handed to the user for a one-time confirmation post-merge. |

## Live-UI pass — resolved

Two rounds of Stripe test-account config drift, both user-owned (not code defects):

1. `STRIPE_PRICE_ID_PRO` first pointed at a pre-existing "Fresco Chef Unlimited" product (3,99 €/mes) instead of Fresco Pro.
2. After the user created clean `FrescoPro-Mensual` (4,99 €/mes) + `FrescoPro-Anual` (44,99 €/mes) products and renamed the env vars to `STRIPE_PRICE_ID_PRO_MONTH`/`_ANUAL` (anual reserved for a future story), the checkout route/webhook still read the old bare `STRIPE_PRICE_ID_PRO` name and picked up the Anual price by accident.

Fixed: `app/api/stripe/checkout/route.ts` and `app/api/stripe/webhook/route.ts` now read `STRIPE_PRICE_ID_PRO_MONTH`. Re-verified live: Checkout shows **"Prueba FrescoPro-Mensual"**, **4,99 €/mes**, **7 días gratis**, email-only (no card field). Matches Scope + AC exactly.
