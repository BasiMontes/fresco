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

## Live-UI pass — BLOCKING finding

The Checkout page rendered by the current `STRIPE_PRICE_ID_PRO` shows product **"Prueba Fresco Chef Unlimited - Mensual"** at **3,99 €/mes**, not "Fresco Pro" at **€4.99/mes** (`.context/business/business-model.md`, this story's Scope). This is not a code defect — checkout creation and the webhook both correctly use whatever price the env var points to — it's a Stripe test-account configuration mismatch: `STRIPE_PRICE_ID_PRO` in `.env` currently points at a pre-existing, differently-named/priced product in the user's Stripe test account instead of a real "Fresco Pro €4.99/mes" price.

**Blocks merge** until resolved: either re-point `STRIPE_PRICE_ID_PRO` at the correct price, or rename/reprice the existing product to match the business model. User-owned action (Stripe Dashboard), not something to fix in code.
