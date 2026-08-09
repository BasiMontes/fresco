# Data sources

Fresco's `recipes` catalog is built from two sources:

1. **~1000 AI-generated recipes** (Spanish, no external dataset — these are not attributable to any third party).
2. **A curated subset of the Food.com Recipes and Reviews dataset**, described below.

## Food.com Recipes and Reviews

- **Dataset**: [Food.com Recipes and Reviews](https://www.kaggle.com/datasets/irkaal/foodcom-recipes-and-reviews)
- **Published on**: Kaggle
- **Published by**: Irkaal
- **License**: CC0 1.0, **as declared by the publisher**. This is *declared*, not independently *verified* — a Kaggle publisher stating CC0 does not, by itself, establish ownership of every individual recipe in the set. Fresco records this distinction in each ingested recipe's `source.declared_license` field rather than treating it as a confirmed fact.

### Fields used

From the dataset's ~522,000 rows, Fresco reads: `RecipeId`, `Name`, `Description`, `RecipeIngredientQuantities`, `RecipeIngredientParts`, `RecipeInstructions`, `Keywords`, `RecipeCategory`, `AggregatedRating`, `ReviewCount`, `RecipeServings`, `CookTime`, `PrepTime`, `TotalTime`. Everything else in the source CSV (author info, nutrition breakdown, per-recipe images, etc.) is not imported.

### Pipeline

Ingestion happens in two stages (see `docs/superpowers/specs/2026-08-09-foodcom-recipe-dataset-migration-design.md` for the full design):

1. **Curate** (`scripts/curate-foodcom-recipes.ts`) — filters incomplete/low-rated rows and dedupes against the existing catalog. No AI, no translation.
2. **Translate + map** (`scripts/translate-foodcom-recipes.ts`) — translates the surviving candidates to Spanish and maps them onto Fresco's existing taxonomy (diet, allergens, cuisine, etc.) via Gemini, in reviewable batches.

Every recipe ingested this way carries a `source` field recording the provider, dataset, publisher, original recipe id, and declared license. The existing AI-generated recipes have `source: null`.

### Images

Recipe photos for Food.com-derived recipes are **not** sourced from Food.com. They reuse Fresco's existing Unsplash-matching pipeline (`scripts/fetch-recipe-photos.ts`, FRESCO-31) — the same stock-photo backfill already used for the original AI-generated catalog.

---

*Out of scope for this migration, noted but not fixed here: the repository's root `LICENSE` file still carries the boilerplate's original "UPEX Galaxy" copyright holder, unrelated to this dataset.*
