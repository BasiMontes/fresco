# Code Review — FRESCO-231

PR: [#102](https://github.com/BasiMontes/fresco/pull/102) (`feat/FRESCO-231-portal-suscripcion` → `staging`)
Reviewer: independent adversarial subagent (fresh context, no implementation stake)

## Findings + adjudication

| Severity | Finding | Verdict | Action |
|---|---|---|---|
| MAJOR | Portal route had no server-side `plan === 'pro'` gate — only checked for a `stripe_customer_id`. Since the cancellation webhook (FRESCO-230) clears `plan` but not `stripe_customer_id`/`stripe_subscription_id`, a downgraded user retains a stale customer id and could POST here directly to open a live portal session for her own now-defunct Stripe customer | legitimate — real gap between documented Scope ("portal access only for plan === 'pro' users") and shipped enforcement | fixed — route now selects `plan` too and 404s unless `plan === 'pro'`, before creating the session |
| MINOR | `plan === 'family'` gets neither the upsell nor the management card on `/profile` | legitimate observation, pre-existing (the free-card gap predates this PR) | no change — no family-tier checkout flow exists yet, explicitly out of scope for this epic; noted here as a deliberate exclusion rather than a silent gap for whichever future story adds family billing |
| MINOR | DB-read failure (500) and "no subscription on file" (404) returned the identical error message | legitimate, cheap fix | fixed — distinct messages per status code |

## Live-UI pass

Playwright, `PRO_TEST_USER_EMAIL` (a seed account with `plan: 'pro'` set directly in DB, never through real Stripe checkout — no `stripe_customer_id`). Result: "Tu suscripción" card renders correctly for a Pro account; clicking "Gestionar mi suscripción" returns 404 "No se encontró tu suscripción.", surfaced as an inline error with no crash — the exact negative path this account is expected to hit, confirming the error UX works end-to-end. The happy-path redirect (fetch → `window.location.href = url`) reuses the exact mechanism already proven live in FRESCO-228's Checkout flow — not re-verified separately here since no test account with a real `stripe_customer_id` exists today (would require completing a real Stripe test checkout first, which itself needs a registered webhook to write `plan`/`stripe_customer_id` — the same standing `STRIPE_WEBHOOK_SECRET`-placeholder gap noted since FRESCO-228/230).

## Spec Compliance Matrix

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Acceder a gestión de suscripción | manual (live-UI) + code review | Card renders for Pro accounts; route reachable | covered (button + redirect mechanism); full happy-path redirect not exercised live (no test account with a real Stripe customer id today) |
| Cancelar la suscripción (retiene Pro hasta fin de periodo) | code review | Native Stripe Portal config (`bpc_1U65aCGyXX8lW4CXCuJ71BCn`, `subscription_cancel.mode: at_period_end`) + FRESCO-230's existing webhook handlers | covered (config + downstream handling both verified in code) |
| Ver mi próximo cobro | code review | Native Stripe Portal UI (`invoice_history` enabled) | covered by Stripe's own hosted surface — no app code to verify |

No new unit tests, per this story's plan (no branching business logic to extract) — consistent with the sibling `checkout/route.ts`, which also has no colocated test.
