# Recipe dataset ingestion

Source data for the Food.com recipe migration (FRESCO-138). See
`docs/superpowers/specs/2026-08-09-foodcom-recipe-dataset-migration-design.md`
for the full design and `tasks/plan.md` / `tasks/todo.md` for the task
breakdown.

## Fetching the raw dataset

The pipeline reads from `data/raw/`, which is gitignored — the raw CSV is
never committed (it's large, and it's a third-party dataset, not something
this repo should redistribute).

1. Download the **Food.com Recipes and Reviews** dataset from Kaggle:
   https://www.kaggle.com/datasets/irkaal/foodcom-recipes-and-reviews
2. Extract the CSV into `data/raw/` (create the directory if it doesn't exist).
3. Confirm the expected filename matches what `scripts/curate-foodcom-recipes.ts`
   reads (see that script's header comment once it exists — Task 4).

## Pipeline overview

Two stages — see the design spec for full rationale:

1. **Curate** (`scripts/curate-foodcom-recipes.ts`) — filters and dedupes the
   raw CSV against the existing catalog, no AI involved. Writes an
   intermediate JSON candidate list (also under `data/raw/`, also gitignored).
2. **Translate + map** (`scripts/translate-foodcom-recipes.ts`) — Gemini
   translates each candidate to Spanish and maps it onto Fresco's existing
   recipe taxonomy, in resumable batches. Emits JSON for review before any
   database write (same pattern as `scripts/fetch-recipe-photos.ts`).

Nothing in `data/` ships to the deployed app — the only durable output of
this pipeline is rows in the `recipes` table.
