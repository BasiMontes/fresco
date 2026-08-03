# Review — FRESCO-67

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `components/recipe/recipe-card.tsx`: exported the existing `DIETA_LABELS` map instead of duplicating a second copy.
- `components/recipes/recipe-library.tsx`: 3 new `matches*` predicates (cocina/dieta/alérgeno) combined with FRESCO-65/66's existing ones in the same `filter()` pass; a small `FilterSelect` wrapper around a native `<select>`, reused 3x.

## Findings

None legitimate. Considered and dismissed:

- **Build a custom dropdown component instead of a native `<select>`?** Dismissed — no dropdown primitive exists in this design system, and `SegmentedControl` (already reused for FRESCO-66's 4-option tab) would render all 7–10 options as visible pills, too wide/cluttered at that count. A native `<select>`, minimally styled to match `Input`'s pill shape, is the proportionate choice for a single story.
- **Multi-select for the allergen filter** (avoid several at once)? Out of scope — the AC and Business Rules both say "un alérgeno puntual" (singular); a multi-select wasn't asked for.
- **Diet filter tag mismatch observed live**: selecting "vegano" correctly returned only vegan recipes, but their displayed `Tag` on the card read "vegetariano" instead — this is `RecipeCard`'s own pre-existing `firstActiveDietaLabel()` picking the first true flag in `DIETA_LABELS`' key order (vegetariano listed before vegano; a vegan recipe is definitionally also vegetarian, so both flags are true). Confirmed this is a display-priority quirk in code already shipped before this story, not a filter bug — the filter itself matched correctly on the `dieta.vegano` flag, independent of which tag the card chose to show. Not touched — `RecipeCard` is out of this story's stated scope.
- **No new unit test.** Same reasoning as FRESCO-66: the 3 new predicates are simple pure functions composed into a component with no existing render-test harness; covered via live-UI instead.

## Live-UI verification

Ran against the real dev server + the shared QA test account (real catalog, real `clasificacion`/`dieta`/`alergenos` data):

- Cocina "italiana": narrowed to genuinely Italian-style dishes (risotto, ensaladas, sopa).
- Dieta "vegano": narrowed to vegan recipes (verified the filter's underlying match, independent of the tag-display quirk noted above).
- Alérgeno "Gluten": excluded bread/toast-based recipes present in the unfiltered view, one card explicitly tagged "sin gluten" remained — consistent with real exclusion, not a coincidence.
