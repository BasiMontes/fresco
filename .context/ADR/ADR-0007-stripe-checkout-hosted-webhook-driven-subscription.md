# ADR-0007 — Stripe Checkout (hosted) + webhook-driven subscription state

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Basi Montes
- **Tags:** payments, stripe, subscription, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

EPIC-FRESCO-227 (Suscripción Pro (Stripe)) reverses the deliberate MVP-scope deferral of self-serve payment (`.context/PRD/mvp-scope.md`) — the founder previously collected payment manually via "concierge validation". FRESCO-228 is the epic's own prerequisite story: it must produce the checkout flow that FRESCO-230 (reflect real subscription state), FRESCO-231 (manage/cancel), and FRESCO-232 (failed payment) all build on.

Pricing is fixed (`.context/business/business-model.md`): Free €0 vs Pro €4.99/mes, 7-day trial with no card required at signup, price never drops below €4.99/mes. `user_profiles` already has `plan` (enum `free`/`pro`/`family`) and `plan_expires_at` (nullable timestamptz) — added ahead of this epic, unused until now. No `stripe_customer_id` / `stripe_subscription_id` columns exist yet.

Stripe offers three integration shapes for taking a subscription payment: **Checkout** (Stripe-hosted page, redirect-based), **Payment Links** (Stripe-hosted, no server-side session creation needed), and **Elements** (custom-built form embedded in-app, PCI scope stays partially on us). The epic note explicitly flags this choice as ADR-worthy — architectural, and hard to reverse once client code and DB shape commit to one model.

## Decision

We will use **Stripe Checkout in `subscription` mode**, session created server-side (`POST /api/stripe/checkout`) and the client redirected to the returned `session.url` — never Stripe Elements, never bare Payment Links.

- `trial_period_days: 7`, `payment_method_collection: 'if_required'` so no card is requested until the trial converts — matches the AC directly with zero custom trial-state code.
- `client_reference_id` = the authenticated Supabase user id, so the webhook can map a Stripe event back to a `user_profiles` row without an extra lookup table.
- Subscription state is **never written from the client or from the checkout-return page** — the return page only re-reads `user_profiles.plan` server-side. The only writer of `plan` / `stripe_customer_id` / `stripe_subscription_id` / `plan_expires_at` is the webhook handler (`POST /api/stripe/webhook`), verified against `STRIPE_WEBHOOK_SECRET`. This is the invariant every later story (230/231/232) must uphold: Stripe is the source of truth for subscription state, the webhook is the only write path into `user_profiles` for it.

## Consequences

- **Positive:** No PCI SAQ-A-EP scope — Stripe hosts the card form entirely. Trial-without-card is a config flag, not custom logic. One webhook handler is reused by 230 (status changes)/231 (cancel confirmation)/232 (payment failure) — same event stream, different event types.
- **Negative / trade-offs:** Redirect-based flow means a full page navigation away from `/profile` (less "in-app" feel than Elements). Webhook-driven state means the return page cannot show "Pro" with certainty at the exact instant of redirect if Stripe's webhook lags — profile page falls back to whatever `plan` currently reads, and a brief "still processing" state is possible on a slow webhook delivery. Testing requires the Stripe CLI (`stripe listen`) for local webhook delivery.
- **Neutral / follow-ups:** New columns on `user_profiles`: `stripe_customer_id text unique null`, `stripe_subscription_id text unique null` (this story's migration). `plan_expires_at` (pre-existing, unused) becomes the trial/period end date, set by the webhook. FRESCO-230/231/232 read/write against this same shape — do not introduce a parallel `subscriptions` table without superseding this ADR.

## Alternatives considered

- **Stripe Elements (embedded custom form)** — rejected: full PCI SAQ-A-EP scope, custom trial-without-card UI logic we'd have to build by hand, no meaningful UX win for a single-plan MVP upgrade flow.
- **Payment Links (no server-side session)** — rejected: cannot set a dynamic `client_reference_id` per authenticated user at link-creation time the way a fresh Checkout Session can, and cannot easily vary `trial_period_days` per campaign later without creating N static links. Checkout Session gives the same hosted-page UX with per-request control.
- **Client-side plan update on checkout return (optimistic write)** — rejected: would create two writers of `user_profiles.plan` (client + webhook), risking a race where a failed/reversed payment leaves the profile stuck on `pro`. Single-writer-via-webhook avoids this class of bug entirely.

## References

- `.context/PRD/mvp-scope.md` — original self-serve-payment deferral being reversed.
- `.context/business/business-model.md` — Revenue Streams, pricing figures.
- `.context/PBI/epics/EPIC-FRESCO-227-suscripcion-pro-stripe/epic.md` — epic note flagging this as ADR-worthy.
- `.context/PBI/epics/EPIC-FRESCO-227-suscripcion-pro-stripe/stories/STORY-FRESCO-228-suscripcion-actualizar-a-pro-desde-el-perfil/comments.md` — AC/Scope/OOS for this story.
- `app/(app)/profile/page.tsx:22-32` — existing doc comment naming this story as the CTA's real wiring point.
