# Code Review Record — FRESCO-240 (PostHog product analytics)

Branch: `feat/FRESCO-240-posthog-analytics` (off `dev`). Independent adversarial review run
against the Stage 2 implementation (commits `66eb68c`, `c6ece8b`, `545a3b9`). All findings
below were adjudicated by the orchestrator; 8 of 9 were legitimate and fixed in Stage 3
(commits `5aa1369`..`9574bee`).

## Findings and adjudication

| # | Severity | Finding | Adjudication | Fix commit |
|---|---|---|---|---|
| 1 | BLOCKER | `components/calendar/generate-week-button.tsx` (the button used for every week after onboarding's first — the actual "menús generados semanalmente" the North-star KPI measures) had zero instrumentation | Legitimate — confirmed | `5aa1369` |
| 2 | BLOCKER | `app/signup/page.tsx` (EPIC-FRESCO-7 Progressive Signup, the primary conversion surface) had zero instrumentation | Legitimate — confirmed | `cb25779` |
| 3 | MAJOR | `handleReassign`'s `signInWithPassword()` switches the session to a DIFFERENT, pre-existing account's `auth.uid()`, contradicting the Stage 2 design note that no new `identify()` call was needed on this path | Legitimate — Stage 2 note was correct for the OTP conversion path but wrong for the reassignment path. Fixed with `aliasUser()`/`getDistinctId()` wrappers, distinct id read before `signInWithPassword()` resolves | `cb25779` |
| 4 | MAJOR | `handleCheckoutSessionCompleted` in the Stripe webhook had no processed-event guard, so a Stripe retry of `checkout.session.completed` double-fired `subscription_started` | Legitimate — confirmed | `6ba48de` |
| 5 | MAJOR | `posthog.init()` had no `autocapture: false`, risking DOM-click autocapture scraping allergen/diet-adjacent UI text | Legitimate — confirmed | `25ab76f` |
| 6 | MAJOR | `lib/posthog/server.ts` had zero test coverage | Legitimate — confirmed | `9574bee` |
| 7 | MINOR | `/login`'s `session_started` capture missed returning users with an already-valid persisted session (only fired on explicit credential submission) | Legitimate — confirmed | `25ab76f` |
| 8 | MINOR | No inline documentation that `identifyUser()` and `USER_SIGNED_UP` capture fire independently/async in `identity-step.tsx` | Legitimate — confirmed, low-risk clarity fix | `25ab76f` |
| 9 | NIT | Missing additional event properties beyond what each capture call currently sends | **Dismissed — out of scope.** The Stage 1 plan scoped this ticket to instrumentation existence and identity linkage, not a full event-property schema. No downstream funnel/retention report in ADR-0013's stated goals depends on properties beyond what's already captured (`method` on signup events, none required elsewhere). Revisit only if a specific funnel needs a property this doesn't provide. | — (untouched) |

## Verdict

**APPROVED** after Stage 3 fixes. Verification green throughout: `bun run lint:check`,
`bun run types:check`, `bun run build` (24 routes), `bun test` (228/228 pass, including 7
new tests across `lib/posthog/events.test.ts` and `lib/posthog/server.test.ts`).

See `compliance-matrix.md` in this same folder for the per-scenario KPI/event coverage map.
