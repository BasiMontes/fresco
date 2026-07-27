# ADR-0002 — Slot-position swaps must bypass `recipe_learning_trigger`, not just avoid touching `estado`

- **Status:** Accepted
- **Date:** 2026-07-27
- **Deciders:** Founder (product + technical decision, drafted by AI workflow for approval)
- **Tags:** data-model, cross-cutting-invariant, learning-moat, triggers
- **Supersedes:** —
- **Superseded by:** —

---

## Context

STORY-FRESCO-11 (Calendar | Reorder the generated menu by dragging dishes between slots) lets a user swap which recipe occupies two `meal_plan_recipes` slots (e.g. Monday-dinner ↔ Tuesday-lunch). The story's own Business Rules field states the invariant plainly: **"El intercambio de posición nunca cambia el estado de aprendizaje (cocinado/descartado) de ninguna receta — es una operación neutral sobre ese estado."** ("A position swap never changes any recipe's learning state — it is a neutral operation with respect to that state.")

`meal_plan_recipes` stores `recipe_id`, `estado` (`pendiente | cocinada | descartada | sustituida`), and `rating` together on the same row, keyed by the fixed `(meal_plan_id, dia, tipo_plato)` slot (`unique_slot` constraint, `supabase/migrations/20260725120100_create_fresco_core_tables.sql:139`). `recipe_learning_trigger` (`supabase/migrations/20260725120200_create_recipe_learning_trigger.sql`, realizing ADR-0001's behavioral-learning moat) fires `AFTER UPDATE ... FOR EACH ROW` and, inside `update_recipe_learning()`, only checks `if old.estado = new.estado then return new; end if;` — it has **no awareness that `recipe_id` can change**. It assumes a row's `recipe_id` is stable for the row's lifetime and that any `estado` change on that row represents a real learning event for whichever recipe currently sits there.

A swap breaks that assumption. Two candidate implementations were evaluated, both incorrect if the trigger fires unmodified:

1. **Swap only `recipe_id`, leave `estado`/`rating` on the row untouched.** The row's `estado` value stays constant across the swap, so `old.estado = new.estado` — the trigger's guard prevents it from firing at all. But this means the estado value is now silently misattributed: if slot A was `cocinada` before the swap, it reads `cocinada` after the swap too, even though the recipe that moved in was never actually cooked. The recipe that *was* cooked (and moved to slot B) loses its `cocinada` flag entirely, and `recipes.veces_cocinada` is never adjusted either way — the row-level flag and the aggregate counter silently diverge from the truth.
2. **Swap `recipe_id`, `estado`, and `rating` together as one bundle** (so learning state travels with its recipe, which is what the business rule actually implies). This is the semantically correct data model, but it makes the trigger **fire spuriously**: if slot A's estado goes from `pendiente` to `cocinada` (because the recipe swapped in already had that estado), `old.estado != new.estado` is true for that row, so the trigger runs `update_recipe_learning()` and increments `recipes.veces_cocinada` / recomputes `rating_promedio` for `new.recipe_id` — even though that recipe's cooked event already happened and was already counted once, before the swap. The swap would double-count a historical learning signal it did not create.

Both failure modes corrupt ADR-0001's moat data (the aggregate `veces_cocinada`/`veces_descartada`/`rating_promedio` counters on `recipes`), which is the exact mechanism the Pro tier is priced on. This is not a story-local trade-off: any future feature that repositions a `meal_plan_recipes` row's recipe assignment without treating it as a fresh cook/discard event (this story is the first, but not necessarily the last — e.g. a future "substitute this dish" affordance) will hit the identical problem, and a wrong fix here sets the wrong precedent for those too.

## Decision

**We will perform slot-position swaps as data-plane-only operations that never invoke `recipe_learning_trigger`, using the swap-time bundle from option 2 above (recipe_id + estado + rating travel together) for correctness, wrapped by an explicit trigger disable/re-enable inside the same transaction.**

Concretely, a new `security definer` Postgres function (e.g. `swap_meal_plan_slots(p_slot_a_id uuid, p_slot_b_id uuid)`) will:

1. Verify both slots belong to the same `meal_plan_id`, and that `meal_plan_id` is owned by `auth.uid()` (replicating the `mpr_update_own` RLS check explicitly, since `security definer` bypasses RLS).
2. `ALTER TABLE public.meal_plan_recipes DISABLE TRIGGER recipe_learning_trigger;`
3. Swap `(recipe_id, estado, rating)` between the two rows in one statement (or two `UPDATE`s in the same function call — both run inside the implicit transaction of a single `plpgsql` function).
4. `ALTER TABLE public.meal_plan_recipes ENABLE TRIGGER recipe_learning_trigger;` (in the same function, so a mid-function error rolls back the whole transaction — including the disable — rather than leaving the trigger permanently off).
5. Raise on any invariant violation (slots not found, not sibling slots of the same plan, not owned by the caller) rather than silently no-op.

**The invariant every future feature must uphold**: any write path that relocates an existing `meal_plan_recipes.recipe_id` (and its `estado`/`rating`) between slots — without the user performing a genuine cook/discard action — must go through a function that disables `recipe_learning_trigger` for that specific transaction. Marking a slot `cocinada`/`descartada` through the normal cook/discard flow (a different, future story) must **never** use this bypass — it is the one write path the trigger must always observe.

## Consequences

- **Positive:** ADR-0001's aggregate learning counters stay accurate — a swap can never inflate or erase `veces_cocinada`/`veces_descartada`/`rating_promedio`. The fix is centralized in one new SQL function, not scattered across client code, so the invariant is enforced at the data layer regardless of which client (web, future mobile) performs the swap.
- **Negative / trade-offs:** introduces a second write pattern (`DISABLE`/`ENABLE TRIGGER` inside a `security definer` function) alongside ADR-0001's "the trigger always fires on `estado` transition" assumption — a future reader of `recipe_learning_trigger` in isolation could reasonably assume it fires unconditionally on every `estado` change unless they also know this ADR exists. Any future write path that touches `recipe_id`/`estado` together must explicitly decide whether it is a "real" learning event (trigger stays on) or a "position-only" change (trigger must be bypassed per this ADR) — this is now a permanent design question new code must answer correctly, not something obviously encoded in the schema itself.
- **Neutral / follow-ups:** if a future feature (e.g. "substitute this recipe" in the Learning epic) also needs to relocate `recipe_id` without a real learning event, it should reuse this same bypass pattern (ideally the same function or a shared helper) rather than re-deriving it — flagged here so that story's own Stage 1 plan cites this ADR instead of re-litigating the trigger's behavior from scratch.

## Alternatives considered

- **Swap only `recipe_id`, leave `estado`/`rating` in place (option 1 above).** Rejected: silently misattributes learning state to the wrong recipe and desyncs the row-level flag from the aggregate counter — worse than firing the trigger, because it corrupts data without even the courtesy of an error or a log line.
- **Swap the full bundle and let the trigger fire as designed.** Rejected: double-counts (or under-counts) an already-recorded learning event on every cross-estado swap, corrupting ADR-0001's moat data — the exact failure mode this ADR exists to prevent.
- **Add a session-scoped GUC (`SET LOCAL app.suppress_learning_trigger = true`) that `update_recipe_learning()` checks at the top, instead of `DISABLE`/`ENABLE TRIGGER`.** Considered, not chosen for this story: functionally equivalent, but requires modifying `update_recipe_learning()` itself (a shared, ADR-0001-governed function) rather than only adding a new, additive function — a larger surface change for the same outcome. `DISABLE`/`ENABLE TRIGGER` is scoped entirely to the new swap function and touches nothing FRESCO-5/ADR-0001 already shipped. Worth revisiting if a third bypass consumer appears and the pattern needs to become more composable.
- **Add a dedicated `sustituida`-adjacent estado value or a `moved_from_slot` audit column instead of a bypass.** Rejected as disproportionate: no requirement in this story (or FR-5.x) asks for an audit trail of slot relocations, and inventing one is scope the story's Out-of-Scope field explicitly excludes ("no añade... espacios nuevos").

## References

- `.context/ADR/ADR-0001-behavioral-learning-moat.md` — the learning-trigger mechanism this decision protects.
- `supabase/migrations/20260725120100_create_fresco_core_tables.sql:124-147` — `meal_plan_recipes` table, `unique_slot` constraint.
- `supabase/migrations/20260725120200_create_recipe_learning_trigger.sql` — `recipe_learning_trigger` / `update_recipe_learning()`, the exact function this ADR modifies the write-path around (not the function body itself).
- STORY-FRESCO-11 Business Rules field (Jira comment, `.context/PBI/epics/EPIC-FRESCO-10-calendario-editable/stories/STORY-FRESCO-11-.../comments.md`): "El intercambio de posición nunca cambia el estado de aprendizaje... es una operación neutral sobre ese estado."
