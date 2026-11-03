# A8 SAFEB - allergen and diet safety of the live catalogue, SECOND HALF

Commit `71ab0864` (staging), date 2026-11-03. Auditor: SAFEB (second half). Read-only.

## 1. Scope and what I inspected

- Query (read-only): `select id, slug, nombre, created_at, updated_at, dieta, alergenos, ingredientes_principales, ingredientes_cantidades, pasos_resumen, descripcion_corta from recipes where activo order by id` through `supabase db query --linked`. Result: **658 active recipes**. Raw dump: `.../audit8/safeb-raw.json`.
- Second half = rows 330..658 (floor(658/2)+1..658) = **329 recipes**, sorted by uuid text (same order as Postgres uuid). Slice with display numbers: `.../audit8/safeb-half.json`.
- Age of the 329: created 2026-10-29 (FRESCO-953 batch) **65 NEW**; created 2026-09-08 91; 2026-08-01 103; 2026-07-31 51; 2026-07-23 19. `updated_at` is after 2026-10-16 for most rows (161 on 10-29, 63 on 10-27, ...): the A7 fix migrations rewrote tags.
- Method: (a) the repo oracle `tests/db/recipe-allergen-diet-rules.ts` (`auditRecipeFindings`, run from the scratchpad over all 658 live rows): **0 findings** (so the oracle's keyword table is satisfied by the live data); (b) my own wider lexicons (script `flag.py`, `flagdiet.py` in the audit8 folder) for all 14 allergens plus paleo/keto/bajo_fodmap/halal/kosher/vegetariano, 77 allergen candidates and 112 diet candidates, each READ by hand against ingredients, steps, name and description; (c) internal consistency (vocabulary, `vegano` implies `vegetariano`, `sin_*` against tag, `vegano` against dairy/egg/fish tags): 0 contradictions; (d) all 65 new recipes read in full (ingredients + steps + tags).
- IMPORTANT data note: the ingredient list the oracle and the A7 CSV use is `ingredientes_principales`. `ingredientes_cantidades` (quantities) is a separate column and differs in 10 of the 329 rows (see A8-SAFEB-05).

Counts for my half (329 recipes), per bucket (A allergen/claim wrong, B diet tags paleo/keto/fodmap, C religious / other diet flag, D incomplete):

| Bucket | NEW (65, created 10-29) | OLD (264) | Confirmed from row text | Assumed product only |
|---|---|---|---|---|
| A allergen / sin_* claim wrong | 0 | 0 confirmed; 16 stock-gluten (A8-SAFEB-03) + 6 green-curry (A8-SAFEB-02) as MEDIUM assumed-product | 0 | 22 |
| B paleo / keto / bajo_fodmap | 0 | 17 (13 avocado + 3 boniato + 1 more via 600 g boniato; LOW) | 0 (judgement on portion) | 17 |
| C religious / diet | 0 | 2 confirmed (monkfish kosher) + 1 assumed (teriyaki halal) | 2 | 1 |
| D incomplete | 0 | 10 (`ingredientes_cantidades` lacks the stock) | 10 | 0 |

No BLOCKER and no HIGH in this half. The 120-recipe batch of FRESCO-953 (65 of them in my half) is clean on every check I could run from the recipe text.

Is paleo/keto/bajo_fodmap still a user-facing claim? **Yes.** `lib/recipes/labels.ts:26-28` `DIETA_LABELS` has `bajo_fodmap: 'Bajo FODMAP'`, `keto: 'Keto'`, `paleo: 'Paleo'`, `halal: 'Halal'`, `kosher: 'Kosher'`. They render as tag pills (cards, detail: `components/recipes/recipe-detail.tsx:22-24`, `components/recipe/recipe-card.tsx`) and `components/recipes/recipe-library.tsx:28` builds the catalogue filter from `Object.keys(DIETA_LABELS)`, so Paleo, Bajo FODMAP and Kosher are selectable filters. Profile (preferences) diets are only vegetariano, vegano, sin_gluten, sin_lactosa, sin_huevo, keto, halal (`lib/constants/dietary-options.ts:76`), so only `keto` and `halal` reach the generator; the other labels are display/filter claims.

## 2. Findings (sorted by severity)

### A8-SAFEB-01 - MEDIUM - CONFIRMED - kosher=true on monkfish (rape), 2 recipes (bucket C, old)
- Evidence (live rows): `ad58b4a3-7a08-4837-b490-63d701e2e4ba` `rape-plancha-verduras` "Rape a la plancha con verduras", ingredients `rape; calabacín; pimiento`, dieta true includes `kosher`. `ead3a62f-2583-4b12-b83d-daa5cc790777` `pescado-blanco-papillote-limon` "Pescado blanco al papillote con limón" (description "Rape al papillote con limón y hierbas"), ingredients `rape; limón; aceite de oliva`, dieta true includes `kosher`.
- Impact: monkfish has no scales, so it is not kosher; the oracle's `NOT_KOSHER` list (`recipe-allergen-diet-rules.ts`) only has rabbit, pork and shellfish, so no test catches finned-but-non-kosher fish. Observant users filtering "Kosher" are shown a non-kosher fish. Not an allergen, no profile filter for kosher (cap MEDIUM).
- Reproduction: `select nombre, dieta->>'kosher' from recipes where activo and ingredientes_principales ? 'rape'`.
- Fix: set `kosher=false` on rows whose ingredients include rape, anguila, cazón, pez espada, tiburón, raya, caviar (rule in the oracle + the SQL mirror of migration `20261020110000_*` + a test); then re-run the tag-parity test.
- Status vs audit 7: NEW (not in A7 buckets).

### A8-SAFEB-02 - MEDIUM - PLAUSIBLE - green curry / "Curry de leche de coco" with no paste listed, vegano + sin_gluten claims (bucket A, old)
- Evidence: `Tofu al curry verde picante con jengibre` (#413), `Tofu al curry verde con cilantro fresco` (#515), `Tofu al curry verde con semillas de calabaza` (#566): ingredients `tofu; calabacín; leche de coco; ...`, steps "Cocer en salsa el tofu junto con calabacín" / "Añadir leche de coco ...", AL=`soja` only, dieta true `vegano vegetariano sin_gluten halal kosher bajo_fodmap`. Same shape for "Curry de leche de coco con lima / cilantro fresco / aceitunas" (#458, #511, #590, `keto` + vegano + sin_gluten). A Thai green curry paste normally contains shrimp paste (crustaceos) and often garlic/onion (breaks `bajo_fodmap`). The recipe text states no paste.
- Impact: PLAUSIBLE; depends on what the cook adds, the row never lists it. Sibling of A7-SAFEB-11 (unchanged).
- Fix: either list "pasta de curry verde vegana (sin gamba)" as an ingredient (then the existing rules for `crustaceos` can apply) or drop `vegano`/`bajo_fodmap` on the six rows.
- Status vs audit 7: STILL-OPEN A7-SAFEB-11.

### A8-SAFEB-03 - MEDIUM - PLAUSIBLE - sin_gluten=true on recipes cooked with a stock that is not in the ingredient list or is a vegetable stock cube (bucket A, old)
- Evidence: step-only bare "caldo" with `sin_gluten=true` and `apio` tagged: `Marmitako de bonito` (#389), `Guiso de ternera con patatas` (#452), `Merluza en salsa verde` (#460, step "Añadir la merluza y un poco de caldo"), `Ternera en salsa con guisantes` (#558), `Garbanzos con chorizo y verduras` (#585), `Pochas con codornices` (#587), `Arroz con pollo tradicional` (#601). Listed `caldo de verduras` with `sin_gluten=true`: `Sopa juliana` (#364), `Crema de espinacas y queso` (#484), `Crema de puerros y patata` (#487), `Crema de calabacín` (#512), `Crema de calabaza y jengibre` (#518), `Crema de zanahoria con jengibre` (#521), `Sopa de calabaza con jengibre` (#617), `Potaje de garbanzos con calabaza` (#622), and `Risotto de setas` (#474).
- Why the oracle is blind: `GLUTEN_BRAND_DEPENDENT` lists `caldo`, `caldo de carne`, `caldo de pollo` but only checks `ingredientes_principales` (FRESCO-1050/1051 design), so step-only stock and `caldo de verduras` pass. The `apio` tag was fixed (A7-SAFEA-34 holds), only the gluten claim is left.
- Impact: coeliac user trusts "Sin gluten" on a recipe made with a stock cube that may carry wheat. Evidence rests on an assumed commercial product, cap MEDIUM (A7 rule).
- Fix: extend the brand-dependent rule to `caldo de verduras` and to a bare "caldo" in steps (or require "caldo sin gluten" in the text, as was done for tamari), with a parity test.
- Status vs audit 7: STILL-OPEN (residual of A7-SAFEA-34 / FRESCO-1050).

### A8-SAFEB-04 - LOW - PLAUSIBLE - halal=true and kosher=true on "Pollo teriyaki con arroz" (bucket C, old)
- Evidence: `8f2dab96-f4b6-4b99-ac4d-e6104b9cd97f` `pollo-teriyaki-con-arroz-b60`, ingredients `pollo; salsa teriyaki; arroz`, AL `soja, gluten`, dieta true `halal kosher sin_huevo sin_lactosa`. Teriyaki is traditionally made with mirin/sake (alcohol). `NOT_HALAL` has no mirin/teriyaki. Row does not state an alcohol-free sauce.
- Fix: drop halal (and kosher unless certified) from teriyaki rows, or require "teriyaki sin alcohol".
- Status vs audit 7: STILL-OPEN (A7 bucket C listed teriyaki).

### A8-SAFEB-05 - LOW - CONFIRMED - `ingredientes_cantidades` omits "caldo de verduras" in 10 rows (bucket D, old)
- Evidence: comparing the two columns for my half: 10 rows whose `ingredientes_principales` has `caldo de verduras` and `ingredientes_cantidades` does not: `Crema de setas con miso`, `Sopa juliana`, `Sopa miso con tofu`, `Risotto de setas`, `Crema de espinacas y queso`, `Crema de puerros y patata`, `Crema de calabacín`, `Crema de zanahoria con jengibre`, and two more with the same pattern. The A7 `apio` fix added the stock to `ingredientes_principales` only.
- Impact: any consumer of the quantities (scaling, shopping list) loses the stock, the allergen source. I could not confirm which feature reads `ingredientes_cantidades` (the repo grep timed out), so the user impact is PLAUSIBLE. The allergen tag itself is right.
- Fix: add `{nombre:'caldo de verduras', cantidad:..., unidad:'ml'}` to those rows and add a test "every name in principales has a quantity row".
- Status vs audit 7: NEW (side effect of the A7 fix).

### A8-SAFEB-06 - LOW - PLAUSIBLE - bajo_fodmap=true on whole avocado and large sweet-potato portions (bucket B, old)
- Evidence: avocado, 1 whole unit (high in sorbitol at that serving): `Aguacate relleno de cilantro y lima ...` (#333), `Ensalada de semillas de girasol con cilantro` (#387), `Rúcula con semillas de girasol y limón` (#398), `Crema fría de aguacate y pepino` (2 units, #477), `Ensalada de aceitunas con limón` (2 units, #528), `Bol de semillas de calabaza con lima/limón/lino/jengibre` (#503, #542, #549, #640), `Crema fría de lima con cilantro` (#592), `Ensalada de aceitunas` (#608), `Poke bowl de atún` (#355). Boniato: `Boniato asado con canela` 600 g (#472), `Bowl de pollo con boniato` (#359), `Boniato asado con canela y nueces` (#575). The oracle's `FODMAP_BREAKERS` has neither aguacate nor boniato.
- Impact: IBS users filtering "Bajo FODMAP". Label only (no profile filter). Judgement on portion size, hence LOW / PLAUSIBLE.
- Fix: add aguacate (>1/8 unit) and boniato to the FODMAP rule, or drop the flag from those rows.
- Status vs audit 7: NEW (A7 mushrooms/leek were fixed, see section 3).

### A8-SAFEB-07 - INFO - paleo=true with wine (10 rows) and vegetariano=true with unspecified-rennet cheese
- paleo with wine: `Pollo al chilindrón`, `Estofado de ternera con champiñones`, `Mejillones al vapor`, `Rabo de toro estofado` (x2), `Conejo al ajillo`, `Lomo de cerdo en salsa`, `Ternera guisada`, `Carne guisada con patatas`, `Pollo guisado con champiñones` (vino blanco/tinto in ingredients). The owner's oracle deliberately leaves wine out of `PALEO_BREAKERS`; strict paleo excludes alcohol. Report only, no fix demanded.
- vegetariano=true with generic `queso`, `queso rallado`, `queso feta`, `mozzarella`, `ricotta`, `pesto` (about 25 rows in the half, e.g. `Pasta con calabaza y nueces`, `Calzone de espinacas y ricotta`, `Ensalada de pasta con pesto`): animal rennet cannot be excluded; the oracle only polices parmesano/gruyère. Already known as A7 bucket C; nothing newly wrong.

## 3. A7 findings re-verified (second-half recipes only; slice B of A7 was the CSV's lines 271-539, different cut, so I matched by recipe)

| A7-ID | verdict | evidence |
|---|---|---|
| A7-SAFEB-01 hummus without sesamo | FIXED | `Tostada con hummus y pepino` (#411) AL=`gluten, sesamo`; `Buddha bowl con hummus`, `Wrap de pollo con hummus` tagged `sesamo` |
| A7-SAFEB-02 miso without gluten | FIXED | all four miso rows in my half (`Crema de setas con miso`, `Sopa miso con tofu`, `Sopa de miso con edamame`, `Sopa miso con tofu y algas`) AL include `gluten`, `sin_gluten` false |
| A7-SAFEB-03..07, 14 paleo on bread/cheese/legumes | FIXED (in my half) | oracle 0 findings; paleo-true recipes carry no gluten/lactosa/soja/cacahuetes tag |
| A7-SAFEB-08 tarta de limón, egg | FIXED | `Tarta de limón` (#602) AL `gluten, lactosa, huevo`, `sin_huevo` absent; "crema de limón" now an ingredient |
| A7-SAFEB-09 curry mostaza | FIXED | `Coliflor al horno con curry`, `Pollo al curry con coco`, `Arroz al curry con coliflor`, `Curry de garbanzos`, `Bocaditos de pollo al curry` all AL `mostaza` |
| A7-SAFEB-10 stock without apio | FIXED (tag) / STILL-OPEN (gluten claim, A8-SAFEB-03) | 31 recipes carry `apio`; stock-only rows tagged |
| A7-SAFEB-11 green curry paste | STILL-OPEN | A8-SAFEB-02 |
| A7-SAFEB-12 miso/dashi on vegano | FIXED | `caldo de verduras` is now listed; miso rows tagged |
| A7-SAFEB-13 tamari as gluten-free | FIXED | all tamari rows in my half now read "tamari sin gluten" (text-backed claim) |
| A7-SAFEB-15 keto on wheat/quinoa | FIXED (in my half) | keto-true rows: no cereal, tortilla, legume; oracle clean; manual scan of 119 keto rows found only low-carb ingredients |
| A7-SAFEB-16/17 mushroom / leek bajo_fodmap | FIXED (in my half) | no mushroom or puerro recipe has `bajo_fodmap` |
| A7-SAFEB-18 sushi rice sulfitos | FIXED | `Sushi bowl de salmón` AL `pescado, sulfitos` |
| A7-SAFEB-19 nachos | N/A in my half | `Guacamole con nachos` is not in rows 330..658 |

## 4. Checklist items that found NOTHING (my half)

- Missing tag for any of the 14 allergens against ingredients, steps, name and description, with a wider lexicon than the oracle (cheese names without "queso", yema/clara, alioli, tortilla, tempura, pesto, cacahuete/satay, tahini/gomasio, salsa de ostras/pescado, mejillón singular, mirepoix, vinegar family, dried fruit, olives): every hit was a false positive or an assumed-product case (table olives, chorizo, ham: not reported).
- 65 new recipes (FRESCO-953): read in full, no allergen, vegano/vegetariano, halal, kosher, keto, paleo or fodmap mismatch from the text.
- `sin_huevo` / `sin_lactosa` / `sin_gluten` true against its own allergen tag: none. `vegano` with lactosa/huevo/pescado/crustaceos/moluscos tag: none. `vegetariano` with fish tag: none. Tag outside the 14-slug vocabulary: none. Dieta keys missing: none. Empty ingredient list: none.
- Halal with pork/alcohol/unnamed mince: none (costillas, conejo, chorizo, jamón rows are halal=false). Kosher with shellfish, pork or meat+dairy: none (except A8-SAFEB-01 fish).
- `bebida de almendras` exemption in the oracle (almond drink not tagged `frutos_de_cascara`): no live row uses it.
- Name-only hidden sources (albóndigas, croquetas, tarta de espinacas, lasaña sheets, focaccia/pizza "masa") with `sin_huevo`/`vegano`: no egg stated in text; plausible only, not reported (`Albóndigas en salsa de tomate`, `Lasaña de verduras`, `Tarta de espinacas y queso`).

## 5. Could not verify and why

- Real composition of stock cubes, teriyaki, curry paste, chorizo, jamón cocido, table olives, commercial pesto: the catalogue does not specify the product.
- Who consumes `ingredientes_cantidades` (shopping list, scaling): my `rg` over the repo timed out; A8-SAFEB-05 impact is therefore PLAUSIBLE.
- The first half (rows 1..329) belongs to another auditor.
- Human sign-off CSV (FRESCO-908) was not re-read; I did not check whether it is still empty.

## 6.
secrets_materialized: none
cleaned: yes (only files in the audit8 scratchpad were written: the raw JSON dump of public catalogue rows, helper scripts, this report)
