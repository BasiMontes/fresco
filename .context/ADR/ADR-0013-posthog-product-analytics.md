# ADR-0013 — PostHog as the product-analytics vendor (EU region, client + server capture)

- **Status:** Accepted
- **Date:** 2026-08-24
- **Deciders:** Basi Montes
- **Tags:** observability, product-analytics, cross-cutting-invariant, third-party-vendor
- **Supersedes:** —
- **Superseded by:** —

---

## Context

FRESCO-240 (tech-debt): no product-analytics tool exists in the repo (verified by code search: no PostHog, Mixpanel, GA, Segment, or Plausible). `business-model.md`'s North-star KPI — "weekly menus generated **and used**" — and its third MVP hypothesis — at least 3 of 10 concierge-cohort users pay and keep using the product for 3+ consecutive weeks — are both unmeasurable today. There is no event stream, no user-timeline, and no retention/funnel reporting anywhere in the stack. The founder's entire validation plan (`business-model.md` §Validation Plan Summary) is gated on observing real repeat usage; without instrumentation that observation cannot happen.

This choice touches every runtime the app executes in (client components, Next.js API routes, and potentially Supabase Edge Functions for the food-safety-critical write paths) and, once shipped, produces a historical event stream that is expensive to migrate later — switching vendors after real usage data has accumulated means either losing that history or running a lossy export/re-import. It passes the ADR two-gate test (architectural: a new cross-cutting SDK wired through the App Router provider tree and multiple server entry points; hard to reverse: historical events and any dashboards/funnels built on them do not travel cleanly to a different vendor).

Three realistic vendor options existed: PostHog, Vercel Analytics (already bundled with the current Vercel plan), and Plausible (privacy-first, page-view-centric). The user was asked and explicitly chose **PostHog**, specifically because native custom events + funnels + retention cohorts are required to measure "3+ week repeat usage" — a metric neither Vercel Analytics (page-view/web-vitals only, no custom event funnels) nor Plausible (deliberately excludes user-level tracking, incompatible with per-household retention cohorts) can produce without a second tool bolted on.

**Flagged assumption, not yet confirmed by the user**: this ADR defaults to **PostHog Cloud, EU region** (`https://eu.posthog.com` / `eu.i.posthog.com`) on the reasoning that the founder and the primary user segment (`business-model.md` — "Laura," household planner, no explicit geography stated but the app's copy, `lang="es"`, and prior Jira-content Spanish-only override all point at a Spain-based user base) sit under GDPR, and EU-region hosting keeps personal event data (email, household composition signals) in-region without a separate SCC/DPA review. **This is a default the user can override before Stage 2 starts** — it is not baked in as unquestionable; if the user has an existing US-region PostHog project or a different compliance posture, this ADR must be revised before implementation.

## Decision

We will use **PostHog Cloud (EU region)** as the product-analytics vendor, instrumented via `posthog-js` (client) and `posthog-node` (server), wired as follows:

- **Client**: a single `'use client'` provider component (e.g. `app/providers/posthog-provider.tsx`) wraps `{children}` inside `app/layout.tsx`'s `<body>`, initializing `posthog-js` once with `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`. This is the first client provider in the app — `app/layout.tsx` currently has none.
- **Server**: a small `lib/posthog/server.ts` singleton wraps `posthog-node` for events fired from Next.js API routes (`app/api/**/route.ts`) and, where reliability against ad-blockers matters most (payment/subscription events), from the Stripe webhook handler — the one place a client-side `capture()` call structurally cannot fire, since the webhook has no browser.
- **Identity linkage**: every PostHog `identify()` call uses the Supabase `auth.uid()` as the PostHog `distinct_id` — including guest/anonymous users (ADR-0003, `signInAnonymously()`), so a guest's pre-signup event stream (menu generated as a guest) merges losslessly into their post-upgrade stream via PostHog's `alias()`/`identify()` merge semantics when `reassignGuestData` / `updateUser` converts the anonymous session (ADR-0004). No parallel identity scheme is introduced — the existing Supabase `user_id` (already the sole identity primitive in every RLS policy per `architecture.md` §5) is the only identity PostHog needs to learn.
- **Region**: EU Cloud (see flagged assumption above — override before Stage 2 if the user disagrees).
- **Reverse proxy** (optional, stretch, not blocking Stage 2): a Next.js rewrite (`/ingest/*` → PostHog's EU ingestion endpoint) to reduce ad-blocker loss on client-captured events, per PostHog's own recommendation. Deferred to a follow-up story if Stage 2 runs out of scope budget.

This is the invariant future work must uphold: **PostHog is the single product-analytics sink for this app.** Any new user-facing flow that should count toward the North-star KPI or a funnel/retention report must emit through the existing `lib/posthog/*` wiring (client provider or server singleton) rather than a second, ad-hoc tracking call.

## Consequences

- **Positive:** the North-star KPI ("menús generados Y usados") and the repeat-usage MVP hypothesis both become measurable for the first time, using PostHog's native retention report (no custom cohort SQL required — a genuine reason this vendor was chosen over the alternatives). Funnels (onboarding → first menu → first "cocinada" mark) are buildable in PostHog's UI with zero additional code once events land. Identity linkage to `auth.uid()` means every event, including guest-mode events, is attributable to a real household from day one.
- **Negative / trade-offs:** new third-party vendor — new account, new API key to manage in `.env` / Vercel env vars, two new dependencies (`posthog-js`, `posthog-node`) in the bundle. Client-captured events are subject to ad-blocker loss unless the optional reverse-proxy is implemented (deferred). Splitting capture between client and server per event (see Technical Decisions in the Stage 1 implementation plan) adds a small amount of "which side fires this" judgment that a single-SDK approach wouldn't need — mitigated by documenting the split explicitly per event rather than leaving it ambiguous.
- **Neutral / follow-ups:** `.env.example` gains `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`. Vercel Preview/Production env vars need the same sync (`/vercel-cli`) once the user creates the PostHog project and has real values. If the EU-region assumption is wrong, switching region before any real data is captured is free (delete-and-recreate the project); switching region *after* Stage 2 ships is the same lossy-migration problem this ADR exists to avoid, so the override window is now, not later.

## Alternatives considered

- **Vercel Analytics (native, already on the current plan).** Rejected: page-view + Web Vitals only — no custom event API, no funnels, no retention cohorts. Cannot express "menu generated" vs. "menu used" as distinct, attributable events, let alone a 3-week retention cohort. Would require bolting on a second tool anyway, defeating the point of using the bundled option.
- **Plausible.** Rejected: deliberately privacy-first and aggregate-only by design — no persistent per-user identity, which is a feature for its intended use case (marketing site analytics) but incompatible with per-household retention cohorts, the exact capability this ticket exists to unlock.
- **Vercel-region / US-region PostHog Cloud instead of EU.** Not rejected outright — flagged as the assumption to override, not a settled alternative. Documented as a decision point in `## Decision` above rather than silently defaulted.

## References

- `.context/PBI/tech-debts/TECHDEBT-FRESCO-240-instrumentacion-de-producto-analytics-para-medir-e/tech-debt.md`
- `.context/business/business-model.md` — North-star KPI (Value Propositions §), MVP Hypothesis 3 (Repeat-usage hypothesis)
- `.context/ADR/ADR-0003-guest-auth-anonymous-sign-in.md` — the `auth.uid()` identity primitive this ADR reuses for PostHog `identify()`
- `.context/ADR/ADR-0004-guest-data-reassignment-on-email-conflict.md` — the guest→registered upgrade path PostHog identity merge must survive
- `.context/ADR/ADR-0009-sentry-error-tracking.md` — sibling third-party-vendor ADR (same client/server/edge wiring shape, same `.env.example` convention)
- `.context/ADR/ADR-0007-stripe-checkout-hosted-webhook-driven-subscription.md` — the webhook handler this ADR's server-side payment-event capture attaches to
- Implementation plan: FRESCO-240 Jira comment (`Spec Implementation Plan (Dev)`), synced to `.context/PBI/tech-debts/TECHDEBT-FRESCO-240-instrumentacion-de-producto-analytics-para-medir-e/comments.md`
