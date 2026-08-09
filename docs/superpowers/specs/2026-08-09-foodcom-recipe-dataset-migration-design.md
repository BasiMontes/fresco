# Food.com recipe dataset migration — design

**Date:** 2026-08-09
**Status:** Approved (design phase) — not yet implemented

## Context

Fresco's `recipes` catalog currently holds ~1000 AI-generated recipes (Spanish, Gemini-authored) with Unsplash stock photos matched by name/description (backfill pipeline, FRESCO-31, 663/1000 photographed as of 2026-08-08). The user found the **Food.com Recipes and Reviews** dataset (Kaggle, published by Irkaal, 522,517 recipes, license declared CC0 1.0 by the publisher) and wants to bring a curated subset of it into Fresco, alongside a documentation structure crediting the source.

This design covers: how the new recipes get into the catalog without breaking existing user data, how the language/taxonomy gap is closed, where images come from, and what documentation the project carries as a result.

## Key constraints discovered during exploration

- `recipes.id` is referenced by `meal_plan_recipes.recipe_id` with `ON DELETE RESTRICT` — any attempt to delete or replace existing recipe rows referenced by a real meal plan fails at the DB level. 65 real `meal_plans` / 1365 `meal_plan_recipes` rows exist today.
- `favorites.recipe_id` references `recipes.id` with `ON DELETE CASCADE` (5 rows today) — lower risk, but still a reason not to delete rows carelessly.
- The current 1000 recipes are not sourced from any external dataset — they are Gemini-generated. There is no existing "real recipe source" licensing story to preserve; this migration is the first time Fresco ingests external recipe content.
- The app is Spanish-only end to end (UI copy, recipe names, `RecipeClasificacion`/`RecipeDieta` field values). The Food.com dataset is English.
- `components/legal/legal-modal.tsx` already carries the in-app Terms/Privacy content (reviewed recently, `LEGAL_ENTITY_PLACEHOLDER` still unresolved). Any new root-level Terms/Privacy doc would be a second, divergence-prone source of truth for the same legal content.

## Decisions

1. **Coexistence, not replacement.** New Food.com-derived recipes are *added* to the `recipes` table. The existing ~1000 AI-generated recipes are left untouched — both for the FK-safety reason above and because there's no legal or quality reason to remove them.
2. **First batch size: ~1000 recipes** — matches the existing catalog's order of magnitude, keeps AI-translation cost/time bounded, follows the same "curate a manageable batch" pattern already used for the photo backfill.
3. **Translation + taxonomy mapping via Gemini, before insert.** Recipe name, description, ingredients and instructions are translated to Spanish and mapped onto the existing `RecipeClasificacion` / `RecipeDieta` / `alergenos` shape as part of ingestion — not translated at read time.
4. **Images: reuse the existing Unsplash-matching pipeline (FRESCO-31), not Food.com's image URLs.** This sidesteps the single largest licensing ambiguity in the original proposal (per-photo ownership on Food.com's side is not independently verifiable) by reusing a pipeline whose license story is already clear and already shipped.
5. **Documentation: one file, `DATA_SOURCES.md`, at repo root.** Not the originally proposed `DATA_SOURCES.md` + `THIRD_PARTY.md` + `data/README.md` trio (near-total content overlap), and no new root `TERMS.md` / `PRIVACY.md` (would duplicate `legal-modal.tsx`, the actual in-app source of truth).

## Schema change

Additive migration on `public.recipes`:

```sql
alter table public.recipes
  add column source jsonb;
```

Shape (documented in `api/schemas/recipe.types.ts`, not DB-enforced beyond being jsonb):

```ts
interface RecipeSource {
  provider: string          // "Food.com"
  dataset: string           // "Food.com Recipes and Reviews"
  dataset_publisher: string // "Irkaal"
  source_recipe_id: string  // original dataset row id, for traceability/dedup
  declared_license: string  // "CC0 1.0" — as declared by the dataset publisher, not independently verified
}
```

`null` for the existing ~1000 AI-generated recipes (no external source to record). Populated for every recipe inserted by this pipeline.

## Pipeline architecture

Two stages, mirroring the existing resumable-batch pattern used for the photo backfill.

### Stage 1 — curate (no AI, no network calls beyond reading the local CSV)

A Bun script reads the raw Kaggle CSV from `data/raw/` (gitignored — never committed; `data/README.md` documents how to fetch it from Kaggle) and:

1. Filters out rows missing name, ingredients, or instructions.
2. Filters out rows below a minimum rating threshold (if the dataset's rating field is populated) — favors recipes likely to be worth translating.
3. Dedupes against the existing catalog's `nombre`/`slug` (case-insensitive, loose match) to avoid inserting near-duplicates of recipes Fresco already has.
4. Writes ~1000 surviving candidate rows to an intermediate JSON file for inspection before any Gemini spend.

This stage is deterministic and independently testable — no AI involved, so its filtering logic can be unit-tested directly.

### Stage 2 — translate, map, insert (Gemini, batched, resumable)

A second script reads Stage 1's JSON and, in resumable batches of ~30 (same cadence as the photo backfill), with progress checkpointed so a failure mid-run doesn't require restarting from zero:

1. Sends each candidate recipe to Gemini with a structured-output prompt: translate name/description/ingredients/instructions to Spanish, and classify into the existing `RecipeClasificacion` / `RecipeDieta` / `alergenos` vocabulary (reusing the same enums the current catalog already uses — no new taxonomy values invented).
2. Validates the model's output against the `Recipe`/`RecipeClasificacion`/`RecipeDieta` shapes before insert (reject and log, don't insert malformed rows).
3. Inserts into `recipes` with `source` populated per the shape above.

Photo backfill (FRESCO-31's existing pipeline) then runs over the newly-inserted rows exactly as it already does for the AI-generated catalog — no changes needed there.

## Data quality contract

A `RecipeDataContract` test suite (fits the project's QA-portfolio angle):

- `source` is either `null` or has all 5 fields populated (no partial provenance).
- `nombre` is non-empty.
- `ingredientes_principales.length > 0`.
- No duplicate `slug` across the table (existing + newly inserted).
- `dieta` / `alergenos` values are drawn only from the existing known vocabulary (no values Stage 2's mapping invented outside the established enums).

## Documentation

`DATA_SOURCES.md` (repo root), single file, covering:

- What the dataset is, who published it, where (Kaggle / Irkaal / Food.com), and the license *as declared by the publisher* — explicitly worded as "declared," not "verified," per the CC0-nuance the user's original proposal already got right.
- Which fields Fresco actually uses from the dataset.
- A short description of the two-stage pipeline (curate → translate/map/insert).
- An explicit line stating that recipe **images** are Unsplash stock photos matched by the existing FRESCO-31 pipeline, not sourced from Food.com — closing off the most likely point of confusion for a future reader.

Out of scope for this change (noted, not actioned): the root `LICENSE` file still carries the boilerplate's original "UPEX Galaxy" copyright holder, unrelated to this migration — worth fixing separately, not bundled here.

## Out of scope

- Removing or modifying any of the existing ~1000 AI-generated recipes.
- Any change to `legal-modal.tsx`, `TERMS.md`, or `PRIVACY.md` (no new root legal docs created).
- Runtime/on-demand translation.
- Batches beyond the first ~1000 (a second batch, if wanted later, repeats this same pipeline — not designed here).
