# Review — FRESCO-59

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `lib/api/recipes.ts`: `RecipeRow`/`toRecipe` moved here from `meal-plan.ts` (now shared instead of duplicated) + new `getLatestAvailableRecipes()`.
- `lib/api/recipes.test.ts`: 7 new tests for `getLatestAvailableRecipes`.
- `lib/api/meal-plan.ts`: imports `RecipeRow`/`toRecipe` from `recipes.ts` instead of a local copy.
- `components/menu/latest-recipes-section.tsx` (new): section + "Ver todas" link, reuses `RecipeCard`.
- `app/(app)/menu/page.tsx`: fetches the recipes, renders the section in both branches.

## Findings

None legitimate. Considered and dismissed:

- **Duplicate `toRecipe`/`RecipeRow` in `recipes.ts` instead of moving them?** Dismissed — a second copy of a jsonb-cast mapper is exactly the kind of drift risk FRESCO-9's own migration history already hit once (`get_filtered_recipes`'s `dieta_keto`/`dieta_halal` bug). Moved instead of duplicated; `meal-plan.ts` now imports from `recipes.ts`, all existing call sites unchanged.
- **Add a new dedicated SQL function/RPC for "latest N filtered recipes" instead of chaining `.order()`/`.limit()` onto the existing RPC?** Dismissed — PostgREST supports ordering/limiting a function's `setof` result exactly like a table query; chaining reuses `get_filtered_recipes()` completely untouched (no new migration, no second safety-filter implementation to keep in sync with ADR-0001).
- **Show the section header even with 0 eligible recipes?** Dismissed — `LatestRecipesSection` returns `null` on an empty array rather than rendering a heading with nothing under it; AC Scenario 2 only makes sense when the section (and its "Ver todas" button) is actually visible.
- **No unit test for `LatestRecipesSection` itself.** Same reasoning as FRESCO-56/58: no React-render-test harness exists in this repo; the component has one conditional (empty-array early return) that's simple enough to cover via live-UI + code review rather than a new test dependency. The real logic (`getLatestAvailableRecipes`) IS unit-tested.

## Live-UI verification

Ran against the real dev server + the shared QA test account, empty-state branch (no active plan): the "Últimas recetas añadidas" section renders 6 real recipe cards (real names, categories, tags from the actual catalog) + a "Ver todas" link; clicking it navigated to `/recipes`. Screenshot reviewed — no layout defects. Happy-path render not independently re-verified live for the same reason as FRESCO-56/57/58 (test account had no plan at the time) — same component instance in both branches.
