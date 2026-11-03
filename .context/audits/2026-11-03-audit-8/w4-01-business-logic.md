# Audit 8 - Axis LOGIC

- Commit: staging 71ab0864
- Date: 2026-11-03

## 2. Findings

### A8-LOGIC-01 - Fresh seafood/meat priced as a tinned or whole-piece pack: "Mejillones al vapor" 1 kg shows 29 EUR (estimate 4 EUR), 300 g of bacalao shows 34,51 EUR
- Severity: MEDIUM. Confidence: CONFIRMED (pure functions run over the live catalog, no DB write).
- Evidence:
  - `lib/grocery/ingredient-dictionary.ts:117` `"mejillones": ... "envaseVenta":{"cantidad":111,"unidad":"g"} ... "origenEnvase":"mercadona"`; `lib/grocery/mercadona-catalog.generated.ts:65` links it to `.../mejillones-natural-hacendado-pequenos-15-20-piezas-lata` (a 111 g TIN, 26,087 EUR/kg). Consum entry (`consum-catalog.generated.ts:73`) is "mejillones-en-escabeche". Same for `bonito` (222 g tin, line 28) and `anchoas` (tin).
  - `lib/grocery/mercadona-catalog.generated.ts:25` `bacalao` = `{"cantidad":2510,"unidad":"g"}` at 13,75 EUR/kg (a whole piece) while the recipes ask 300-400 g.
  - `lib/grocery/line-price.ts:23-28` `precioLinea` = whole-pack price x `envasesEstimados` (`map-item.ts:158` `packCount`), overriding the Edge estimate whenever a product is linked.
  - Throwaway run `scratchpad/audit8/map_all.ts` (imports `buildRawIngredientes`+`consolidateIngredientes`+`classifyShoppingList`+`mapShoppingListItem`+`precioLinea` on all 538 live active recipes, 2 people): `mejillones 1 kg -> packs 10, line 29 EUR (est 4)`, `mejillones 400 g -> 11,6 EUR (est 1,6)`, `bacalao 300 g -> 34,51 EUR (est 4,5)`, `bacalao 400 g -> 34,51`, `anchoas 30 g -> 6,5 EUR (est 0,18)`, `bonito 300 g -> 9,74 EUR (est 1,8)`. 9 lines of 1284 linked lines exceed 3x the estimate by more than 2 EUR; plus the 54 "line > 12 EUR or > 4x estimate" lines are oil (3,9 EUR for 15 ml, whole bottle by ADR-0036 design) and whole-pack fish.
- Impact: a household that opens "Mejillones al vapor" (or Sopa de merluza y mejillones, Paella de marisco, Zarzuela, 4 recipes) sees 8-29 EUR for an item that costs ~3 EUR/kg fresh; the link they are sent to buys 10 tins of mussels. FRESCO-846 matcher guarantees "plausible pack vs portion" only up to MAX_RATIO 20, which a 2,5 kg whole cod (ratio 16) passes.
- Reproduction: `bun scratchpad/audit8/map_all.ts scratchpad/audit8/price_out.json` (inputs from `price_all.ts`).
- Fix: in the dictionary, mark fresh vs tinned (`mejillones` fresh has no Mercadona/Consum product -> no link, fall back to estimate) and lower the pack ratio for pieces sold whole (bacalao: do not link a pack > 5x the portion); `product-plausibility.ts` should reject `lata/conserva/escabeche/natural` products when the recipe unit is >= 250 g. Test: `product-plausibility.test.ts` case "mejillones 1 kg never links a 111 g tin" and a catalog test that every linked pack <= 5x porcionReceta.
- Status vs audit 7: NEW (A7-LOGIC-01 covered the Edge estimate, not the linked-product price).

### A8-LOGIC-02 - Generic 0,80 EUR/unit fallback still mis-prices piece-counted items (A7-LOGIC-01 class survives in the fallback)
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: `supabase/functions/generate-shopping-list/aisle-pricing.ts:327-328` `PRICE_PER_UNIT_TYPE.unidades: 0.8`, used by `:399` for every ingredient without an override. Run over all live recipes at 2 people: `tomates cherry 12 unidades = 9,6 EUR` (24 units at 4 people = 19,2 EUR; a punnet is ~2 EUR), `clara de huevo 8 = 6,4`, `papel de arroz 8 = 6,4`, `tortilla de maiz 8 = 6,4` (a pack ~1,5 EUR), `anchoas 8 = 6,4`; in the other direction `dorada 2 = 1,6`, `codornices 2 = 1,6`. The same fallback prices `limon`, `lima`, `aguacate`, `pimiento` (43-57 recipe rows) at 0,8 each.
- Impact: weekly `coste_estimado_min/max` (stored on `shopping_lists`, feeds spend trend) drifts by a few EUR per list; no line passes 20 EUR at 2 people. Cosmetic-to-trust.
- Fix: add PRICE_OVERRIDE rows for the ~8 names above, and a catalog-wide test (`aisle-pricing.test.ts`) that every (name, unit) pair of `catalog-units.fixture.ts` has a per-line price within a bound, so the fallback cannot hide a new outlier.
- Status vs audit 7: NEW (residue of A7-LOGIC-01, whose listed cases are fixed).

### A8-LOGIC-03 - Per-row `Math.ceil` before summing still overbuys fractional pieces (7 recipes with half a lemon list 7 lemons)
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: `consolidator.ts` (`consolidateIngredientes`): `toBaseUnit(Math.ceil(cantidadBase * factor), unidadBase)` rounds EACH recipe row up before the groups are added. Probe `scratchpad/audit8/fuzz.ts`: 7 rows `Limón 0,5 unidades` (4 servings, 2 people => 0,25 each) -> `Limón 7 unidades 5.6EUR` (need 2). Live: 102 rows of `unidades/dientes/latas/rebanadas` fall below 1 after scaling to 2 people, in 75 of 538 recipes; the cost estimate inflates with them.
- Impact: over-buying and a higher estimate for ingredients that repeat across the week (lemon, garlic, lime, egg); A7 noted it and said it would be "folded into A7-LOGIC-02's fix"; it was not.
- Fix: sum the unrounded scaled quantity per group and `Math.ceil` once at the end (keep the float epsilon already used in `desdeGramos`). Test: the 7 x 0,5 lemon case => 2.
- Status vs audit 7: STILL-OPEN (noted in A7 section 3 item 2, never ticketed).

### A8-LOGIC-04 - Onboarding generates the first menu for the PREVIOUS ISO week during the first 1-2 hours of Monday (Madrid)
- Severity: LOW. Confidence: CONFIRMED (pure function run).
- Evidence: `components/onboarding/use-generate-meal-plan.ts:53-55` `const now = new Date(); const semanaIso = getIsoWeek(now); const fechaInicio = getIsoWeekMonday(now);`. Passing an explicit `Date` keeps the UTC frame (`lib/date/iso-week.ts:65-70`, header FRESCO-899: only the NO-argument calls resolve "today" in Madrid). Run `scratchpad/audit8/wk.ts` with `now = 2026-11-01T23:30:00Z` (Monday 00:30 in Madrid): `hoyEnMadrid = 2026-11-02`, onboarding week `2026-W44` / `2026-10-26`, the rest of the app's current week `2026-W45`.
- Impact: a user who finishes onboarding between 00:00 and 01:00 (winter) or 02:00 (summer) on a Monday gets a plan for the week that just ended: every slot is already past, so `/calendar` (current week) shows no menu and the first-run "generar" button reappears. Narrow window, but it is the first-run experience and the FRESCO-899 fix missed this sibling path.
- Reproduction: set the device clock (or `vi/bun` fake timers) to Sunday 23:30 UTC and run the onboarding generate.
- Fix: call `getIsoWeek()` / `getIsoWeekMonday()` with no argument (Madrid frame). Test: fake timers at `2026-11-01T23:30:00Z` => `semana_iso` `2026-W45` in the request.
- Status vs audit 7: NEW (sibling of the FRESCO-899 fix).

### A8-LOGIC-05 - "Usar este menú" turns the source plan's EXCLUDED slots into empty "Sin receta" slots
- Severity: LOW. Confidence: CONFIRMED (live function body + UI string).
- Evidence: live `copy_meal_plan_to_week` (pg_get_functiondef): the slot copy is `insert into meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato, estado) select v_new_id, case when mpr.recipe_id = any (v_allowed) then mpr.recipe_id else null end, mpr.dia, mpr.tipo_plato, 'pendiente' from ... where mpr.meal_plan_id = p_source_meal_plan_id` - every copied slot gets the literal `'pendiente'`, including those whose source estado is `excluida` (recipe_id null). Live: 98 of 399 `meal_plan_recipes` rows are `excluida` + `recipe_id null`. `components/calendar/slot-content.tsx:45-46` renders `estado === 'excluida'` as "Excluida por ti" and any other null-recipe slot as "Sin receta".
- Impact: a user who plans only lunches and dinners and reuses a past week gets 7 (or more) "Sin receta" breakfast slots that look like a failed generation and count as open slots, instead of staying excluded; they have to exclude them by hand.
- Reproduction: DB-level (not run, would write): copy a plan with `excluida` slots, read the target slots. Pure from the function text.
- Fix: copy `estado` as `case when mpr.estado = 'excluida' then 'excluida' else 'pendiente' end`. Test: extend `tests/db/copy-meal-plan-filters.test.ts` - a source with an `excluida` slot yields an `excluida` slot.
- Status vs audit 7: NEW.

### A8-LOGIC-06 - Three different weekly cost numbers: the shopping-list "Total estimado" is 1.5-2x the sum of its own lines
- Severity: MEDIUM. Confidence: CONFIRMED (numbers computed with the repo modules over the live catalog; the weeks are random 21-slot draws at 2 people, not real user plans).
- Evidence:
  - `components/shopping-list/shopping-list-summary.tsx:30-34` prints `costeMenu` (`formatPrecio(costeMenu)`) as "Total estimado del menú de esta semana"; `costeMenu` comes from `costeSemanalEstimado` -> `lib/grocery/estimate-menu-cost.ts:184` `estimateMenuCost`, which re-derives quantities from the DICTIONARY `porcionReceta` (`:152-153` `base.cantidad * factor`) and prices whole packs, for all 21 slots, ignoring recipe quantities (ADR-0042), past days, discarded slots and substitutions.
  - The rows above it are priced by `precioLinea` (whole pack of the linked product, else `precio_estimado` from the Edge Function, which uses the recipe's own quantities and only remaining days).
  - `scratchpad/audit8/cmp.ts` (8 random weeks, 2 people), per week: Edge stored range / sum of row prices / header total: `76.94-104.10 / 155.99 / 226.73`, `84.92-114.89 / 173.08 / 252.56`, `73.62-99.60 / 133.88 / 216.97`, `63.05-85.30 / 150.69 / 216.19`, `67.20-90.91 / 135.90 / 204.94`, `71.25-96.40 / 116.74 / 214.16`, `63.48-85.88 / 139.89 / 212.16`, `67.48-91.30 / 109.01 / 169.04`.
  - Also persisted: `shopping_lists.coste_estimado_min/max` (first column) is the third figure and is what the stored list carries.
- Impact: the household reads "Total estimado 217 EUR" above rows that add up to ~134 EUR (and a stored range of 74-100 EUR); mid-week the gap widens because the rows drop past days and the header does not. For a budget product the headline number cannot be reconciled with the lines. The menu-generation budget warning (`menu-selector.ts`, bucket midpoints x people) is a fourth basis.
- Reproduction: `bun scratchpad/audit8/cmp.ts scratchpad/audit8/a8_logic_recipes.json`.
- Fix: one function: header = sum of `precioLinea` over the rows actually displayed (or relabel the header "Coste de la semana completa" and show the list subtotal separately), and `estimateMenuCost` should read the recipe quantities through the same `buildRawIngredientes`/`consolidateIngredientes` path. Test: a property test that the header equals the sum of the displayed row prices for a fixture plan.
- Status vs audit 7: NEW (A7-LOGIC-03 / FRESCO-792 unified the label, not the arithmetic).

### A8-LOGIC-07 - Pro history exclusion falls back only when a tipo is EMPTY, not when it is merely too small (A7-LOGIC-09 half-fixed)
- Severity: LOW. Confidence: CONFIRMED in code (probe), PLAUSIBLE in production (needs a narrow profile plus many marks in 2 weeks).
- Evidence: `menu-selector.ts:202-205` `const basePool = historyPool.length > 0 ? historyPool : allPool`. Probe `scratchpad/audit8/sel.ts`: 10 safe `comida` candidates, 7 marked cocinada in the last 2 weeks => `comida` = `[c8,c7,c9,SIN_RECETA_SEGURA x4]` with the advertencia "Se agotaron las recetas de comida distintas para llenar la semana sin repetir plato; algún día se ha quedado sin comida asignado." although 7 safe, unused comidas exist in `allPool`.
- Impact: a diligent Pro user with a restrictive profile gets 4 empty lunches a week, the exact failure the FRESCO-1012 fix wanted to prevent (the allergy message is gone, the empty slots are not).
- Fix: build the day's pool as `historyPool.filter(notRepeated)`; if that is empty (not only when `historyPool` is empty), use `allPool.filter(notRepeated)`. Test: the probe case fills 7 comidas.
- Status vs audit 7: STILL-OPEN A7-LOGIC-09 (partial).

### A8-LOGIC-08 - Menu generated mid-week spends its best picks and the budget on days that are already over
- Severity: LOW. Confidence: CONFIRMED (code).
- Evidence: `generate-meal-plan/index.ts:216-231` writes all 21 slots and `selectMenu` (`menu-selector.ts:182-262`) iterates Monday to Sunday with no notion of "today" (`SelectMenuParams` has no date of today); FRESCO-807 only makes the SHOPPING LIST skip past days (`remaining-days.ts` header: "The menu keeps the full week"). Greedy order means Monday-Thursday get first pick of the pool on a Friday generation, lunch/dinner no-repeat consumes recipes there, and the budget warning (`:266-299`) sums the past days too.
- Impact: a user who generates on Friday (FRESCO-807's own scenario) gets four days of unusable recipes first, fewer distinct recipes left for the 3 days that count, and an over-budget warning that includes meals that cannot be cooked. Past slots cannot be reassigned (`assign_recipe_to_slot` refuses "slot is in a past day").
- Fix: mark past days (Madrid) as `excluida` in `create_meal_plan` slots for the current week, or iterate remaining days first. Test: selector with `hoy = viernes` leaves Monday-Thursday untouched and budget counts Friday-Sunday only.
- Status vs audit 7: NEW.

(Findings above are numbered in discovery order: MEDIUM = 01, 06; LOW = 02, 03, 04, 05, 07, 08. No BLOCKER/HIGH.)

## 1. Scope and what was inspected
- Code read: `generate-meal-plan/{index,menu-selector,entitlement}.ts`, `generate-shopping-list/{index,consolidator,unit-conversions,merge-refresh,raw-ingredientes,remaining-days}.ts`, pricing part of `aisle-pricing.ts`, `lib/grocery/{map-item,line-price,estimate-menu-cost,weekly-cost,supermarket/matcher}.ts`, `lib/date/{iso-week,madrid-date}.ts`, `components/calendar/calendar-grid.tsx` (today mark), `components/onboarding/use-generate-meal-plan.ts`, `components/historial/reuse-menu-button.tsx`, `components/shopping-list/shopping-list-summary.tsx`.
- Live function bodies (SELECT): `get_catalog`, `copy_meal_plan_to_week`, `assign_recipe_to_slot`, `update_recipe_learning`; 5 SELECTs (unaccent extension, slot estado counts, fraction counts, recipes export).
- Throwaway scripts (bun, no network, no DB writes) in the audit8 scratchpad: `fuzz.ts`, `price_all.ts` + `map_all.ts` (all 538 active recipes x 1/2/4 people = 7956 priced lines), `cmp.ts`, `wk.ts`, `sel.ts`. Tool calls: ~52.

## 3. A7 findings re-verified
| A7-ID | verdict | evidence |
|---|---|---|
| A7-LOGIC-01 | FIXED (listed cases) + residue | `fuzz.ts`: `Yogur 500 g -> 4 unidades 1.4EUR`, `Lechuga 150 g -> 1 unidad 0.9`, `Pan 200 g -> 4 rebanadas 0.48`, `Patata 3 unidades -> 300 g 0.75`. Full-catalog run: only 15 lines > 12 EUR at 2-4 people, all genuine meat/fish. Residue: generic 0,8 fallback = A8-LOGIC-02; linked-product price = A8-LOGIC-01 |
| A7-LOGIC-02 | FIXED | `Tomate 400 g + 2 unidades -> one line 350 g` (2 people), `Cilantro 2 cucharadas -> 3 g` (`unit-conversions.ts` PIEZAS / GRAMOS_POR_CUCHARADA). Per-row ceil residue = A8-LOGIC-03 |
| A7-LOGIC-03 | FIXED | `menu-selector.ts:270,284` `midpoint * personas`, fallback 1 for invalid |
| A7-LOGIC-04 | FIXED | `calendar-grid.tsx:127,219` `diaHoy` = day whose date (`sumarDias(mondayIso,i)`) equals Madrid today |
| A7-LOGIC-05 | FIXED | `seasonOf(fechaInicio)` (`menu-selector.ts:72`), `index.ts:172` |
| A7-LOGIC-06 | FIXED | live `get_catalog` uses `public.f_unaccent(...) ilike v_pattern` with `\ % _` escaped; `unaccent` extension count = 1 |
| A7-LOGIC-07 | FIXED | `index.ts` `refresh` path, `mergeRefreshedList` (keeps `comprado`, user suggestions), `desactualizada_desde` cleared; `raw-ingredientes.ts` skips `descartada`/`excluida` |
| A7-LOGIC-08 | FIXED (copy) | no filter was added; `aviso` notes (`tests/steps/aviso-alergenos.steps.ts:27` `dieta_texto_libre_aviso`, `ingredientes_odiados_texto_libre_aviso`) now say the text is not applied |
| A7-LOGIC-09 | STILL-OPEN (partial) | A8-LOGIC-07 |
| A7-LOGIC-10 | FIXED | rating term removed from `scoreRecipe` (ADR-0063, `menu-selector.ts:132-134`) |

## 4. Checklist items that found NOTHING
- ISO week / DST / week 53 / year boundary: `iso-week.ts` unchanged logic, all callers except onboarding use the Madrid frame; `copy_meal_plan_to_week` and `create_meal_plan` validate the ISO label with `to_date(...,'IYYY-"W"IW')`; copy only to current/next week (FRESCO-1012).
- Division by zero / NaN: `raciones_receta <= 0` skipped, `num_personas` clamped 1..10, `precioLinea` guards non-finite; empty menu cost = 0.
- Learning counters: terminal-state transition guard + `recipe_user_feedback` once per (user, recipe); counters only increase.
- Past-day filter in the shopping list uses Madrid (`remaining-days.ts`); `assign_recipe_to_slot` uses Madrid too and re-filters allergens and tipo.
- Concurrent list generation: unique `unique_plan_lista` + 23505 -> 409. Refresh by two tabs is last-write-wins on `items` (only `comprado` ticks of the loser are lost); not worth a finding.
- Search with accents, wildcards: fixed (above). Free vs Pro gate: `isProEntitlementActive` unchanged (payments axis owns it).
- Edge: `filtrarDiasVigentes` returns past slots when every future slot is discarded/excluded (list shows already-past days); intended per its comment, not reported.

## 5. Could not verify
- No live session on fresco-pre (everything proven from code, pure-function runs over the live catalog and SELECTs); real user plans/lists were not read, so the A8-LOGIC-06 magnitudes come from random 21-slot draws.
- UI rendering of the A8-LOGIC-05 "Sin receta" outcome is read from `slot-content.tsx`, the copy itself was not executed (would write).
- `aisle-pricing.ts` aisle map (lines 1-240) and the consum catalog prices were not checked line by line. Shared scratchpad note: another auditor overwrote `recipes.json`; my data is in `a8_logic_recipes.json`.

## 6. Secrets
secrets_materialized: none
cleaned: yes (only throwaway scripts and catalog exports in the audit8 scratchpad; no credentials used)
