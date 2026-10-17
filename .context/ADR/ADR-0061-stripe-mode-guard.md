# ADR-0061 — Stripe mode guard: the Stripe mode is a fact of the shared database, not of the deploy that receives the event

- **Status:** Proposed <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-17
- **Deciders:** Basi Montes (design approved in conversation on 2026-10-17; acceptance of this record pending)
- **Tags:** payments, stripe, security, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Audit 7b (A7-PAY-01, A7-PAY-03, and the `livemode` part of A7-TEST-03) found that no code reads `livemode`, and that every environment shares one Supabase project (`environments.*.db_project_ref` in `.agents/project.yaml`) and one Stripe account.

- `fresco-pre` is public and runs test keys. It verifies its own webhook secret and writes the shared `user_profiles` row. Once production uses live keys, anyone with a production account can open `fresco-pre`, pay with the test card `4242` and be Pro in production until the daily reconcile cron downgrades them, repeatably.
- The frozen `fresco-dev` deploy (`vercel.json` disables its deployments) still has an enabled endpoint, so it receives every event and writes with a handler older than the FRESCO-816 and FRESCO-909 guards.
- The structural fix, one Supabase project per environment, needs Supabase Pro (ADR-0020, FRESCO-911): spend the founder has ruled out for now.

A check that compares the event's mode with the mode of THIS deploy's `STRIPE_SECRET_KEY` is not enough: `fresco-pre` is a test deploy receiving a test event, so it passes.

## Decision

We will treat the Stripe mode as a fact of the database, and enforce it in three layers (`lib/billing/stripe-mode.ts`):

1. **The deploy.** An event's `livemode` must equal the mode of the deploy's `STRIPE_SECRET_KEY`, read from its prefix (`sk_`/`rk_` + `live`/`test`). Anything else, or a missing key, is an unknown mode.
2. **The database.** `public.billing_mode` is a one-row table holding the mode the database serves (test until go-live). An event's `livemode` must equal it. The owner flips it once at go-live with `supabase db query --linked`; no client role and not even the service role can write it.
3. **The profile.** `user_profiles.stripe_livemode` is stored next to `stripe_customer_id` and `stripe_subscription_id` and written by the webhook only (ADR-0007). A subscription, cancellation or refund event must match the mode stored on the profile it resolves to.

Behaviour:

- The webhook checks every handled event type after the signature and **before the event claim**, so a refusal leaves no row in `stripe_webhook_events`. A mismatch answers **400**, reports to Sentry at error level with the layer, and writes nothing. It is 400 and not 200 so that a production deploy configured with the wrong key is retried by Stripe and no real payment is lost once the key is fixed.
- A deploy or a database of unknown mode answers **500**: the guard fails closed, never to a default.
- `grantProFromCheckoutSession` runs the same check first, so the checkout sweep, which does not go through the webhook, cannot bypass it, and stores the mode with the ids.
- The checkout answers **503** when the deploy and the database serve different modes, and does not reuse a stored Stripe customer of the other mode.
- `bun run scripts/check-stripe-endpoints.ts` (read-only) lists the account's webhook endpoints and fails on an enabled one that points at a frozen or unknown deploy; `docs/workflows/stripe-go-live.md` carries the go-live order and the line "every Stripe endpoint points at a deploy of the current SHA".

The invariant: **no Stripe object of a mode the database does not serve is ever written to, or acted on through, a profile.**

## Consequences

- **Positive:** a test card on `fresco-pre` can no longer make a production account Pro, with no Supabase Pro cost; a stale `fresco-dev` deploy is detected by a script instead of by an audit; a profile records which mode its Stripe ids belong to.
- **Negative / trade-offs:**
  - There is a manual step at go-live: the owner flips `billing_mode`. Forgetting it, or flipping it without the live keys (or the reverse), makes production answer 503 on checkout and 400 on every event until both agree. This is recoverable and safe, but it is a launch-day dependency, listed in `docs/workflows/stripe-go-live.md`.
  - After go-live the `@requiere-stripe-real` e2e on `fresco-pre` cannot grant Pro on a live database. To run them the database must be set back to test mode for the window, or they need their own database.
  - The guard reads `billing_mode` on every handled event and every checkout: one extra single-row query through the service role.
  - It protects against a Stripe event of the wrong mode. It does not make the shared database safe in general (a bug in a test deploy can still write other tables); only a separate project does that.
- **Neutral / follow-ups:**
  - Allowing test events for test accounts only (for example the ids in `rate_limit_exempt_users`) would keep the Stripe e2e alive on a live database; not done, no demand yet.
  - `lib/supabase/types.ts` was edited by hand for `billing_mode` and `stripe_livemode` because `bun run db:types` reads the hosted project; regenerate it once the migration is promoted.
  - Reopening ADR-0020 (one Supabase project per environment, once Pro is paid for) would make layers 2 and 3 redundant; layer 1 stays useful.

## Alternatives considered

- **Compare the event only with the deploy's key (the audit's first suggestion).** Rejected: it passes on `fresco-pre`, the case it exists for.
- **An environment variable on each non-production deploy that switches writes off.** Rejected: it depends on someone setting it on every Preview scope at go-live, and a missing value fails open. The database is the one place every deploy already agrees on.
- **Refuse checkout on non-production deploys except for test identities.** Rejected for now: it needs a trustworthy notion of "test identity" and still leaves the webhook open to events created elsewhere.
- **Derive the database mode from the data ("any profile has live ids").** Rejected: there is a window between go-live and the first live customer in which a test grant is accepted, which is exactly the launch day.
- **Split the Supabase project per environment (reopening ADR-0020).** The right structural fix; rejected for now because it needs Supabase Pro.

## References

- `.context/audits/2026-10-16-audit-7/w1-02-payments.md` (A7-PAY-01, A7-PAY-03); `w3-03-test-quality.md` (A7-TEST-03)
- `supabase/migrations/20261017161451_stripe_livemode_guard_schema.sql`, `lib/billing/stripe-mode.ts`, `app/api/stripe/webhook/route.ts`, `app/api/stripe/checkout/route.ts`, `lib/billing/grant-pro.ts`
- `tests/db/stripe-livemode-guard-schema.test.ts`, `lib/billing/stripe-mode.test.ts`, `app/api/stripe/webhook/route.test.ts`
- `scripts/check-stripe-endpoints.ts`, `docs/workflows/stripe-go-live.md`
- ADR-0007 (the webhook is the only writer of subscription state), ADR-0020 (one Supabase project until Pro), FRESCO-816, FRESCO-909, FRESCO-911, FRESCO-1004
