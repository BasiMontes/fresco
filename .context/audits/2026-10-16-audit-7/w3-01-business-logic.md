# Audit 7 - Axis LOGIC (core business logic)

- Axis code: LOGIC
- Commit: staging `1feb6062` (code identical to main `278d56fd`)
- Date: 2026-10-16
- Mode: read-only code review + scratchpad probes (bun) importing repo modules

## 1. Scope and what was inspected

- Read end to end: `supabase/functions/generate-meal-plan/{index,menu-selector}.ts`, `generate-shopping-list/{index,consolidator,recipe-quantities,remaining-days}.ts`, `aisle-pricing.ts` (pricing part), `_shared/normalize.ts`, `lib/date/iso-week.ts`, `components/calendar/use-slot-marking.ts`, relevant parts of `update-recipe-status/index.ts`, `calendar-grid.tsx`, `onboarding-step-diet.tsx`, `lib/api/{recipes,open-slots,shopping-list}.ts`, `add-to-menu-dialog.tsx`, `notifications/page.tsx`, migration `20261013160000_create_meal_plan_transactional.sql`.
- Live function bodies (pg_get_functiondef, SELECT only): `update_recipe_learning`, `protect_meal_plan_recipes_integrity`, `get_recent_recipe_marks`, `get_user_recipe_engagement`, `get_user_cooked_recipe_ids`, `assign_recipe_to_slot`, `get_filtered_recipes`, `get_catalog`; triggers on `meal_plan_recipes`.
- ~14 read-only `supabase db query --linked` SELECTs (unit distribution of `ingredientes_cantidades`, price/unit mismatches, accent search counts, rating counts, profile constraints, pool sizes, `to_date` ISO-week validation).
- 3 probes run with bun in `scratchpad/audit7/probes/` (`shop.ts`, `week.ts`, `menu.ts`) importing repo modules; no repo file edited. No HTTP requests to production.

## 2. Findings

### A7-LOGIC-01 - Shopping-list prices ignore the unit: a 500 g yogur line costs 175 EUR, a 150 g lettuce 135 EUR, 4 tomatoes 0,01 EUR
- Severity: HIGH. Confidence: CONFIRMED (probe run against the repo modules + live catalog counts).
- Evidence:
  - `supabase/functions/generate-shopping-list/aisle-pricing.ts:246-279`: `PRICE_OVERRIDE` is keyed by ingredient only and silently assumes one unit per ingredient: `lechuga: 0.9`, `yogur: 0.35`, `pan: 0.12`, `zanahoria: 0.15`, `cebolla: 0.3` (per unit / slice) but `tomate: 0.003`, `patata: 0.0025` (per gram). `:347-348` `precioUnitario = PRICE_OVERRIDE[nombre] ?? PRICE_PER_UNIT_TYPE[unidad]` - the override wins whatever `unidad` the line carries; `:357-360` `precioItem` only corrects kg/l.
  - Since FRESCO-875/ADR-0042 the line unit comes from the recipe (`consolidator.ts:273-296` `cantidadDeReceta`: "The recipe's own quantity wins"), so the unit is no longer the one the override was written for.
  - Live catalog (SELECT on `recipes.ingredientes_cantidades`, activo): `lechuga` in `g` in 11 recipes, `pan` in `g` in 8, `yogur` in `g` in 6, `zanahoria` in `g` in 2 (all over-priced x100-x1000); `tomate` in `unidades` in 68 recipes, `patata` in `unidades` in 1 (priced as grams, ~0).
  - Probe `scratchpad/audit7/probes/shop.ts` (calls `consolidateIngredientes` + `classifyShoppingList`): `Lechuga 150 g = 135EUR`, `Yogur 500 g = 175EUR`, `Pan 200 g = 24EUR`, `Zanahoria 500 g = 75EUR`, `Tomate 4 unidades = 0.01EUR`.
- Impact: ~27 of 538 active recipes carry a mispriced line; with 21 slots most weekly lists will include one, so the "coste estimado" a household sees (and `coste_estimado_min/max` stored on `shopping_lists`, which feeds the weekly cost snapshot / spend trend) can be inflated by 100-200 EUR or, for tomato-heavy weeks, undercounted. For a budget-sold product this destroys trust in the number.
- Reproduction: `bun scratchpad/audit7/probes/shop.ts` (pure functions, no DB). In app: generate a week containing a recipe with `{"nombre":"Yogur","cantidad":500,"unidad":"g"}` and open the list.
- Fix: key overrides by `(ingrediente, unidad)` (or store the override's unit and convert / fall back to `PRICE_PER_UNIT_TYPE[unidad]` when the line unit differs). Test: table test in `aisle-pricing.test.ts` - for every override key, a line in each unit the catalog uses yields a price within a sane per-line bound (e.g. < 15 EUR for <= 1 kg); plus a DB-integration check that every (name, unit) pair in `recipes.ingredientes_cantidades` has a priced path.

### A7-LOGIC-02 - Same ingredient listed twice when recipes use different units; spoon-to-gram conversion inflates herbs x5-x10
- Severity: MEDIUM. Confidence: CONFIRMED.
- Evidence:
  - `consolidator.ts:239-251` `canSumUnits` only merges within `g/kg`, `ml/l`, or identical units; `:371-381` a second unit opens a new group. Live catalog: `tomate` uses `g` (17 recipes) and `unidades` (68); `zanahoria`, `patata`, `calabacín`, `pan`, `manzana`, `lechuga`, `pepino` likewise mix `g` and `unidades`; `pan` also has base `rebanadas` (`:152`) for recipes without quantity.
  - Probe: `Tomate 400 g` + `Tomate 2 unidades` -> two separate lines (`Tomate 400 g = 1.2EUR ; Tomate 2 unidades = 0.01EUR`).
  - `consolidator.ts:262,285-288`: 1 cucharada = 15 g for ANY ingredient whose base is `g`. Live: `cilantro` (45 recipe rows), `perejil`, `albahaca` use `cucharadas`; probe `Cilantro 2 cucharadas -> 30 g` (a tablespoon of chopped fresh herb is ~2-4 g).
- Impact: the user sees "Tomate 400 g" and "Tomate 2 unidades" as separate items in the same aisle and must add them up; herb quantities are 5-10x too high (overbuying, and price inflated accordingly).
- Reproduction: probe above; in app, a week with "tomate" in grams in one recipe and in units in another.
- Fix: a per-ingredient unit-to-grams table (e.g. tomate 1 ud = 150 g, zanahoria 1 ud = 80 g, herbs 1 cda = 3 g) used to bring every line of a key to one canonical unit before summing. Test: consolidator test with the same name in `g` and `unidades` yields exactly one line.

### A7-LOGIC-03 - Weekly budget warning ignores household size: a family of 4 is warned only when one person's cost exceeds the whole budget
- Severity: MEDIUM. Confidence: CONFIRMED (code read; spec quoted).
- Evidence:
  - Spec `.context/SRS/functional-requirements.md:56`: "sum of each selected recipe's `coste_estimado` bucket (`muy_bajo` < 2EUR/person, `bajo` 2-4EUR, `medio` 4-7EUR, `alto` > 7EUR) across all 21 slots, implicitly scaled by household size. Compared against `presupuesto_semana_euros`."
  - `supabase/functions/generate-meal-plan/menu-selector.ts:36-41` midpoints `muy_bajo: 1.5, bajo: 3, medio: 5, alto: 8`; `:246-271` `totalEuros += midpoint` per slot and `if (totalEuros > profile.presupuesto_semana_euros)` - `profile.num_personas` is never read in the file (`rg num_personas menu-selector.ts` = 0 hits).
- Impact: for any household > 1 person the over-budget advertencia under-reports by a factor of `num_personas` (4 people, 21 `medio` slots: real ~420 EUR, compared as 105 EUR), so a family with a 150 EUR budget is never warned. The same plan's shopping list (scaled by `num_personas`) then shows a different, larger figure, so the two cost numbers the user sees contradict each other.
- Reproduction: unit test: `selectMenu` with `num_personas: 4`, `presupuesto_semana_euros: 150`, 21 `medio` candidates -> no "supera tu presupuesto" advertencia (expected one, 420 > 150).
- Fix: `totalEuros += midpoint * profile.num_personas` (and skip `excluida` slots, already done). Test: the case above, plus `num_personas: 1` unchanged.

### A7-LOGIC-04 - Calendar marks "today" on the same weekday of every week, in the browser's timezone
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: `components/calendar/calendar-grid.tsx:197` `const isToday = dia === JS_WEEKDAY_TO_DIA[new Date().getDay()];` - no comparison with the displayed week (`semana_iso` / `fecha_inicio`) and local-time `getDay()` instead of the Madrid frame used everywhere else (`lib/date/madrid-date.ts`, FRESCO-899).
- Impact: browsing next week or a past week (week navigation, history) still highlights e.g. Thursday as "today"; a user outside Spain (or a device on another TZ) sees the wrong day around midnight. Cosmetic but misleading on the main screen.
- Reproduction: open `/calendar`, navigate to next week: today's weekday is still highlighted.
- Fix: compute `hoyEnMadrid()` and highlight only when `fecha_inicio + index(dia) === hoy`. Test: render grid for next week's `fecha_inicio` -> no element with the today class.

### A7-LOGIC-05 - Season scoring uses the server's current month, not the planned week
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: `menu-selector.ts:65-71` `getCurrentSeason()` reads `new Date().getMonth()` (UTC, generation time); `:157` used for every slot. The plan's `fecha_inicio` is available in `index.ts:65` but not passed.
- Impact: a week generated ahead across a season boundary (e.g. generated 30 Nov for the week of 7 Dec, or generated late Sunday for next week at month change) is scored with the previous season's recipes. Also breaks the FRESCO-380 "same user + same week = same menu" determinism promise when regenerating the same week on either side of a boundary.
- Reproduction: unit: `selectMenu` with fake timers set to 2026-11-30 vs 2026-12-01 for the same seed and week -> different menus.
- Fix: pass `fecha_inicio` into `selectMenu` and derive the season from it (Madrid date). Test: same seed/week, different "now" -> identical menu.

### A7-LOGIC-06 - Catalog search is accent-sensitive: "salmon", "platano", "brocoli" find (almost) nothing
- Severity: MEDIUM. Confidence: CONFIRMED (live SELECT).
- Evidence:
  - Live `get_catalog` body: `r.nombre ilike '%' || v_search || '%'` and the same on `ingredientes_principales`; no `unaccent`/normalization (extension `unaccent` not installed: `select count(*) from pg_extension where extname='unaccent'` = 0). Client `lib/api/recipes.ts:183` sends `p_search: params.search` unchanged.
  - Live counts on active recipes (`nombre ilike ...`): `salmon` 1 vs `salmón` 12; `platano` 0 vs `plátano` 5; `brocoli` 0 vs `brócoli` 3; `champinon` 1 vs `champiñ` 24.
  - `%` and `_` in the search are not escaped, so a search of `_` or `%` returns the whole catalog (harmless, self-only).
- Impact: Spanish users routinely type without tildes on mobile; the catalog answers "no results" (or 1 of 12) for the most common ingredients, which reads as an empty catalog.
- Reproduction: `/recipes`, search `salmon` -> 1 result; `salmón` -> 12. Or the SELECTs above.
- Fix: compare `unaccent(lower(x)) like '%' || unaccent(lower(escaped_search)) || '%'` (install `unaccent`, wrap in an immutable function for an index), escape `\ % _`. Test: DB-integration test `get_catalog(p_search => 'salmon')` returns the same set as `'salmón'`.

### A7-LOGIC-07 - Shopping list is frozen at first generation: later substitutions, discards and recipe changes never reach it, and there is no way to rebuild it
- Severity: MEDIUM. Confidence: CONFIRMED (code read).
- Evidence:
  - `supabase/functions/generate-shopping-list/index.ts:56-62` answers 409 when a list exists for the plan; no code path in `lib/`, `components/` or `app/` deletes or regenerates a `shopping_lists` row (`rg shopping_lists` -> only read/toggle/add/remove item helpers in `lib/api/shopping-list.ts:47-169`).
  - `:82-86` reads slots without filtering `estado`, so a slot already `descartada` at generation time still contributes its ingredients.
  - Only one flow tells the user: `components/recipes/add-to-menu-dialog.tsx:202-204` "Tu lista de la compra ya estaba generada y no incluye este cambio." The ingredient-substitution flow (`components/recipes/ingredient-list.tsx:63` `confirmSubstitution(...)`) and the recipe replacement flow (`update-recipe-status` `sustituida`) say nothing, although `index.ts:107-114` shows substitutions are meant to change the list.
  - Landing FAQ promises editing: `components/landing/faq-data.ts:23` "Puedes cambiar cualquier receta con un toque y regenerar solo ese slot sin tocar el resto."
- Impact: a user who swaps "nata" for a substitute (or replaces a recipe) after generating the list still buys the original ingredient and misses the new one; the list silently disagrees with the menu for the rest of the week.
- Reproduction: generate menu, generate list, substitute an ingredient in a slot from the recipe page, reopen `/shopping-list`: the original ingredient is still listed, the substitute is not.
- Fix: on substitution/replacement/assign, either rebuild the list server-side preserving `comprado` flags and user-added items (merge by normalized name), or mark the list stale and offer "Actualizar lista". Skip `descartada`/`excluida` slots when building. Test: integration test - substitution after list creation changes the list (or sets a stale flag).

### A7-LOGIC-08 - Onboarding asks "¿Algo más que debamos saber?" under diet and restrictions, then ignores the answer (and the free-text dislikes)
- Severity: MEDIUM. Confidence: CONFIRMED (code read; live counts).
- Evidence:
  - `components/onboarding/onboarding-step-diet.tsx:112-120` input `dieta_texto_libre_input`, placeholder "¿Algo más que debamos saber?", aria-label "Dieta y restricciones — texto libre"; `:174-182` "¿Algún otro ingrediente que no te guste?" (`ingredientes_odiados_texto_libre`).
  - The values are only persisted (`lib/onboarding/saved-profile.ts:51,96`, migration `20260809130000_add_texto_libre_to_user_profiles.sql` "Free-text note ..."). The live `get_filtered_recipes` (the only menu/catalog filter) reads `alergenos`, the 7 `dieta_*` booleans and `ingredientes_odiados` only; `menu-selector.ts` reads none of the `*_texto_libre` columns. No UI copy says the note is not applied.
  - Live: 0 of 4 profiles have text in these fields today (no user harmed yet).
- Impact: a user who writes "celíaca", "no como cerdo", "alergia al kiwi" or "nada de cilantro" in the box that asks for restrictions gets a menu that ignores it, believing it was taken into account. For a restriction that is medical this is a food-safety trust failure.
- Reproduction: onboarding, write "sin cerdo" in the diet note without ticking chips, generate: pork recipes appear.
- Fix: either map free text to filters (at least: match `ingredientes_odiados_texto_libre` tokens against `ingredientes_principales` in `get_filtered_recipes`) or relabel both inputs as a note "que todavía no usamos para filtrar el menú" and point medical restrictions to the chips. Test: e2e - a free-text dislike that matches a catalog ingredient never appears in the generated menu (or the copy assertion).

### A7-LOGIC-09 - Pro history exclusion has no fallback and reports a false allergy dead end
- Severity: LOW. Confidence: CONFIRMED in code (probe), PLAUSIBLE in production (needs a small pool).
- Evidence: `menu-selector.ts:149-155` `pool = candidates.filter(r => !excluded.has(r.id))` and `byTipo` is built from that pool; `:187-201` when `basePool.length === 0` the advertencia is the safety one: "No hay ninguna receta de ${tipo} compatible con tus alergias y tu dieta...". Probe `scratchpad/audit7/probes/menu.ts`: all breakfasts in `recentRecipeIds` -> every breakfast slot empty with that allergy message. Live pool sizes are large (desayuno: 120 total, 34 vegano+sin gluten), so it needs a restrictive profile plus many marks in 2 weeks.
- Impact: a paying user with a narrow profile who diligently marks meals gets empty slots and is told their allergies leave no recipes, which is false (Free would get a full week).
- Reproduction: unit, as in the probe.
- Fix: when the history-filtered pool for a tipo is empty (or smaller than needed), fall back to the unfiltered `candidates` for that tipo; compute the "no compatible recipe" message from `candidates`, not from the history-filtered pool. Test: the probe case returns filled breakfasts and no allergy advertencia.

### A7-LOGIC-10 - The rating signal is dead: no UI sends a rating, and a rating can never be added after "cocinada"
- Severity: LOW. Confidence: CONFIRMED (code + live counts).
- Evidence: the only caller `components/calendar/use-slot-marking.ts:54-56` sends `{ meal_plan_recipe_id, estado }` (no `rating`); `supabase/functions/update-recipe-status/index.ts:29,78-81` rejects any later patch of a `cocinada` slot ("No se puede cambiar el estado..."), and the live trigger `update_recipe_learning()` returns early `if old.estado = new.estado`, so a rating alone would not count either. Live: `meal_plan_recipes` 0 rated of 252 (4 cocinada); `recipes` 0 of 538 active with `rating_promedio`/`veces_calificada > 0`.
- Impact: the heaviest term of the menu score, `rating_promedio * 2` (`menu-selector.ts:123`), is 0 for every recipe forever; the "learning" is only cook/discard counts. Not a defect users see, but the product logic and ADR-0006/0008 assume a rating input that does not exist.
- Reproduction: SELECTs above.
- Fix: decide: add a rating step to the "cocinada" mark (same request) or remove the rating path and its weight. Test: e2e marking cocinada with rating updates `veces_calificada`.

## 3. Checklist items that found NOTHING (or only already-known)

1. Menu generation: no off-by-one in days/slots (7x3 loops over fixed `DIAS`/`TIPOS`); `planning_selection` honored exactly (unselected -> `excluida`, no advertencia); plan + 21 slots written atomically by `create_meal_plan` (FRESCO-913), which also validates the ISO label and that `fecha_inicio` is its Monday (live `to_date('2027-W53',...)` round-trips to `2028-W01` and is rejected; `2026-W53` -> 2026-12-28 accepted). No regenerate path (409 by design). Empty pool never relaxes allergens: only the time filter is relaxed, with an advertencia; allergens are SQL-side (`get_filtered_recipes`, fail-closed when no profile). Replacement paths re-filter: `assign_recipe_to_slot` calls `get_filtered_recipes(auth.uid(), p_recipe_id)`, `update-recipe-status` `sustituida` re-filters (A4-H1). `copy_meal_plan_to_week` skipping the filter: already known (A7-AUTHZ-01). Scoring: no division, `null` rating/`veces_cocinada` coerce to 0, no NaN path found; ties broken by seeded jitter. Pro vs Free gate correct (`isProEntitlementActive`). Note (INFO, not a finding): the jitter is drawn per candidate in array order, so adding one recipe to the catalog reshuffles every tie-break (probe: reversed candidate order -> different menu); FRESCO-380 determinism holds only for a frozen catalog. Rate limit consumed before body validation: already known (A7-API-05). Malformed `planning_selection` values (`{"lunes":5}`) throw -> 500: self-only via direct profile write, covered by A7-API wave.
2. Shopping list: no wrong merges from normalization (`pimiento rojo`/`verde`, `leche`/`leche de coco`, `tomate cherry`/`tomates cherry` stay distinct - probe); `raciones_receta` 0/NaN skipped (A4-M5); `num_personas` clamped 1..10 (DB CHECK 1..10 too); `pizca`/`al gusto` fall back to base quantity; kg/l display ok (`1005+250+333 g` -> `1.588 kg`); 'Otros' aisle fallback present; past days excluded in Madrid frame; concurrent double generation -> 409 (FRESCO-852). Per-row `Math.ceil` overbuys fractional units (7 x 0.5 lemon scaled 0.5 -> 7 lemons instead of 2): minor, folded into A7-LOGIC-02's fix. User-added items/checked state vs regeneration: moot, the list can never be regenerated (A7-LOGIC-07).
3. Learning loop: per-slot double counting is blocked by the terminal-state guard (`cocinada`/`descartada` cannot be re-patched) and the guarded UPDATE; cross-plan inflation and global manipulation already known (A7-AUTHZ-02). Counters only increment (cannot go negative). Swaps/assign set `app.skip_recipe_learning`. `rating_promedio` rounding to 2 decimals with denominator fix (A4): correct, but unused (A7-LOGIC-10). Free marks feed global counters only; personal nudge Pro-only by design (ADR-0008).
4. Onboarding/profile: household size bounded (DB CHECK 1..10, `adultos <= num_personas`), `planning_selection` default full week, NOT NULL. Free-text fields ignored (A7-LOGIC-08). Step 3 unreachable: already known (FRESCO-856). `reassign_guest_data` re-filters target allergens (A4, read via AUTHZ wave). Re-onboarding does not touch existing plans (profile UPDATE only; no trigger on `user_profiles` rewrites plans) - existing week keeps recipes chosen under the old profile; not verified end to end.
5. Catalog: offset pagination stable (`order by id`, unique); accents broken (A7-LOGIC-06); no relevance ranking (INFO). Recommendations (FRESCO-405): `getLatestAvailableRecipes` reads `get_filtered_recipes` (safe set) ordered by `created_at desc` - favorites not excluded, per decision A; nothing found.
6. Dates/numbers: ISO-week helpers correct for 2000-2040 roundtrip in `Europe/Madrid` and `America/Los_Angeles` (probe, 0 mismatches), week 53 and year change correct, DST days 2026-10-25 / 2027-03-28 and 2028-02-29 map correctly; server-side "today" uses Madrid (`hoyEnMadrid`, `assign_recipe_to_slot` uses `now() at time zone 'Europe/Madrid'`). Exceptions: A7-LOGIC-04 (calendar today mark), A7-LOGIC-05 (season). Money: floats rounded to cents at display/storage; no locale-parsing path found in the core logic.
7. Probes: `probes/shop.ts`, `probes/week.ts`, `probes/menu.ts`; failing inputs reported in A7-LOGIC-01/02/03/09.

## 4. Could not verify

- No end-to-end run on fresco-pre (budget): the stale-list, budget and free-text findings are proven from code + pure-function probes, not from a live session.
- Whether any existing production shopping list already carries a mispriced line: the 5 most recent lists have no line > 15 EUR; their plans may predate ADR-0042 quantities or not contain the affected recipes.
- Re-onboarding effect on an already generated plan was read, not exercised.
- `supabase/functions/generate-shopping-list/aisle-pricing.ts` aisle map (lines 1-240) not reviewed line by line.

## 5. Secrets

secrets_materialized: none
cleaned: yes
