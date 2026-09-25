# ADR-0032 — Ingredient substitution: global curated catalog + SECURITY INVOKER RPC, never mutate `recipes`

- **Status:** Proposed
- **Date:** 2026-09-25
- **Deciders:** AI workflow (sprint-development Stage 1, FRESCO-715), founder approval pending
- **Tags:** data-model, security, food-safety, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

FRESCO-534 ("swap one ingredient inside a planned recipe") was found mid-refinement to need
infrastructure that does not exist: no ingredient carries an allergen tag anywhere in the
schema (`lib/grocery/ingredient-dictionary.ts` is pricing/aisle-only), `recipes.alergenos` /
`recipes.ingredientes_principales` are recipe-level JSONB arrays on the SHARED catalog row
(one `recipes` row serves every household that gets it in a plan), and no substitution
candidate list exists anywhere. The story was split into an epic (`EPIC-FRESCO-714`); this ADR
records the two structural decisions FRESCO-715 (the foundation story) makes, both of which the
later stories (FRESCO-534, FRESCO-716) build directly on top of and would be expensive to
reverse once other code depends on the shape.

Two questions had to be answered before any SQL:

1. **Where does a per-household substitution live**, given `recipes` is deliberately shared,
   founder-curated, cross-user catalog data (`ADR-0001`'s aggregation columns — `veces_cocinada`
   etc. — depend on that sharing being real)?
2. **What does the safety-check function look like**, given the project's only existing
   precedent (`get_filtered_recipes`) uses `SECURITY DEFINER` plus a caller-supplied
   `p_user_id` parameter, and `references/rpc-authorization.md` treats that shape as guilty
   until proven necessary?

## Decision

**We will store the substitution catalog as a new, global, curated reference table
(`ingredient_substitutions`) — never mutate `recipes` or any of its per-household plan rows to
represent a substitution.** The table is public-read (same RLS shape as `recipes`: `select` for
`anon`+`authenticated`, write access is `service_role` only) and keyed by
`(ingrediente_original, ingrediente_sustituto)`. FRESCO-534's actual per-slot override (where a
household's specific choice gets recorded against their own meal plan) is explicitly **out of
this ADR's scope** — it is FRESCO-534's own Stage 1 decision, but it MUST follow the same
invariant this ADR states: **no story in this epic may write to the shared `recipes` row to
represent a per-household substitution.**

**We will use `SECURITY INVOKER` with no caller-supplied identity parameter at all** for the
safety-check RPC (`get_safe_ingredient_substitutes(p_ingrediente text)`), reading `auth.uid()`
directly inside the function body instead of accepting a `p_user_id`/`p_actor_user_id`
parameter. This is a deliberate divergence from `get_filtered_recipes`'s `SECURITY DEFINER` +
`p_user_id` pattern: neither table the new function reads (`user_profiles`, already
self-readable via `profiles_select_own`; `ingredient_substitutions`, public-read by this same
ADR) requires the RLS bypass a `DEFINER` grants, so the escalation buys nothing. Removing the
identity parameter entirely — rather than adding an actor-bind guard to it — eliminates the
whole class of bug `references/rpc-authorization.md` warns about: a function that cannot be
told who the caller is cannot be lied to.

**The invariant every future ingredient-substitution RPC must uphold**: if the function only
ever needs to act on the CALLER's own data, it takes no identity parameter and reads
`auth.uid()` directly. `SECURITY DEFINER` is reached for only when a function genuinely needs
to read something the caller's own RLS-scoped role cannot see (per
`references/rpc-authorization.md` §2) — not by default, and not by copying a neighboring
migration.

## Consequences

**Positive:**
- `recipes.aprendizaje` aggregation (`ADR-0001`) stays correct — no substitution ever touches a
  `recipes` row, so `veces_cocinada`/`veces_descartada`/`rating_promedio` keep meaning what they
  already mean for every household sharing that catalog recipe.
- The new RPC has zero actor-bind surface to audit, review, or get wrong — there is no
  parameter to spoof. Simpler to reason about and to test than `get_filtered_recipes`.
- Curated-not-generated catalog keeps this story inside the "leftover-ingredient AI" blacklist
  boundary (`mvp-scope.md`) — the RPC is a lookup over reviewed rows, never a generation call.

**Negative / trade-offs:**
- The catalog only covers what a human curates. Coverage gaps (an ingredient with no
  substitute row) are a normal, expected outcome, not a bug — surfaced to the user as an
  explicit "no safe substitute" state (FRESCO-534's own AC), not silently hidden.
- FRESCO-534 still owes its own storage decision for the per-household override (a new
  column/table hung off `meal_plan_recipes`, per the epic-creation pass's recorded direction) —
  this ADR does not resolve that, only the invariant it must respect.

**Neutral / follow-ups:**
- Seed coverage this pass: 8 of the 12 canonical allergens, cross-checked against real
  `recipes.ingredientes_principales` usage (not invented against the full EU-14 list).
  `moluscos` / `pescado` / `sulfitos` are a follow-up seed pass, not a gap in this ADR's
  architecture.
- If a future ingredient-substitution RPC genuinely needs cross-household data (a use case
  nothing in this epic currently has), reopen this ADR rather than defaulting that function to
  `DEFINER` by habit.

## Alternatives considered

- **Clone the `recipes` row per substitution.** Rejected: pollutes the shared catalog with
  one-off per-household clones, breaks the `aprendizaje` aggregation model (a clone starts at
  zero `veces_cocinada`), and duplicates data the catalog is designed to keep singular.
- **`SECURITY DEFINER` + `p_user_id`, mirroring `get_filtered_recipes`.** Rejected: neither
  source table needs the RLS bypass, so the escalation adds an actor-bind class of bug for zero
  functional benefit. Kept as the acknowledged existing pattern elsewhere in the codebase, not
  extended here.
- **AI-generated, open-ended substitution suggestions.** Rejected outright: explicitly
  blacklisted ("leftover-ingredient AI", `mvp-scope.md`) and incompatible with the food-safety
  guardrail's fail-closed requirement (a generative suggestion cannot be pre-vetted the way a
  curated row can).

## References

- `.context/ADR/ADR-0001-behavioral-learning-moat.md` — the aggregation invariant this decision
  protects.
- `.claude/skills/sprint-development/references/rpc-authorization.md` — the six-question gate
  this RPC's design answers.
- `supabase/migrations/20260901073555_allergen_filter_safety_net.sql` — `get_filtered_recipes`,
  the precedent this ADR deliberately diverges from.
- `supabase/migrations/20260925120000_ingredient_substitution_catalog.sql` — this decision's
  implementation.
- FRESCO-714 (epic), FRESCO-715 (this story), FRESCO-534, FRESCO-716 (siblings this ADR binds).
