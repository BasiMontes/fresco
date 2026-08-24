# Spec Compliance Matrix — FRESCO-240 (PostHog product analytics)

Scope: verifies every KPI/event scenario named in the Stage 1 implementation plan
(`comments.md`, "Spec Implementation Plan (Dev)") and ADR-0013 against what actually
landed on `feat/FRESCO-240-posthog-analytics` after Stage 3 review fixes
(commits `66eb68c`..`9574bee`).

No automated E2E coverage exists for these flows (out of scope per this ticket's plan —
instrumentation is unit-tested at the `lib/posthog/*` fail-soft-guard level, not
E2E-tested end to end). `covered_by` uses `manual:<file:line>` for capture call sites and
`test:<file>` for the two new unit-test files that cover the underlying utilities.

| Scenario | covered_by | evidence | status |
|---|---|---|---|
| `menu_generation_started` / `menu_generation_completed` — onboarding first-time path | manual:`app/onboarding/page.tsx:233,279` | `captureEvent(POSTHOG_EVENTS.MENU_GENERATION_STARTED)` before the generation call, `MENU_GENERATION_COMPLETED` after it resolves | covered |
| `menu_generation_started` / `menu_generation_completed` — calendar repeat-week path | manual:`components/calendar/generate-week-button.tsx:55,64` | Added in Stage 3 BLOCKER #1 fix (`5aa1369`) — this button, not onboarding, is what the North-star KPI actually measures for weeks 2+ | covered |
| `recipe_marked_cooked` | manual:`components/calendar/calendar-grid.tsx:292` | Fired only on the `'cocinada'` status-change branch, not on every status transition | covered |
| `user_signed_up` — guest path (identity-step, no account) | manual:`components/onboarding/identity-step.tsx:54` | `{ method: 'guest' }` property | covered |
| `user_signed_up` — account path (identity-step, direct signup) | manual:`components/onboarding/identity-step.tsx:99` | `{ method: 'account' }` property | covered |
| `user_signed_up` — progressive signup, OTP conversion (`/signup`) | manual:`app/signup/page.tsx:175` | Added in Stage 3 BLOCKER #2 fix (`cb25779`) — `{ method: 'progressive_signup_otp' }`, mutually exclusive with identity-step's own capture | covered |
| `user_signed_up` — progressive signup, ADR-0004 email-conflict reassignment (`/signup` `handleReassign`) | manual:`app/signup/page.tsx:106` | `{ method: 'progressive_signup_reassign' }`; paired with `aliasUser()`/`getDistinctId()` (Stage 3 MAJOR #3 fix, same commit) so the guest's pre-reassignment event stream merges into the new `auth.uid()` instead of being orphaned | covered |
| `session_started` — explicit login submission | manual:`app/login/page.tsx:102` | Fires on successful credential submission | covered |
| `session_started` — returning user, already-valid persisted session | manual:`app/providers/posthog-provider.tsx:63` | Added in Stage 3 MINOR #7 fix (`25ab76f`) — fires on `onAuthStateChange`'s `INITIAL_SESSION` event only when a session is already present; verified against `@supabase/auth-js` types that `INITIAL_SESSION` and `SIGNED_IN` are distinct events, so this cannot double-count against `/login`'s own capture | covered |
| `subscription_started` — Stripe webhook, deduplicated against retries | manual:`app/api/stripe/webhook/route.ts:146` | Added Stage 2 (`545a3b9`), deduplication guard added Stage 3 MAJOR #4 fix (`6ba48de`) — captures only when the user's `stripe_subscription_id` actually changes, so a Stripe retry of `checkout.session.completed` does not double-fire the event | covered |
| `identify()` linkage (guest + login + signup) to `auth.uid()` | manual:`app/providers/posthog-provider.tsx` (centralized `onAuthStateChange` listener) | Single listener covers guest (`signInAnonymously`), login, and signup identity linkage without per-call-site duplication (Stage 2 design decision) | covered |
| `aliasUser()` merge on cross-account reassignment | manual:`lib/posthog/events.ts:68-78`, called from `app/signup/page.tsx:~100` (before `signInWithPassword()` resolves) | Verified against `posthog-js`'s installed type defs (`node_modules/posthog-js/dist/module.d.ts:4278`) — new id first, prior id second | covered |
| Autocapture disabled (allergen/diet UI text scrape risk) | manual:`app/providers/posthog-provider.tsx` `posthog.init()` `autocapture: false` | Stage 3 MAJOR #5 fix (`25ab76f`) | covered |
| `lib/posthog/events.ts` fail-soft guard (client) | test:`lib/posthog/events.test.ts` | 4 tests — no-op when `NEXT_PUBLIC_POSTHOG_KEY` unset, swallowed exceptions on all four exported functions | covered |
| `lib/posthog/server.ts` fail-soft guard (server) | test:`lib/posthog/server.test.ts` | Added Stage 3 MAJOR #6 fix (`9574bee`) — previously zero coverage; mirrors `events.test.ts`'s style (no-op when unset, swallowed `client.capture()` throw) | covered |

## Summary

- 15/15 scenarios covered (manual capture-site evidence or unit test), 0 uncovered.
- No scenario required a `test:` E2E id — automated E2E is explicitly out of scope for this
  ticket per the Stage 1 plan; unit coverage exists only for the two shared utility modules
  (`lib/posthog/events.ts`, `lib/posthog/server.ts`), not for each call site individually.
- Dismissed as out of scope, not tracked as a gap: NIT #9 from the Stage 3 adversarial
  review (missing extra event properties beyond what's listed above) — see `review.md`.
