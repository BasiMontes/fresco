---
topic_key: pbi/FRESCO-5/review
---

# Code Review — FRESCO-5 (Onboarding)

Stage 3 review run retroactively (solo-main strategy — commits `b2d20e4`, `528df48`, `dfaa132` were already committed and pushed to `main` before this review). Native `gentle-ai` bounded review lifecycle: `lineage=review-9f0d32b46f3e1f27`, `risk_level=high` (1542 changed lines across FRESCO-5+9 combined diff, base `87bf9cb`), full 4R lens sweep (review-risk, review-resilience, review-readability, review-reliability). Findings below are the FRESCO-5-relevant subset, adjudicated.

## Adjudicated findings

| # | Severity | File:line | Finding | Verdict | Action |
|---|---|---|---|---|---|
| 1 | CRITICAL | `app/onboarding/page.tsx` `handleGenerate` | `try {} finally {}` with no `catch` around `upsertUserProfile`/`generateMealPlan` — any backend failure (timeout, RLS denial) is an unhandled rejection; button silently reverts with zero error text, no retry. Fire-and-forget `onClick`, no error boundary in repo. | legitimate | **fix now** |
| 2 | MAJOR | `lib/api/user-profile.ts`, `supabase/migrations/...create_fresco_core_tables.sql:77-78` | `alergenos`/`ingredientes_odiados` are unconstrained `text[]` columns; `upsertUserProfile` does no server-side allow-list validation against the curated option lists the UI restricts to. A non-UI caller (bug or otherwise) can persist arbitrary strings, which then land verbatim in every future LLM prompt (Layer 2 guardrail) — defeats the exact rationale Decision 1 in the implementation plan gave for choosing curated tags over free text ("free text that doesn't match the catalog's vocabulary would silently fail to filter... without the user ever knowing"). | legitimate | **fix now** |
| 3 | MINOR | `lib/validation/onboarding.ts:24-30` | `Number(e.target.value)` on a cleared/invalid input can produce `NaN`; both guards (`adultos<=0`, `ninos<0`) evaluate `false` for `NaN`, so `validateHousehold` silently returns `valid: true`. Untested. | legitimate | **fix now** (cheap) |
| 4 | MINOR | `lib/validation/onboarding.ts:34-38` | `adultos > numPersonas` branch is algebraically unreachable given the two guards above it (self-admitted in its own comment). | legitimate, but already deliberately reasoned in the plan's Technical Decision 2 (derived `num_personas` "satisfies AC-3's intent by construction") | **no fix** — dead-but-documented defensive code, not confusing enough to warrant touching working code (surgical-changes doctrine) |
| 5 | MINOR | `app/onboarding/page.tsx:128` vs `lib/validation/onboarding.ts:32` | `adultos + ninos` formula duplicated in two places instead of one shared source. | legitimate but premature abstraction for a 2-site, 1-line formula | **no fix** — declined, not worth a shared helper for this scope |
| 6 | SUGGESTION | `lib/store/onboarding-store.ts:73-107` | `toggleDieta` mixes early-return guards + switch for what's otherwise a uniform toggle reducer. | legitimate style nit | **no fix** — working code, no defect, out of surgical-change scope |
| 7 | WARNING | `app/onboarding/page.tsx` (whole file) | No component-level test for the page (button gating, call ordering, "no 4th step"). | legitimate but out of scope — E2E/integration tests are explicitly out of scope for this skill; Stage 2's Playwright live-UI walk already verified AC-1/AC-2/AC-3 against the running app. | **no fix** — already covered by live-UI evidence, not by an automated integration test |

## Spec Compliance Matrix

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Onboarding completes in exactly 3 steps, no 4th step | manual + test | Playwright live-UI walk (Stage 2, `bun run dev`, localhost:3000/onboarding) confirmed structurally cannot reach a 4th step; `lib/store/onboarding-store.test.ts` | covered |
| Selecting "vegana" implies and locks "vegetariana" | manual + test | Playwright screenshot-confirmed lock; `onboarding-store.test.ts` vegano→vegetariano lock case | covered |
| Invalid household size shows a clear message and blocks continuation | manual + test, **with a noted AC-wording divergence** | Playwright confirmed `adultos<=0` blocks with inline message + disabled button; `onboarding.test.ts`. Literal Gherkin describes an independent "total household" field inconsistent with adults — the shipped design derives the total (`adultos+ninos`) instead, making that specific inconsistent-input shape structurally impossible rather than validated at runtime. Intent preserved (inconsistent household can never be saved); literal input shape not reproduced. Recorded as a deliberate divergence in the implementation plan's Technical Decision 2, not silent. | covered (by construction, not by literal reproduction) |
| Allergen declared during onboarding is saved and later respected | manual + test, **gap flagged** | `user-profile.test.ts` covers `upsertUserProfile` payload shape; live DB write NOT walked end-to-end (no login page exists yet, signup hit `429` rate limit in Stage 2) — flagged, not silently skipped | manual (partial) — pending real login flow |

## Next

Fixes 1-3 applied as forward commits (solo-main: direct push to `main`, per user confirmation). Findings 4-7 recorded as considered-and-declined — no code change.
