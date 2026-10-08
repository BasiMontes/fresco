# ADR-0042 — Catalog recipes carry ingredient quantities in a parallel column, not by reshaping `ingredientes_principales`

- **Status:** Proposed <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-08
- **Deciders:** Basi Montes
- **Tags:** data-model, recipes, migration
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Audit-6 A6-L8 (FRESCO-863): the recipe detail lists ingredients with no quantity. The catalog stores only names, in `recipes.ingredientes_principales` (jsonb `string[]`, for example `["gambas", "ajo", "aceite de oliva"]`). Measured on 2026-10-08 against the linked project: 1173 recipes, 601 active, none with a quantity.

The shopping list does compute quantities, but from `BASE_QUANTITIES` in `supabase/functions/generate-shopping-list/consolidator.ts`, a fixed table keyed by ingredient name (one `ajo` quantity for every recipe). It is not recipe-specific, so it cannot back a recipe card.

`ingredientes_principales` has 14 non-test readers outside the migrations (shopping list, suggestions, cost estimate, photo prompts, dedupe scripts, schema, fixtures), 17 migrations that mention it, and it is the key the ingredient-substitution flow and the allergen filter match on by name.

## Decision

We will add a **new nullable jsonb column `recipes.ingredientes_cantidades`**: an array of `{ nombre, cantidad, unidad }`, quantity **per recipe as written for `meta.raciones` servings**, and leave `ingredientes_principales` untouched.

1. `nombre` repeats the entry of `ingredientes_principales` verbatim, so name matching in substitution, allergen and cost code keeps working off the old column.
2. `cantidad` is a positive number; `unidad` comes from a closed list (`g`, `ml`, `unidades`, `dientes`, `cucharadas`, `cucharaditas`, `pizca`, `al gusto`). The shape is validated by zod at the jsonb boundary (same pattern as FRESCO-820).
3. The existing 601 active recipes are backfilled once with AI-estimated quantities, checked by a plausibility validator and a human-reviewed sample before applying. New recipes must carry the column from creation.
4. The shopping list keeps `BASE_QUANTITIES` for now. Moving it to the new column is a separate follow-up.

## Consequences

- **Positive:** additive and reversible migration, no change to the 14 readers, substitution and allergen matching are not at risk.
- **Negative / trade-offs:** two ingredient lists per recipe that can drift. A DB check or test must assert that every `nombre` in the new column exists in `ingredientes_principales`. Quantities are AI estimates shown as cooking data, so the review sample and the plausibility ranges are the quality gate.
- **Revisit when:** the shopping list moves to the new column, at which point `ingredientes_principales` could become derived from it.

## Alternatives considered

- **Reshape `ingredientes_principales` to objects:** one source of truth, but breaks every reader and the by-name substitution and allergen matching at once. Rejected as too risky for the value.
- **Derive from `BASE_QUANTITIES`:** no migration, but generic numbers repeated across recipes; misleading on a recipe card. Rejected.
