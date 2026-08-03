# Review — FRESCO-69

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `lib/api/recipes.ts`: `getRecipeDetail(client, id, userId?)` — tries `recetas_propias` first (cheap PK lookup, RLS-scoped), falls back to chaining `.eq('id', id)` onto `get_filtered_recipes()` (same pattern `getLatestAvailableRecipes()` already uses for `.order()/.limit()`). Returns `null` rather than throwing when `id` matches neither — "not found for you" is an expected outcome, not an error.
- `components/recipes/recipe-detail.tsx`: one `RecipeDetailView` dispatching to `CatalogRecipeDetail`/`PersonalRecipeDetail` — shared shell (back link, name, ingredients, steps), differing metadata block. `RecipeNotFoundState` for the null case.
- `app/(app)/recipes/[id]/page.tsx`: new dynamic route, Server Component, same try/catch-falls-back-to-empty-state pattern as every other page in this family.
- `components/recipes/recipe-library.tsx`: catalog and personal cards wrapped in `next/link` to `/recipes/${id}`.
- `components/recipe/recipe-card.tsx`: the favorite button's `onClick` now calls `preventDefault()`/`stopPropagation()` — a necessary consequence of wrapping the card in a Link (button click was bubbling into navigation), not scope creep on an unrelated feature.

## Findings

None legitimate. Considered and dismissed:

- **Two separate detail components (catalog vs personal) instead of one dispatcher?** Dismissed — the OOS list and the shell are identical; only the metadata block differs. One component with two small render branches avoids duplicating the shared shell.
- **Preserve filter/search state on "back to Biblioteca"?** Out of scope — the AC says "returns to the Biblioteca where she was browsing", satisfied literally by a plain link to `/recipes`. `RecipeLibrary`'s client-side search/tab/filter state was never designed to persist across navigation (it's local `useState`, not URL-synced) — persisting it would be a separate, larger story (URL query params or similar), not implied by this one.
- **Show ALL active diet flags on the detail view vs `RecipeCard`'s single "first match" tag?** Deliberate: the detail view has room a card doesn't, so `activeDietaLabels()` is a new, separate helper (not touching `RecipeCard`'s existing `firstActiveDietaLabel()` — that quirk, noted in FRESCO-67's review, stays exactly as it was, out of this story's scope).

## Live-UI verification

Ran against the real dev server + the shared QA test account:

- Personal recipe ("Tortilla de mi abuela"): opened from the "Tus recetas" section, detail shows name, "Tu receta" tag, ingredients, steps. No console errors.
- Catalog recipe ("Tostada con jamón serrano..."): opened from the grid, detail shows real photo, category, cocina tag, dieta tags (sin lactosa/sin huevo/paleo), allergen tag (Gluten), time/difficulty/cost line, description, ingredients, steps. No console errors.
- Back link: from both detail types, returns to `/recipes`.
- Not-found state: navigated directly to a random UUID, confirmed the "No encontramos esta receta" message renders instead of crashing.
- Did not verify the AI-generation exclusion scenario live (same as FRESCO-68's own review note) — structural guarantee via code review, not a live generation cycle.
