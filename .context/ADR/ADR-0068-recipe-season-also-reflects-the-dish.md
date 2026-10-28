# ADR-0068 — A recipe's season also reflects when the dish is wanted: stews, soups and legume dishes go to autumn and winter

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-28
- **Deciders:** Basi Montes (rule, category scope and the five exceptions agreed in conversation on 2026-10-28, FRESCO-1059); drafted by an AI session
- **Tags:** catalogue, database, integrity, menu-generation
- **Supersedes:** — (extends ADR-0067, which it leaves in force)
- **Superseded by:** —

---

## Context

ADR-0067 made a recipe's season a computed value: the seasons shared by all its seasonal ingredients, `todo_el_ano` when none is seasonal. It named its own gap: the rule knows when an ingredient is in season, not when a dish is wanted, so a stew with no seasonal ingredient stayed `todo_el_ano` and the menu selector (`menu-selector.ts`: 3 points for the planned season, 1 for `todo_el_ano`) could serve it in July. FRESCO-1059 closes that gap.

The first idea was to use the recipe's own classification flags, `es_comfort_food` and `es_contundente`. A read-only report on the hosted catalogue on 2026-10-28 killed it. Of the 237 active recipes that were `todo_el_ano`, the flag rule (comfort or hearty, and not light) would have moved 108, and most were not cold-weather dishes: 14 pastries, 7 sandwiches, 7 egg dishes, 5 toasts, a poke bowl and a wrap. The flags were assigned by the model that wrote each recipe, and `contundente` means filling, not wanted when it is cold. Among the 14 recipes whose ingredients already put them in spring and summer, the same flags matched waffles, muesli, yoghurt with granola and blueberry muffins.

What does separate the dishes the ticket describes is the category. `guiso`, `sopa` and `legumbres` that are not light are the spoon dishes. Applying that to the 26 recipes it matched, the owner reviewed them one by one and removed five: a lentil burger and three miso soups (eaten all year) and the salmorejo (cold, so summer, not winter).

## Decision

1. **The dish rule sits on top of the ingredient rule and never overrides it.** The function `compute_recipe_season(ingredientes, slug, clasificacion)` starts from `compute_recipe_temporada`. A season that comes from the ingredients is kept (gazpacho and the cold creams stay in summer), and a conflict between ingredients still returns NULL, a person's decision (ADR-0067, point 3).
2. **Only a recipe with no seasonal ingredient is decided by the dish.** For it, in this order: a per-slug exception, else `['otono', 'invierno']` when `clasificacion.categoria` is `guiso` or `sopa`, or `legumbres` and not `es_ligero`, else `['todo_el_ano']`. The flags `es_comfort_food` and `es_contundente` do not take part.
3. **Exceptions are data.** The table `recipe_season_exceptions (slug, temporadas, motivo)` holds them, closed to `anon` and `authenticated` like `ingredient_seasons`, with the shape of `temporadas` checked by the existing `recipe_temporada_shape_problem`. It starts with five rows: `salmorejo-cordobes-b115` to `['verano']`; `hamburguesa-de-lentejas-y-zanahoria-b48`, `sopa-miso-con-edamame`, `sopa-miso-con-tofu-b47` and `sopa-miso-tofu-algas` to `['todo_el_ano']`. An exception is keyed by slug and has no effect on a recipe whose season comes from its ingredients.
4. **The barrier uses the new function.** `recipe_temporada_problem` takes the slug and the classification (both optional, so a call with only the season and the ingredients still means "ingredients only"). The trigger `recipes_temporada_coherence` passes them and also fires when `slug` or `clasificacion` is written, so reclassifying a recipe cannot leave it with a season that no longer fits.
5. **Backfill, all rows.** Every row whose answer differs from what is stored is updated, as in FRESCO-1058: 21 active recipes to autumn and winter, the salmorejo to summer and six inactive variants of stewed lentils to autumn and winter. The migration refuses to install over an active recipe that would still be incoherent.
6. **Out of scope, proposed by the AI session and approved by the owner on 2026-10-28:** rice, pasta, meat and fish stay as they are (each recipe there is a separate call: a creamy rice with rabbit, yes; a fried rice, no), and a summer rule (gazpacho and salads) because the available signals do not mark it. Both can come later with their own report.

The invariant, now: **an active recipe's `temporada` agrees with its ingredients and, when it has no seasonal ingredient, with its dish type, whoever wrote the row, except where the ingredients contradict each other and a person decided.**

## Consequences

- **Positive:** a stew, a soup or a lentil dish is no longer served in July for lack of a seasonal ingredient. The rule is one line the owner can read and the 26 recipes it matched were reviewed by name. The database enforces it for every writer, and the SQL and TypeScript copies are compared on the whole catalogue (`recipe-season-parity.test.ts`).
- **Negative / trade-offs:** the rule is a list of three category names written inside a SQL function; adding a category is a new migration. Recipes outside those categories that are in fact winter dishes (a beef stew filed as `carne`, a caldoso rice) stay `todo_el_ano` until someone decides them. The category comes from the model that wrote the recipe, so a recipe filed under the wrong category gets the wrong season (the exceptions table is the way to correct a single case). Menus change: 22 recipes leave the all-year pool, so their weight in the selector rises in autumn and winter and falls in spring and summer.
- **Neutral / follow-ups:** every fixture that inserts an active `guiso`, `sopa` or non-light `legumbres` recipe must give it `['otono', 'invierno']` (or, with a seasonal ingredient, the season of its ingredients). A catalogue generator must call `compute_recipe_season`, no longer `compute_recipe_temporada`, before it writes an active row. `supabase/seed.sql` already carries the 28 changed seasons and needs no regeneration for this change. The weekly `seed-drift` check compares only the set of recipe ids (it ignores columns such as `temporada`) and fails past 25 ids of difference; on 2026-10-28 the seed held 6 ids that production no longer has (1173 against 1167) and the last three scheduled runs were green.

## Alternatives considered

- **Use `es_comfort_food` and `es_contundente`, with the 6 conflicts fixed by hand (the owner's first choice, 2026-10-28).** Rejected after the report above: it moved 108 recipes of which most were not cold-weather dishes, and would have made toasts, eggs and pastries unavailable in spring and summer.
- **A category rule with the exceptions written inside the function.** Rejected: five slugs in SQL text are hard to read and to change; a table keeps each one with its reason.
- **Fix the five exceptions as person-pinned seasons, the way ADR-0067 pins its five conflicts.** Not possible here: the barrier requires an active recipe's season to equal the computed one whenever the computation gives an answer, so a pinned value would be refused. The exception has to live in the computation.
- **Add rice, pasta and meat to the rule.** Deferred: it moves recipes that are not clearly winter dishes. Needs its own report.

## References

- FRESCO-1059 (this decision); FRESCO-1058 and ADR-0067 (the ingredient rule it extends); ADR-0064 (the same trigger-not-CHECK reasoning).
- Migrations `20261028082818_recipe_season_dish_rule_scaffold.sql` (table, exceptions, `compute_recipe_season`) and `20261028090603_recipe_season_dish_rule_wiring.sql` (barrier, backfill).
- `tests/db/recipe-dish-season.test.ts`, `tests/db/recipe-season-exceptions.test.ts`, `tests/db/recipe-season-parity.test.ts`, `tests/db/recipe-season-rules.ts`.
