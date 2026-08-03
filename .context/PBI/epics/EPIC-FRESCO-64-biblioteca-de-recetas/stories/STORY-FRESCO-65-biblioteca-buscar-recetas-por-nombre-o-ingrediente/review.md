# Review — FRESCO-65

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `lib/api/recipes.ts`: `getCatalogRecipes()` — same `get_filtered_recipes()` RPC as its siblings, no `.order()`/`.limit()`.
- `lib/api/recipes.test.ts`: 6 new tests.
- `lib/api/meal-plan.ts`: **removed** `getUserRecipes()` — my own change (swapping `/recipes`'s data source) made it dead; no other caller existed (verified via grep before deleting), no test existed for it either.
- `components/recipes/recipe-library.tsx` (new, `'use client'`): search input + filtered grid + the two distinct empty states.
- `app/(app)/recipes/page.tsx`: rewritten around `getCatalogRecipes()`, "Biblioteca" framing.

## Findings

None legitimate. Considered and dismissed:

- **Keep `getUserRecipes()` around unused, in case something needs "recipes actually cooked" later?** Dismissed — YAGNI; it's in git history if ever needed, and an unused exported function is exactly the kind of dead code my own change should clean up, not leave behind.
- **Accent-folding in search** ("piña" won't match a search typed "pina")? Out of scope — not required by AC, flagged explicitly in the plan and here rather than silently shipped as if it were handled.
- **Substring search producing an unintended match** — searching "pollo" also matched "Repollo salteado..." (cabbage), because "pollo" is a literal substring of "repollo". Confirmed live. Not a bug against the AC as written ("contiene ese ingrediente/nombre" — a substring is technically contained), but a real, visible side effect of naive substring matching worth knowing about; word-boundary matching would fix it at the cost of missing partial-word searches some users might want (e.g. "salm" for "salmón"). Left as-is, documented here rather than silently accepted or silently "fixed" without a product call.
- **Sidebar nav still reads "Recetas", page `h1` now reads "Biblioteca"** — noticed, not touched. The nav label is a separate component outside this story's stated scope (search + catalog reframe); renaming nav items wasn't asked for.
- **Pre-existing Next.js LCP image warnings** (`loading="eager"` suggestion) surfaced in the console once real photos + a full grid rendered together — this is `RecipeCard`'s own existing `<Image>` usage, unrelated to this story's diff (confirmed: `RecipeCard` untouched), just newly visible because the reframed page now renders many more real images at once than the old cooked-history grid typically did. Noted, not fixed — out of this story's scope per the "notice unrelated, don't fix" rule.

## Live-UI verification

Ran against the real dev server + the shared QA test account (real, populated catalog from FRESCO-31's photo batches):

- Base grid: real recipes with real photos, tags, cook time/difficulty render correctly under the "Biblioteca" heading.
- Search by name ("pollo"): narrowed correctly to matching recipes.
- Search by ingredient: same input, confirmed via the "pollo"-in-"repollo" case above (ingredient/name substring logic is the same code path).
- No-results state: distinct copy and icon from the catalog-empty state, confirmed via a garbage search term.
- Catalog-empty state (`EmptyCatalogState`) not triggered live — would require an artificially over-restrictive test profile; reviewed in code instead (simple `recipes.length === 0` branch, same pattern as every other empty-state check on this page family).
