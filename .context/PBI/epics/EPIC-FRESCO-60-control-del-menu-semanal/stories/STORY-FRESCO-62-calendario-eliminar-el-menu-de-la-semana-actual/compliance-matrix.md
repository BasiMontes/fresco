# Spec Compliance Matrix — FRESCO-62

| AC scenario (Gherkin) | covered_by | evidence | status |
| --- | --- | --- | --- |
| Laura elimina el menú de la semana que está viendo | test:lib/api/meal-plan.test.ts + manual:live-ui | 3 unit tests (success, DB error, no-session) + Playwright: deleted a real generated plan, page fell to the empty state, DB cascade confirmed 0 orphaned `meal_plan_recipes` rows (2026-08-03 session) | covered |
| Eliminar no afecta otras semanas | review-approved:self | Structural guarantee — `deleteMealPlan()` scopes by exact `id` equality, not a range; not re-verified against a second live week (would require a second real Gemini generation), flagged in `review.md` | manual |
| No hay nada que eliminar | review-approved:self | `DeleteWeekButton` is only rendered in `/calendar/page.tsx`'s plan-exists branch — structurally impossible to show it with nothing to delete | review-approved |
