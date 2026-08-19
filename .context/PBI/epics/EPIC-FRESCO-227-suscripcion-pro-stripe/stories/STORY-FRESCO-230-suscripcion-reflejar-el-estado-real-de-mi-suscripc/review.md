# Code Review — FRESCO-230

PR: [#101](https://github.com/BasiMontes/fresco/pull/101) (`feat/FRESCO-230-reflejar-estado-real-suscripcion` → `staging`)
Reviewer: independent adversarial subagent (fresh context, no implementation stake)

## Findings + adjudication

| Severity | Finding | Verdict | Action |
|---|---|---|---|
| BLOCKER | Both new handlers matched a `user_profiles` row by `stripe_customer_id` alone, never cross-checking `stripe_subscription_id` — a stale/out-of-order `deleted`/`updated` event for a superseded subscription (cancel, then resubscribe before the old one's deferred event arrives) could clobber a now-legitimately-active Pro customer | legitimate — real ordering bug, Stripe doesn't guarantee webhook delivery order | fixed — both handlers now select `stripe_subscription_id` and no-op unless it matches the event's `subscription.id` |
| MAJOR | `resolveRenewalUpdate` had no price check (unlike `resolveProUpdateFromSession`, PR #100) — any active subscription for a known customer would renew Pro regardless of price | legitimate — not exploitable via this app's own checkout today, but reintroduces a gap already closed once | fixed — `resolveRenewalUpdate` now takes `expectedPriceId` and throws on mismatch, same pattern as the checkout path; new unit test |
| MINOR | No-op-on-missing-profile comment undersold the likely real cause (delivery-order race vs. "customer created outside this app") | legitimate, cosmetic | fixed — comment + error message now name the race explicitly |
| MINOR | `resolveRenewalUpdate`'s `status !== 'active'` check duplicates the caller's own guard, currently unreachable from the real call path | legitimate observation, not a defect | no change — kept as defense-in-depth for any future direct caller |
| NIT | No test coverage on the route handlers themselves (only the pure helpers) | not a deviation — matches FRESCO-228's existing convention (no `app/api/**` route has a colocated test) | no change |

## Spec Compliance Matrix

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Pago exitoso activa Pro automáticamente | test:`lib/stripe.test.ts` (FRESCO-228, pre-existing) | `handleCheckoutSessionCompleted` — unchanged by this story | covered (shipped in FRESCO-228) |
| Renovación mensual mantiene Pro | test:`lib/stripe.test.ts` (`resolveRenewalUpdate`, 6 cases incl. price-mismatch) + code review (subscription-id cross-check) | `handleSubscriptionUpdated` | covered (unit + static) — no live webhook-trigger E2E: no Stripe webhook endpoint registered in any environment yet (standing gap from FRESCO-228, `STRIPE_WEBHOOK_SECRET` still a placeholder) |
| Cancelación revierte a Free al fin del periodo pagado | test:`lib/stripe.test.ts` (`resolveCancellationCustomerId`, 3 cases) + code review | `handleSubscriptionDeleted` | covered (unit + static) — same live-E2E gap as above |

No UI surface in this story — live-UI validation (per `sprint-development` doctrine) does not apply.
