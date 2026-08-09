# Todo: Food.com recipe dataset migration

Plan: `tasks/plan.md` · Spec: `docs/superpowers/specs/2026-08-09-foodcom-recipe-dataset-migration-design.md`

## Task 1: Schema migration + regenerated types

**Description:** Additive migration adding a nullable `source` jsonb column to `public.recipes`. Regenerate Supabase TypeScript types.

**Acceptance criteria:**
- [ ] `alter table public.recipes add column source jsonb;` applied via Supabase MCP
- [ ] `bun run db:types` regenerated, `source` present in `lib/supabase/types.ts`

**Verification:**
- [ ] `mcp__supabase__list_tables` shows the new column
- [ ] `bun run types:check` clean

**Dependencies:** None

**Files likely touched:**
- `supabase/migrations/<timestamp>_add_source_to_recipes.sql`
- `lib/supabase/types.ts`

**Estimated scope:** Small: 1-2 files

---

## Task 2: `RecipeSource` type + `Recipe.source` field

**Description:** Add the `RecipeSource` interface and wire it into `Recipe` in `api/schemas/recipe.types.ts`, per the shape in the spec.

**Acceptance criteria:**
- [ ] `RecipeSource` exported with `provider`/`dataset`/`dataset_publisher`/`source_recipe_id`/`declared_license`
- [ ] `Recipe.source: RecipeSource | null`

**Verification:**
- [ ] `bun run types:check` clean
- [ ] `bun run lint:check` clean

**Dependencies:** Task 1

**Files likely touched:**
- `api/schemas/recipe.types.ts`

**Estimated scope:** Small: 1 file

---

## Task 3: `data/` scaffolding

**Description:** Create `data/README.md` documenting where to fetch the Kaggle CSV and how the pipeline expects it laid out (`data/raw/`). Add `data/raw/` to `.gitignore`.

**Acceptance criteria:**
- [ ] `data/README.md` exists, links the Kaggle dataset, explains `data/raw/` is gitignored and must be fetched manually
- [ ] `.gitignore` excludes `data/raw/`

**Verification:**
- [ ] `git status` after placing a dummy file in `data/raw/` shows it untracked/ignored

**Dependencies:** None

**Files likely touched:**
- `data/README.md`
- `.gitignore`

**Estimated scope:** Small: 1-2 files

---

## Task 4: Stage 1 curation script

**Description:** `scripts/curate-foodcom-recipes.ts` reads the raw CSV from `data/raw/`, filters incomplete rows, filters by minimum rating (if present), dedupes against the existing catalog's `nombre`/`slug`, writes ~1000 candidates to an intermediate JSON file. No network calls, no AI.

**Acceptance criteria:**
- [ ] Rejects rows missing name/ingredients/instructions
- [ ] Dedupes against existing `recipes.nombre`/`slug` (case-insensitive, loose match)
- [ ] Writes candidate JSON with enough of the original row preserved for Stage 2 (raw name, ingredients, instructions, rating, source recipe id)

**Verification:**
- [ ] Manual: run against a small fixture CSV (a handful of rows, including at least one that should be rejected and one that should be deduped), inspect output

**Dependencies:** Task 1, Task 3

**Files likely touched:**
- `scripts/curate-foodcom-recipes.ts`

**Estimated scope:** Medium: 1 file, non-trivial logic

---

## Task 5: Stage 1 unit tests

**Description:** Unit tests for the filtering/dedup logic in Task 4, using small in-memory fixtures — no real CSV or DB needed.

**Acceptance criteria:**
- [ ] Covers: reject-on-missing-field, reject-below-rating-threshold, dedup-against-existing, accept-valid-row

**Verification:**
- [ ] `bun test scripts/curate-foodcom-recipes.test.ts` green

**Dependencies:** Task 4

**Files likely touched:**
- `scripts/curate-foodcom-recipes.test.ts`

**Estimated scope:** Small: 1 file

---

## Task 6: Stage 2 translate + map script

**Description:** `scripts/translate-foodcom-recipes.ts` reads Stage 1's JSON, processes in resumable batches of ~30, sends each candidate to Gemini for Spanish translation + taxonomy mapping (`RecipeClasificacion`/`RecipeDieta`/`alergenos`, reusing existing enum values only), validates the result against the `Recipe` shape, and emits JSON to stdout (same emit-don't-insert pattern as `fetch-recipe-photos.ts` — does NOT write to Postgres directly).

**Acceptance criteria:**
- [ ] Batch size configurable via CLI arg (default ~30), matching `fetch-recipe-photos.ts`'s convention
- [ ] Progress checkpointed so re-running after a partial failure doesn't reprocess already-done candidates
- [ ] Rejects (logs, doesn't emit) any model output whose classification values fall outside the existing enums
- [ ] Emits `source` populated per the `RecipeSource` shape

**Verification:**
- [ ] Manual: dry run against 5 real candidates from Stage 1's output, inspect the emitted JSON before converting to SQL

**Dependencies:** Task 2, Task 5

**Files likely touched:**
- `scripts/translate-foodcom-recipes.ts`

**Estimated scope:** Medium: 1 file, external API integration

---

## Task 7: `RecipeDataContract` test suite

**Description:** Data-quality tests against the live `recipes` table (existing + newly inserted), per the spec's contract list.

**Acceptance criteria:**
- [ ] `source` is either null or fully populated (no partial provenance)
- [ ] No empty `nombre`
- [ ] `ingredientes_principales.length > 0`
- [ ] No duplicate `slug`
- [ ] `dieta`/`alergenos` values only from the existing known vocabulary

**Verification:**
- [ ] `bun test scripts/recipe-data-contract.test.ts` green against current (pre-migration) data first, to confirm the suite itself is correct before it's used as a gate

**Dependencies:** Task 2

**Files likely touched:**
- `scripts/recipe-data-contract.test.ts` (or under a `tests/` path if the repo has one — check convention before placing)

**Estimated scope:** Small: 1 file

---

## Task 8: `DATA_SOURCES.md`

**Description:** Single root-level file per the spec's Documentation section — dataset identity, declared-vs-verified license framing, fields used, pipeline summary, explicit Unsplash-not-Food.com image note.

**Acceptance criteria:**
- [ ] Matches the spec's `DATA_SOURCES.md` content outline exactly
- [ ] No `TERMS.md`/`PRIVACY.md` created (explicitly out of scope)

**Verification:**
- [ ] Manual read-through

**Dependencies:** None (can be written in parallel with Phases 2-3)

**Files likely touched:**
- `DATA_SOURCES.md`

**Estimated scope:** Small: 1 file

---

## Task 9: Run Stage 1 for real

**Description:** Fetch the actual Kaggle CSV into `data/raw/` (manual, per `data/README.md`), run Stage 1 against it.

**Acceptance criteria:**
- [ ] ~1000 candidates produced
- [ ] Spot-check output for obvious garbage before proceeding to Stage 2

**Verification:**
- [ ] Manual inspection of candidate count + a sample of entries

**Dependencies:** Task 4, Task 5 done and green

**Files likely touched:** None (execution only)

**Estimated scope:** N/A — execution task

---

## Task 10: Run Stage 2 in batches (multi-session)

**Description:** Repeatedly run Stage 2 in ~30-candidate batches until the pool from Task 9 is exhausted. Convert each batch's emitted JSON to SQL (same `jq` conversion pattern as `fetch-recipe-photos.ts`'s header comment), apply via Supabase MCP, re-run `RecipeDataContract` after each batch.

**Acceptance criteria:**
- [ ] All ~1000 candidates processed (or explicitly rejected with a logged reason)
- [ ] `RecipeDataContract` stays green after every batch — a batch that breaks it is not applied

**Verification:**
- [ ] `RecipeDataContract` suite green after the final batch

**Dependencies:** Task 6, Task 7 done and green; Task 9 complete

**Files likely touched:** None (execution only — expect this to span multiple sessions, same as the 36-batch photo backfill)

**Estimated scope:** N/A — execution task, likely the longest-running part of this whole effort

---

## Task 11: Run photo backfill over new recipes

**Description:** Run the existing `scripts/fetch-recipe-photos.ts` — no changes needed, it already targets any recipe with `foto_url is null`, which now includes the newly-inserted Food.com-derived rows.

**Acceptance criteria:**
- [ ] New recipes get photos via the same Unsplash pipeline as the original catalog

**Verification:**
- [ ] Spot check a handful of new recipes have a non-null, sensible `foto_url`

**Dependencies:** Task 10 complete

**Files likely touched:** None (execution only, reuses existing script)

**Estimated scope:** N/A — execution task

---

## Checkpoints

- [ ] **After Task 3:** `lint:check` + `types:check` clean, migration confirmed live
- [ ] **After Task 5:** Stage 1 tests green, sample run produces sane output
- [ ] **After Task 7:** Stage 2 dry run + contract suite green against current data
- [ ] **After Task 8:** Docs read-through
- [ ] **Final (after Task 11):** Contract suite green against full table, 5-recipe spot check in the app, `DATA_SOURCES.md` counts match reality
