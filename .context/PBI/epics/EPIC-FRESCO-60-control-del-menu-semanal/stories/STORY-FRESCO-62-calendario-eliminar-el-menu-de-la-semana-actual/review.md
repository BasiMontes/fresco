# Review — FRESCO-62

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `lib/api/meal-plan.ts`: `deleteMealPlan()` — deletes a `meal_plans` row scoped by `id` AND `user_id` (defense-in-depth on top of the existing `meal_plans_delete_own` RLS policy, same pattern `getUserRecipes()` already uses).
- `lib/api/meal-plan.test.ts`: 3 new tests.
- `components/calendar/delete-week-button.tsx` (new, `'use client'`): calls `deleteMealPlan()` then `router.refresh()`.
- `app/(app)/calendar/page.tsx`: renders the button only in the plan-exists branch.

## Findings

None legitimate. Considered and dismissed:

- **Confirmation dialog before deleting?** Dismissed — the story's own Business Rules Specification is explicit: "acción permanente e inmediata... no hay confirmación de deshacer." Adding one would contradict the spec, not improve it.
- **Optimistic client-side empty-state swap instead of `router.refresh()`?** Dismissed — deleting removes the entire server-rendered branch (plan vs. no-plan), not a single slot's local state the way `CalendarGrid`'s swap/mark mutations do. Only a Server Component re-run expresses "no plan exists now" correctly.
- **Blocking native `alert()` on failure?** Considered mid-implementation, then replaced with the inline `role="alert"` pattern `app/onboarding/page.tsx` already established (and `CalendarGrid` already reuses) — consistent with the rest of the codebase, non-blocking, accessible.
- **Rely on RLS alone, skip the explicit `user_id` filter?** Dismissed — RLS already prevents deleting another user's row, but the explicit filter matches this codebase's existing defense-in-depth convention and makes the query's intent self-evident without having to know the RLS policy exists.

## Live-UI verification

Ran against the real dev server + the shared QA test account. The account had no plan for any week (per every prior story's finding this session), so a real menu was generated live via `/onboarding` → Gemini (default onboarding selections, ~10s) specifically to exercise a real delete:

- Before: `/calendar` showed the real 21-slot generated menu for the current week.
- Clicked the delete button (found via `data-testid`, visually confirmed at a wider 1600px viewport — at the default 1280px the button sits past the calendar grid's own natural horizontal-scroll point, a pre-existing characteristic of this 7-column page, not a regression introduced here).
- After: page fell to the exact same empty state as a week that never had a plan; week navigation (label + prev/next) still rendered correctly in the empty-state branch; delete button correctly absent (nothing left to delete).
- DB-level cascade verified directly: `select count(*) from meal_plan_recipes where meal_plan_id not in (select id from meal_plans)` → `0` — no orphaned rows after the delete.
- "Eliminar no afecta otras semanas" (AC Scenario 2) not re-verified with a second live week (would need a second real Gemini generation) — the delete is scoped by a specific `id` equality match, a structural guarantee rather than something a second live run would prove differently. Flagged here rather than silently assumed.
- Test plan deleted as part of the verification itself — no manual cleanup needed afterward.
