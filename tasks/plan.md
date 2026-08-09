# Implementation Plan: Food.com recipe dataset migration

Spec: `docs/superpowers/specs/2026-08-09-foodcom-recipe-dataset-migration-design.md`

## Overview

Add ~1000 recipes derived from the Food.com Recipes and Reviews Kaggle dataset to Fresco's `recipes` catalog, alongside the existing ~1000 AI-generated recipes (coexistence, no replacement). Recipes are translated to Spanish and mapped onto the existing taxonomy via Gemini before insert; images reuse the existing Unsplash-matching pipeline (FRESCO-31), not Food.com's image URLs. Ships with a single `DATA_SOURCES.md` documenting provenance.

## Architecture decisions

- **Coexistence, additive only.** `meal_plan_recipes.recipe_id` is `ON DELETE RESTRICT` — the existing catalog cannot be safely deleted/replaced while 65 real meal plans reference it. New rows are added, nothing existing is touched.
- **Script-emits-JSON, human/agent-applies-SQL — matches the existing `fetch-recipe-photos.ts` (FRESCO-31) pattern.** That script never writes to Postgres directly; it prints JSON to stdout, which gets converted to SQL and applied via the Supabase MCP with a review step in between. Stage 2 of this pipeline follows the same shape for inserts, for the same reason: a reviewable checkpoint between "AI produced this" and "this is now live data."
- **Two-stage pipeline**, curate (deterministic, testable, no network/AI) then translate+map (Gemini, batched, resumable) — see the spec's rationale.

## Task List

### Phase 1: Foundation

- [ ] Task 1: Schema migration + regenerated types
- [ ] Task 2: `RecipeSource` type + `Recipe.source` field
- [ ] Task 3: `data/` scaffolding (gitignore, README, Kaggle fetch instructions)

### Checkpoint: Foundation
- [ ] `bun run lint:check` clean
- [ ] `bun run types:check` clean
- [ ] Migration applied, `source` column visible via `mcp__supabase__list_tables`

### Phase 2: Stage 1 — curate (no AI)

- [ ] Task 4: `scripts/curate-foodcom-recipes.ts` — filter + dedup + write intermediate JSON
- [ ] Task 5: Unit tests for Stage 1 filtering/dedup logic

### Checkpoint: Stage 1
- [ ] `bun test scripts/curate-foodcom-recipes.test.ts` green
- [ ] Manual: running Stage 1 against a small fixture CSV produces the expected candidate JSON

### Phase 3: Stage 2 — translate, map, prepare inserts (Gemini)

- [ ] Task 6: `scripts/translate-foodcom-recipes.ts` — batched (~30/run), resumable, Gemini structured-output translation + taxonomy mapping, validates against `Recipe`/`RecipeClasificacion`/`RecipeDieta` shapes, emits JSON (same emit-don't-insert pattern as `fetch-recipe-photos.ts`)
- [ ] Task 7: `RecipeDataContract` test suite (data-quality checks against live `recipes` table)

### Checkpoint: Stage 2 pipeline built
- [ ] `bun test` on the contract suite green against current (pre-migration) data
- [ ] Manual: dry run Stage 2 against 5 sample candidates end to end, inspect output JSON before any DB write

### Phase 4: Documentation

- [ ] Task 8: `DATA_SOURCES.md` at repo root

### Checkpoint: Documentation
- [ ] Manual: read-through, confirm the "images are Unsplash, not Food.com" line is present and unambiguous

### Phase 5: Execution (running the pipeline for real — spans multiple sessions, same cadence as the original 36-batch photo backfill)

- [ ] Task 9: Run Stage 1 full curation, inspect the ~1000-candidate output
- [ ] Task 10: Run Stage 2 in batches of ~30 until the candidate pool is exhausted; convert each batch's JSON to SQL, apply via Supabase MCP, verify `RecipeDataContract` stays green after each batch
- [ ] Task 11: Run the existing `fetch-recipe-photos.ts` pipeline over the newly-inserted rows (no script changes needed — it already targets `foto_url is null`)

### Checkpoint: Complete
- [ ] `RecipeDataContract` suite green against the full post-migration table
- [ ] Spot check: 5 random new recipes render correctly in the app (name, ingredients, instructions in Spanish, photo present, `source` populated)
- [ ] `DATA_SOURCES.md` recipe/image counts match the actual final numbers

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Gemini mistranslates or mis-maps taxonomy (e.g. invents an allergen value outside the existing vocabulary) | Med | Stage 2 validates output against the existing enums before emitting; `RecipeDataContract` catches anything that slips through pre-existing checks |
| Anon-key REST insert blocked by RLS on `recipes` (write path, unlike the read-only photo backfill) | Med | Task 1 confirms the insert path (service role via Supabase MCP `execute_sql`, matching the SQL-apply pattern already used for photo backfill) before Stage 2 is built against it |
| CSV encoding/parsing edge cases (Food.com dataset is large and messy) | Low | Stage 1's filter step rejects malformed rows outright rather than attempting to repair them |
| Batch Gemini cost/time exceeds expectations | Low | Same batch size (~30) and resumable checkpoint pattern already proven over 36 real batches on the photo backfill |

## Open Questions

- None outstanding — all resolved during the design phase (see spec).
