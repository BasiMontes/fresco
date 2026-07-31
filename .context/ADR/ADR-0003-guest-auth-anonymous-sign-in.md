# ADR-0003 — Guest-mode authentication via Supabase Anonymous Sign-In

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Founder (product + technical decision, drafted by AI workflow for approval)
- **Tags:** authentication, cross-cutting-invariant, guest-mode, master-sprint-2-unblock
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`master-implementation-plan.md` §3 names Master Sprint 2 (EPIC-FRESCO-6 Guest Mode, EPIC-FRESCO-7 Progressive Signup) as blocked on a decision, not on code: "EPIC-6 (guest mode) has no resolved technical path — every documented Edge Function hard-requires a Supabase Auth JWT, and no source document says how a guest without one is meant to call `generate-meal-plan`." `business-api-map.md` §7 restates the same gap as its top-priority item, and `app/onboarding/page.tsx`'s own `handleGenerate()` still carries a TODO acknowledging it hardcodes a `null` access token because "guest-mode auth unresolved."

No source document (PRD, SRS, founder's technical brief) specified a mechanism. Three plausible options existed on paper: an anonymous Supabase session, a client-side-only generation path that bypasses the Edge Function layer entirely, or a custom guest-scoped token.

## Decision

**We will use Supabase's native Anonymous Sign-In (`supabase.auth.signInAnonymously()`) as the guest-authentication mechanism for EPIC-FRESCO-6.**

Verified live against this project's real Supabase instance (2026-07-31), not assumed from docs alone:

1. `external_anonymous_users_enabled` was `false` on this project — enabled via the Management API (`PATCH /v1/projects/{ref}/config/auth`), since no MCP tool exposes this toggle and the dashboard was not the only path available (`SUPABASE_ACCESS_TOKEN` already in `.env` unlocks the same Management API).
2. Confirmed with a real `POST /auth/v1/signup` with an empty body: returns a real user (`is_anonymous: true`) and a real access token — the exact same JWT shape every Edge Function's `requireAuthenticatedUser()` already accepts. **No Edge Function code changes are needed for the auth-acceptance path** — an anonymous session is a fully-formed Supabase Auth session with a real `auth.uid()`, so every RLS policy already written throughout this schema (all scoped to `auth.uid()`, never a role check per `architecture.md` §5) works unmodified for a guest.
3. Upgrade path (Progressive Signup, EPIC-FRESCO-7): `supabase.auth.updateUser({ email, password })` on an anonymous session converts it to a permanent account **while preserving the same `user_id`** (confirmed via Supabase's own docs, `auth-anonymous.mdx`) — meaning a guest's `user_profiles` row and generated `meal_plans` survive the upgrade untouched, no data-reassignment step needed for the common case. The one documented exception: if the email already belongs to an existing different account, `updateUser` errors and the app must fall back to a sign-in + manual `user_id` reassignment flow (Supabase's own documented "Linking Anonymous User to Existing Account" pattern) — FRESCO-7's story must plan for this branch explicitly, not treat the happy path as the only path.

## Consequences

- **Positive:** the single highest-priority Discovery Gap in `business-api-map.md` is resolved without inventing a bespoke mechanism — every Edge Function, every RLS policy, and the entire `meal_plan_recipes`/`shopping_lists` write path already work for a guest as-is, because "authenticated" in this schema has only ever meant "has a Supabase Auth JWT," never "has a password." Master Sprint 2 can now be scoped into stories.
- **Negative / trade-offs:** **a real, previously-undiscovered risk to EPIC-FRESCO-7's happy path** — `updateUser({ email })` requires the new email to be verified (OTP or confirmation link) before a password can be set. This project's Supabase instance has already shown, live, this session: (a) non-standard email domains are rejected outright (`email_address_invalid`), and (b) real-domain confirmation emails hit a low free-tier rate limit almost immediately (`over_email_send_rate_limit`) — the exact friction `.context/qa/regression.feature`'s `@registro` scenario had to route around by mocking the network call instead of hitting the real endpoint. FRESCO-7's Stage 1 plan must treat email deliverability as a named risk (a dedicated SMTP provider, or explicitly accepting OTP/magic-link friction at concierge scale) rather than assume the upgrade "just works" because the API call itself is one line.
- **Neutral / follow-ups:** `rate_limit_anonymous_users` defaults to 30/hour on this project — a reasonable default for concierge-scale testing, worth knowing exists before a public launch cadence is planned. Abandoned anonymous sessions (a guest who never upgrades) accumulate as real, permanent rows in `auth.users` with no automatic cleanup — Supabase provides no built-in garbage collection for stale anonymous users; a future scheduled cleanup (e.g. delete anonymous users older than N days with no linked identity) is a real operational task this ADR surfaces but does not solve.

## Alternatives considered

- **Client-side-only generation path that never calls the Edge Function.** Rejected: would require duplicating `generate-meal-plan`'s entire orchestration (SQL pre-filter, Gemini call, retry/validation, persistence) client-side or inventing a second, unauthenticated backend surface — doubling the food-safety-critical code path (`FR-8.1`) that this project deliberately enforces twice already for a *different*, intentional reason (SQL + prompt layers). A third, guest-only implementation of the same logic is exactly the kind of duplicated-invariant risk ADR-0002 already warns against for a much smaller surface.
- **Custom guest-scoped token (e.g. a signed short-lived JWT issued by a new lightweight endpoint, not backed by a real `auth.users` row).** Rejected: reinvents session management, refresh, and RLS integration that Supabase Auth already solves natively, for no documented advantage — every Edge Function and RLS policy would need to learn a second auth scheme, and the upgrade-to-permanent-account step would need a bespoke migration instead of `updateUser()`'s built-in same-`user_id` preservation.
- **Requiring signup before any menu generation (i.e., not building Guest Mode at all).** Rejected: contradicts `user-journeys.md` Journey 1's explicit framing ("keep what you just saw," not a paywall) and the founder's own stated business value for EPIC-FRESCO-6/7 — the entire point of Progressive Signup is showing value before asking for an account.

## References

- `.context/business/business-api-map.md` §2, §7 item 1 — the Discovery Gap this ADR resolves.
- `.context/master-implementation-plan.md` §3 — Master Sprint 2's gating rationale.
- `app/onboarding/page.tsx` `handleGenerate()` — the existing TODO this decision unblocks.
- `.context/qa/regression.feature` `@registro` scenario + `tests/steps/signup.steps.ts` — the email-deliverability friction already observed live this session, cited above as the real risk to FRESCO-7's upgrade path.
- Supabase docs (Context7, 2026-07-31): `auth-anonymous.mdx` (`signInAnonymously()`, `updateUser()` upgrade + same-`user_id` preservation, the existing-email conflict flow) and GoTrue's `_autodocs/endpoints.md` (`POST /signup` anonymous shape, `PUT /user` conversion).
