---
topic_key: pbi/FRESCO-7/review
---

# Code Review — FRESCO-7 (Menu Generation)

Stage 3 review run retroactively (solo-main strategy — all 9 Stage 2 commits, `798e749..d92e44c`, were already committed and pushed to `main`). Native `gentle-ai` bounded review lifecycle: `lineage=review-5a5cbf7988f06f71`, `risk_level=high` (1064 changed lines, base `1049263`), full 4R lens sweep.

## Adjudicated findings

| # | Severity | File:line | Finding | Verdict | Action |
|---|---|---|---|---|---|
| 1 | CRITICAL | `lib/api/meal-plan.ts` `reshapeMenu` | Independently confirmed by 2 lenses (resilience + reliability) via direct code read: no check that all 21 slots (7 days × 3 tipos) are present before returning the grid. A partial write (`generate-meal-plan/index.ts`'s own documented NFR-REL-2 gap — no multi-table transaction) could leave a `meal_plans` row with incomplete children; `/menu` and `/calendar` both index the grid unconditionally (`plan.menu.lunes.desayuno`, `plan.menu[dia][tipo]`), crashing the Server Component render instead of falling back to the empty state. The existing test fixture itself proved the bug: a 2-of-21-row fixture was checked in as the "happy path" test. | legitimate, CRITICAL | **fixed** — added a completeness check (all 7×21 slots) to `reshapeMenu`, throwing `MealPlanError` (consistent with the existing missing-recipe check) so callers' existing catch blocks fold it into the safe empty state instead of crashing. Fixed the mis-scoped test fixture (now a full 21-row happy-path fixture) and added a dedicated incomplete-plan test. |
| 2 | WARNING | `supabase/functions/generate-meal-plan/index.ts`, `app/onboarding/page.tsx` | `generateMealPlan` threw 502 from two unrelated causes: an immediate Gemini-call failure (genuine upstream outage) and exhausted-retries "no valid menu could be assembled" (AC-4's actual case). The frontend narrowed on `status === 502` for AC-4-specific copy, so a transient Gemini outage would be mislabeled as "your dietary restrictions are too restrictive." | legitimate | **fixed** — changed the exhausted-retries throw to 422 (matching this file's own existing "insufficient catalog" 422 convention: "understood the request, can't fulfill it given your constraints" vs. 502's "genuine upstream failure"), frontend narrows on 422. |
| 3 | WARNING | `app/(app)/menu/page.tsx`, `app/(app)/calendar/page.tsx` | Both catch blocks folded every `getMealPlanForWeek` failure (network/DB error, no-session) into the same empty state with zero logging — a real outage would be invisible, indistinguishable from a benign "haven't generated a menu yet" state. | legitimate | **fixed** — added `console.error` in both catch blocks before the fallback. |
| 4 | WARNING | `app/(app)/menu/page.tsx`, `app/(app)/calendar/page.tsx` | The empty-state composition (title/description/CTA) was copy-pasted verbatim across both pages, even though `components/ui/empty-state.tsx`'s own doc comment says it exists so `/calendar` can reuse `/menu`'s empty-state work — only the low-level primitive was shared, not the actual composed instance. | legitimate | **fixed** — extracted `components/menu/no-menu-empty-state.tsx` (`NoMenuEmptyState`), both pages now use it. |
| 5 | WARNING | `app/(app)/menu/page.tsx`, `app/(app)/calendar/page.tsx` | No `loading.tsx` exists for either route; under latency, navigation shows no in-flight indicator. | legitimate but lower priority (UX polish, no AC requires it) | **declined for now** — noted as a follow-up, not blocking this story. |
| 6 | SUGGESTION | `components/recipe/recipe-card.tsx` | `firstActiveDietaLabel()` picks the first truthy diet flag in object-declaration order with no comment explaining the implicit priority (vegetariano before vegano, etc.). | legitimate, cosmetic | **declined** — real but minor; not touched, no functional impact. |
| 7 | — | `lib/mock/recipes.ts` | 2 approximated enum values where no exact match existed (cuisine, category) — confirmed accurately commented at their usage sites. | accurate, no defect | none |
| — | — | (risk lens) | RLS/ownership scoping, Server Component auth/caching, secrets, dependencies — all confirmed correct, no findings. | — | none |

## Spec Compliance Matrix

| AC scenario (Gherkin) | covered_by | evidence | status |
|---|---|---|---|
| Laura receives 21 meals across 7 days, request completes fast | test + manual | `meal-plan.test.ts` (reshape correctness, now with completeness guard), `index.ts`'s existing retry/validation loop (pre-existing, unchanged); real end-to-end timing not walked live (no auth flow exists yet) | covered (structural), manual timing not walked |
| Menu stays within weekly budget | test | `validator.test.ts` (3 tests: overage math, within-budget, null-budget skip) — soft-warning via `advertencias`, bucket-euro midpoints user-confirmed | covered |
| No lunch/dinner repeat, breakfast ≤3 repeats | test (pre-existing, unchanged) | `validator.ts`'s structural check, untouched by this diff | covered |
| No valid menu can be produced → clear message, never a partial/broken menu | test + manual, **gap closed this review** | `index.ts` now throws 422 (was ambiguous 502) specifically for this case; `app/onboarding/page.tsx` narrows on it with AC-4-specific copy; the persisted-menu completeness guard (finding #1) ensures a partial menu can never reach the UI as if it were valid either | covered |
| Compromise explanation shown when generation had to trade off | test + manual | `AlertBanner` wired into both `/menu` and `/calendar` consuming `plan.advertencias`; real advertencias-populated state not walked live (no auth flow) | covered (component-level), manual full walk pending |

## Next

Fixes 1-4 applied as forward commits (already-pushed history, solo-main). Finding 5 tracked as a follow-up, not blocking. No architectural rework needed — all fixes were local, no ADR promotion required.
