# ADR-0044 — Server-side analytics events are sent only with a stored, explicit analytics consent

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Basi Montes
- **Tags:** privacy, gdpr, analytics, posthog, consent, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

ADR-0025 gates the browser SDK on the cookie-banner decision, which lives in a first-party cookie (`fresco_cookie_consent`) only the browser reads. Two places send PostHog events from the server with the user id as `distinct_id` and `$set: { plan }`: the Stripe webhook and `grant-pro` (`trial_*`, `subscription_*`, payment failures, ADR-0013's carve-out) and the weekly push Edge Function (`push_sent`). Neither could know whether the user had rejected analytics. Audit C-15 (FRESCO-919) flagged it.

Two ways out: store the decision where the server can read it and stop sending for anyone who did not accept, or keep sending and document a legal basis (contract or legitimate interest) while trimming the properties. The lawyer's opinion on the legal texts is still pending, so the second option would rest on an interpretation nobody has validated.

## Decision

We will store the decision in **`public.user_profiles.analytics_consent`** (`boolean`, nullable) and send a server-side event **only when it is `true`**.

- `true` = accepted, `false` = rejected, `null` = never synced. `null`, a missing profile row and a failed read all mean **no consent**: opt-in, fail closed.
- The gate lives **inside `captureServerEvent`** (`lib/posthog/server.ts` and `supabase/functions/_shared/posthog.ts`), which now requires a Supabase client. A new call site cannot send without going through it.
- The browser mirrors the banner decision into the column: `AnalyticsConsentSync` for a signed-in user on every load and whenever the decision changes (withdrawal included), and `upsertUserProfile` (client wrapper) carries it when onboarding creates the row.
- The owner writes it under their own RLS. A user who forged `true` would only turn on analytics about themselves (same self-inflicted trade-off as ADR-0040).

## Alternatives considered

- **Keep sending and document a legal basis, trimming properties.** Rejected for now: cheaper, and it keeps the payment funnel for everyone, but it relies on a legal reading that is not validated, and the lawyer's opinion is pending. It can be revisited with that opinion.
- **A separate consent table (append-only like `user_consents`).** Rejected: the decision is a toggle the user changes both ways, and `user_consents` is append-only with no withdrawal (ADR-0040). One column holds the latest value.
- **Read the cookie on the server.** Rejected: the webhook and the Edge Function have no browser request.

## Consequences

- **Positive:** a user who rejected analytics generates no server-side event; the check is testable in one place and cannot be skipped by a new caller; no new table.
- **Negative / trade-offs:** the Stripe funnel (`trial_started`, `subscription_*`) loses everyone who rejected or whose decision never synced, so conversion numbers undercount. A user who completes checkout before the first sync (a full page load after onboarding) can lose their first event.
- **Neutral / follow-ups:**
  - The privacy and cookie texts should say server events follow the banner choice; the texts are provisional and with the lawyer.
  - If a payment-lifecycle event must be counted regardless, that is a separate decision with a documented legal basis, not an exception here.

## References

- `supabase/migrations/20261014120000_user_profiles_analytics_consent.sql`, `lib/posthog/server.ts`, `supabase/functions/_shared/posthog.ts`, `components/auth/analytics-consent-sync.tsx`, `lib/client-api/identity.ts`, `lib/client-api/user-profile.ts`, `tests/db/analytics-consent.test.ts`
- FRESCO-919; ADR-0013, ADR-0025, ADR-0040
- `.context/audits/2026-10-12-definitive/04-critical-audit.md` (C-15)
