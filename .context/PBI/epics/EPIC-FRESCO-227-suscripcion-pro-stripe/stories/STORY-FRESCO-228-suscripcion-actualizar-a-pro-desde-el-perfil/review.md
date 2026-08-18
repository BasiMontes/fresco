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
| Iniciar checkout desde el perfil | test:`lib/stripe.test.ts` (mapping) + manual | `UpgradeToProButton` → `POST /api/stripe/checkout` → redirect | manual (pending live-UI pass) |
| Trial sin tarjeta | manual | `trial_period_days: 7` + `payment_method_collection: 'if_required'` in `app/api/stripe/checkout/route.ts` | manual (pending live-UI pass) |
| Pago completado activa Pro | test:`lib/stripe.test.ts` (`resolveProUpdateFromSession`, 6/6) + manual | webhook handler, `app/api/stripe/webhook/route.ts` | manual (pending `stripe listen` trigger test) |

Live-UI + webhook-trigger manual passes not yet run in this review pass — next step before merge.
