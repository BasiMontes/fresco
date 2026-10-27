# ADR-0067 — A recipe's season is computed from its ingredients and the database refuses one that does not fit

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-27
- **Deciders:** Basi Montes (rule, scope and the five manual cases agreed in conversation on 2026-10-27, FRESCO-1058); drafted by an AI session
- **Tags:** catalogue, database, integrity, menu-generation
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`recipes.temporada` was a free JSON column typed by hand or by the model that wrote the recipe. On 2026-10-27, 365 of the 538 active recipes (68 %) carried `todo_el_ano` and no written rule said when that value was right. The menu selector (`supabase/functions/generate-meal-plan/menu-selector.ts`) gives 3 points to a recipe whose season includes the planned week's season and 1 to `todo_el_ano`, so with that split the season hardly told recipes apart. The catalogue was about to be regenerated under new rules, and the allergen and diet tags had already been put under a database barrier (ADR-0064). The same reasoning applied to the season: fix the rule before regenerating.

One hosted row also stored `["invierno", "primavera"]`, the wrong calendar order, which shows the column had no shape rule either.

## Decision

1. **The season is computed, not assigned.** A table `ingredient_seasons` lists the fresh produce and herbs that have a clear season in Spain, each with its seasons. A recipe's season is the set of seasons in which **all** its seasonal ingredients are in season, in calendar order (`primavera`, `verano`, `otono`, `invierno`). A recipe with no seasonal ingredient is `['todo_el_ano']`. The rule lives in the SQL function `compute_recipe_temporada(ingredientes_principales)`, which returns NULL when the seasonal ingredients share no season.
2. **What is in the table.** Fresh fruit, vegetables, greens and herbs only. Fish, meat, processed products (crushed, canned, frozen, dried, sauces) and pantry items are not, and neither is `tomate`, because it is sold all year. Names are matched exactly, in lower case, against `ingredientes_principales`.
3. **A conflict is a person's decision.** When the function returns NULL the recipe keeps a season chosen by the owner, and the database accepts any valid value for it. The five active recipes in that case were pinned by id and slug (migration `20261027180000`), chosen by when the dish is wanted (hot, hearty dishes to autumn and winter), not only by when its ingredients are in season.
4. **The database enforces it with a trigger, not a CHECK.** `recipes_temporada_coherence` fires `BEFORE INSERT OR UPDATE OF temporada, ingredientes_principales, activo`. On **every** row that carries a season the shape must hold (non-empty list of the allowed values, no repeats, calendar order, `todo_el_ano` only on its own). On an **active** row the season must also be the computed one, and a missing season is refused. A draft may have no season at all. It rejects with SQLSTATE 23514 naming the recipe, the stored value and the expected one.
5. **A TypeScript twin and a parity test.** `tests/db/recipe-season-rules.ts` mirrors both SQL functions, and `tests/db/recipe-season-parity.test.ts` compares them over every recipe of the catalogue plus hand-written probes.
6. **`todo_el_ano` stays an explicit stored value for now.** The selector still reads it (1 point); storing nothing for an all-year recipe is a later change.

The invariant: **an active recipe's `temporada` always agrees with its ingredients, whoever wrote the row and through whichever path, except where the ingredients contradict each other and a person decided.**

## Consequences

- **Positive:** the season has a written rule instead of a guess. In a simulation of the real selector over the 538 active recipes, the pool of in-season recipes grew (autumn 71 to 198, winter 60 to 134, spring 36 to 63, summer 69 to 125) and 200 simulated users got more distinct recipes (autumn 65 to 141), so menus repeat less. A wrong season cannot reach production through a direct insert, an edit or a reactivation.
- **Negative / trade-offs:** the rule knows when an ingredient is in season, not when a dish is wanted. A stew with no seasonal ingredient stays `todo_el_ano` (129 comfort-food and 40 soup, cream or stew recipes were in that state) and a hot dish can still be served in July; that is FRESCO-1059. The table is maintained by hand. An ingredient missing from it, or spelled differently ("tomate pelado", "judía verde"), counts as not seasonal and drops out of the rule **silently**. Matching is by exact name, with no ingredient families. About 300 recipes changed value, which changes the menus users get.
- **Neutral / follow-ups:** every fixture that inserts an active recipe must now give it a `temporada` (`['todo_el_ano']` when no ingredient is seasonal). Any future catalogue generator must call `compute_recipe_temporada` before it writes an active row. The four migrations (`20261027170000`, `180000`, `190000`, `200000`) apply to the hosted database on the promotion to `main`, and the two barrier migrations refuse to install over rows that already break them.

## Alternatives considered

- **Let the model assign the season, as before.** Rejected: that is how 68 % of the catalogue ended up `todo_el_ano` with no rule behind it. The owner decided the season is calculated.
- **A `CHECK` constraint.** Rejected for the reason in ADR-0064: PostgreSQL evaluates every CHECK on every UPDATE of the row, and `recipes` is updated often (learning counters, photos, last-in-menu date). The trigger fires only when a column the rule reads is written.
- **Compute the season in the application only.** Rejected: a direct write to the database would skip it, and the catalogue is also edited outside the app.
- **Include `tomate` as a summer ingredient.** Rejected by the owner: it is sold all year, and it alone made 7 of 12 recipes conflict.
- **Decide the season by when the dish is wanted from the start (`es_comfort_food`, `es_contundente`).** Deferred, not rejected: it needs its own rule and impact report. Tracked as FRESCO-1059.
- **Store nothing for an all-year recipe.** Deferred: it changes the selector, the Zod schema, the seed and the tests.

## References

- FRESCO-1058 (this decision); FRESCO-1059 (when the dish is wanted, not only its ingredients).
- ADR-0064 (the same trigger-not-CHECK reasoning, for allergen and diet tags).
- Migrations `20261027170000_computed_recipe_seasons.sql`, `20261027180000_recipe_season_conflict_overrides.sql`, `20261027190000_recipe_season_barrier_trigger.sql`, `20261027200000_recipe_season_shape_all_rows.sql`.
- `tests/db/computed-recipe-seasons.test.ts`, `tests/db/recipe-season-barrier.test.ts`, `tests/db/recipe-season-parity.test.ts`, `tests/db/recipe-season-rules.ts`.
- `supabase/functions/generate-meal-plan/menu-selector.ts` (how the season is scored).
