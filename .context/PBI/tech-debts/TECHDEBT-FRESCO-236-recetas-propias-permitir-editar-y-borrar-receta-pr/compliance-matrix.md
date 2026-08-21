# Spec Compliance Matrix — FRESCO-236

No formal Gherkin AC (Tarea/tech-debt, description-driven scope). Rows below map the ticket description's scenarios to evidence instead.

| Scenario | covered_by | evidence | status |
|---|---|---|---|
| Owner can edit their own personal recipe (name/ingredients/steps) and the change persists | manual + test:lib/api/recipes.test.ts | live-UI validation (rename persisted, no console errors) + unit tests for `updateRecetaPropia` (success/DB-error/no-session) | covered |
| Owner can delete their own personal recipe and it's removed from their library | manual + test:lib/api/recipes.test.ts | live-UI validation (confirm dialog, navigated to /recipes, recipe gone) + unit tests for `deleteRecetaPropia` (success/DB-error/no-session/0-rows) | covered |
| Non-owner cannot edit or delete another user's personal recipe | review-approved:adversarial-reviewer | RLS `recetas_propias_update_own`/`recetas_propias_delete_own` (auth.uid() = user_id, both `using` and `with check`) + app-layer `.eq('user_id', ...)` defense-in-depth verified in review | covered |
| Cancelling an edit does not leave stale data on next open | manual | live-UI re-validation post-fix (junk typed, cancelled, reopened — real name shown) | covered |
| A saved edit is not reverted on reopening the dialog | manual | live-UI re-validation post-fix (renamed, saved, reopened — new name shown, not reverted) | covered |
| Deleting an already-deleted / not-owned recipe fails loudly instead of silently no-oping | test:lib/api/recipes.test.ts | new unit test: delete affecting 0 rows throws `RecipesError` | covered |
| Recipe-library card list is unaffected (out of scope for this ticket) | exempt:scope-confirmed-with-user | detail-page-only scope confirmed via AskUserQuestion before implementation | exempt |
