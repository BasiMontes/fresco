# ADR-0033 — Per-slot ingredient substitution: nullable jsonb column, RLS-scoped RPC with no identity parameter

- **Status:** Proposed
- **Date:** 2026-09-25
- **Deciders:** AI workflow (sprint-development Stage 1, FRESCO-534), founder approval pending
- **Tags:** data-model, security, food-safety
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`ADR-0032` (FRESCO-715) established the invariant that no ingredient-substitution
story may mutate the shared `recipes` row, and deliberately left FRESCO-534's own
storage shape as "FRESCO-534's own Stage 1 decision". This ADR is that decision.

FRESCO-534 lets a household swap one ingredient inside ONE specific planned meal
(a `meal_plan_recipes` row) for a safe alternative (FRESCO-715's curated catalog +
`get_safe_ingredient_substitutes`), confirmed explicitly, applied to that slot
only. Two questions:

1. **Where does the confirmed substitution live?** It must be per-slot (not
   per-recipe, not per-household-globally) — the same catalog recipe planned in
   two different slots, or by two different households, must not see each
   other's substitution.
2. **What does the write path's authorization look like?** Same governing
   doctrine as `ADR-0032`: `references/rpc-authorization.md`'s six-question
   gate, answered before any SQL.

## Decision

**We will add a single nullable `jsonb` column, `meal_plan_recipes.sustitucion_ingrediente`
(shape `{ "original": text, "sustituto": text }`), rather than a new table.**
The story's own scope explicitly excludes multi-ingredient substitution per
slot, so a 1:1 nullable column is sufficient and simpler than a join table —
promotable to a table later if that scope ever changes, without touching
`recipes` either way.

**We will write it through a new `SECURITY INVOKER` RPC,
`confirm_ingredient_substitution(p_slot_id, p_ingrediente_original,
p_ingrediente_sustituto)`, with no caller-supplied identity parameter.**
`p_slot_id` is a resource reference, not an actor claim — the existing
`mpr_update_own` RLS policy (`exists (select 1 from meal_plans mp where
mp.id = meal_plan_recipes.meal_plan_id and mp.user_id = auth.uid())`) already
scopes the `UPDATE` to the caller's own slot. No `DEFINER` escalation, no
manual actor-bind check, is needed: RLS on the write statement itself is the
enforcement mechanism, and a non-owned `p_slot_id` simply affects 0 rows,
which the function reports as a single non-disclosing "not found" — the same
outcome as a nonexistent slot, an ineligible (terminal-state) slot, or an
ingredient that isn't part of that slot's recipe.

**Defense in depth**: the RPC re-verifies the candidate against
`get_safe_ingredient_substitutes()` at write time, not just at read time —
the UI's candidate list can be stale if the household's declared profile
changed between opening the picker and confirming.

## Consequences

**Positive:**
- Continues `ADR-0032`'s invariant cleanly: `recipes` stays untouched, and this
  RPC family's "no identity parameter, let RLS scope the write" pattern is now
  established for BOTH a read (FRESCO-715) and a write (this ADR).
- The terminal-state guard (no substitution once `cocinada`/`descartada`/
  `excluida`) is enforced in the same `UPDATE`'s `WHERE` clause, not a
  separate round-trip — a single statement, a single row-count check.

**Negative / trade-offs:**
- A `jsonb` column, not a typed/normalized shape, means the substitution's
  two fields are not independently queryable/indexable without a JSON
  operator. Acceptable at this scope (one substitution per slot, read
  entirely together, never filtered by just `original` or just `sustituto`
  across rows).

**Neutral / follow-ups:**
- FRESCO-716 (shopping-list reflection) reads this column directly — no
  further schema needed there, only a read-side change to the shopping-list
  consolidator.

## Alternatives considered

- **New `meal_plan_recipe_substitutions` table.** Rejected for this story's
  scope: adds a join + RLS surface for a 1:1, single-value relationship the
  story explicitly limits to one substitution per slot.
- **`SECURITY DEFINER` + `p_user_id`, mirroring `get_filtered_recipes`.**
  Rejected for the same reason `ADR-0032` rejected it for the read path: the
  `UPDATE` is already fully expressible under the caller's own RLS-scoped
  role; a `DEFINER` escalation would add an actor-bind surface for zero
  functional gain.

## References

- `.context/ADR/ADR-0032-ingredient-substitution-catalog-invoker-rpc.md` — the
  invariant and precedent this ADR extends.
- `.claude/skills/sprint-development/references/rpc-authorization.md` — the
  six-question gate this RPC's design answers.
- `supabase/migrations/20260725120100_create_fresco_core_tables.sql` —
  `mpr_update_own`, the RLS policy this design relies on.
- `supabase/migrations/20260925130000_confirm_ingredient_substitution.sql` —
  this decision's implementation.
- FRESCO-534 (this story), FRESCO-715 (foundation), FRESCO-716 (sibling, reads
  this column).
