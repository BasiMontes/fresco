# A8-SAFEA report (allergen and diet safety, FIRST HALF)

Axis SAFEA first half. Repo commit `71ab0864` (staging), date 2026-11-03. Read-only: only `SELECT` through `supabase db query --linked`; analysis scripts live in this scratchpad.

## 1. Scope and what I inspected

- Live query: `select id,created_at,updated_at,nombre,slug,dieta,alergenos,ingredientes_principales,pasos_resumen,activo from recipes where activo order by id` -> **658 active rows** (`recipes_active.json`). Extra columns `descripcion_corta`, `ingredientes_cantidades`, `ingredientes_que_puede_desagradar` -> `recipes_extra.json`.
- My half = rows 0..328 (ceil(658/2) = 329), ordered by `id` (uuid text order), first id `0009c6fb...`, last id of my half = row #328. Second half starts at row #329.
- Created in my half: 2026-07-23: 16, 2026-07-31: 63, 2026-08-01: 113, 2026-09-08: 82, **2026-10-29: 55** (FRESCO-953 insert). 260 of the 329 rows have `updated_at >= 2026-10-16`. Every row has non-empty steps.
- I READ in full (ingredients + steps + tags + flags): all 55 new rows, ~140 more named-dish rows (cheese/sauce/stock/fried/pasta/curry/seafood/meat/diet-flag candidates), plus every row hit by my own broad vocabulary scan (14 EU allergens, about 260 terms, wider than the repo table). The remaining ~130 rows are the generated plant/tamari/tofu/tempeh/wok/cream families whose only tags are mechanically derived; I checked them by script (oracle + broad scan + diet-breaker scans for halal/kosher/vegetariano/vegano/keto/paleo/fodmap) and read the hit rows, not every row by eye.
- Oracle test: `tests/db/recipe-allergen-diet-rules.ts` (rules), `recipe-allergen-diet-coherence.test.ts` (runner), `recipe-allergen-diet-known-gaps.ts` (ratchet), `scripts/check-hosted-recipe-tags.ts`. Live DB: trigger `recipes_tag_coherence BEFORE INSERT OR UPDATE OF alergenos, dieta, ingredientes_principales, pasos_resumen, activo` and CHECK `recipes_alergenos_vocab` (14 slugs).

### Oracle re-verification (A7-TEST-01)
- The oracle NO LONGER reads only `ingredientes_principales`. `sourcesOf()` returns ingredients AND `pasos_resumen`; vocabulary is the EU-14 (`mostaza`, `altramuces`, `sulfitos`, `apio` incl. `caldo`); it has reverse diet checks (halal, kosher, vegetariano/vegano, keto, paleo, bajo_fodmap, tamari/teriyaki, brand-dependent `caldo`, rennet parmesano/gruyere) and is mirrored in SQL by the `recipes_tag_coherence` trigger. `KNOWN_GAPS = {}` (empty ratchet).
- I ran the repo's `auditRecipeFindings` (bun, imported read-only) over the live 658 rows: **0 findings** (half 1: 0). So live data passes it.
- Residual blindness (relevant to findings below): the oracle and trigger read neither `nombre`, `descripcion_corta` nor `ingredientes_cantidades`; a step-only `caldo` is not checked against `sin_gluten` (only listed ingredient names are, `GLUTEN_BRAND_DEPENDENT`); "bebida vegetal" is unknown to the soy/nut vocabulary. When I extend the text to name + description + cantidades the oracle gives 53 hits over 658 rows; read by hand they are mostly false positives (tamari "sin gluten" in descriptions, "pasta de ají amarillo"), real signal only in the curry rows (A8-SAFEA-03).

### Counts per bucket, my half (recipes)
| Bucket | Confirmed from row text alone | Plausible / assumed product | New (created 2026-10-29) | Old |
|---|---|---|---|---|
| A allergen declaration or free-of claim wrong | 0 | 20 (1 HIGH, 19 MEDIUM) | 0 | 20 |
| B diet tags (paleo/keto/bajo_fodmap) | 0 | 0 reported (label opinions only, see section 4) | 0 | 0 |
| C religious/ethical flags | 0 | 20 LOW (vegetariano with non-listed-rennet cheeses) | 4 (#73, #96, #276, #290) | 16 |
| D incomplete list / tag without ingredient | 0 | 10 LOW/INFO | 0 | 10 |

The 55 new recipes (FRESCO-953) are clean for allergens and sin_* flags: I found no defect in any of them except the LOW rennet convention. Compare A7: 4 confirmed-from-text defects; in my half now 0.

## 2. Findings (sorted by severity)

### A8-SAFEA-01  HIGH  PLAUSIBLE  Ensalada cesar still declares sin_huevo with no huevo/pescado/mostaza
- Recipe: "Ensalada cesar", slug `ensalada-cesar-al-estilo-mediterraneo-con-guarnicion-de-temporada`, id `5a2b8324...`, created 2026-08-01, updated 2026-10-29.
- Evidence (live row): alergenos `["lactosa","gluten"]`; dieta true: `halal`, `sin_huevo`; ingredients `pechuga de pollo; lechuga romana; queso rallado; pan integral`; last step `"Añadir el pan integral tostado en dados y aliñar"`; description in the same row family names it a Caesar. Sibling row #15 "Ensalada César con pollo" (id `...` created 2026-07-31) tags `gluten,huevo,lactosa,pescado` for the step `"Añadir picatostes y aliño César"`, so the catalogue contradicts itself on what "aliño César" contains (egg yolk, anchovy, often mustard).
- Impact: egg-allergic (and fish-allergic) users with `sin_huevo` filter receive a Caesar salad whose dressing is, by the sibling row, egg+anchovy. Egg allergy is a tag comparison in `get_filtered_recipes`.
- Reproduction: `select nombre,alergenos,dieta->>'sin_huevo' from recipes where activo and nombre ilike 'ensalada c%sar%'`.
- Fix: make it consistent with the sibling: either list the dressing (`aliño césar casero: huevo, anchoa, mostaza`) and tag `huevo,pescado,mostaza` with `sin_huevo=false`, or write a dressing without egg/anchovy in the steps. Pin: a coherence-test case for names matching `cesar|cesar` (or extend the oracle to read `nombre` + `descripcion_corta`).
- Status vs audit 7: STILL-OPEN A7-SAFEA-22 (paleo removed, sin_huevo/pescado/huevo tags still wrong); sibling A7-SAFEA-23 (#15) FIXED.

### A8-SAFEA-02  MEDIUM  CONFIRMED (pattern)  sin_gluten=true on rice/stew recipes whose steps use a stock cube not listed as ingredient
- 10 recipes (all old; `updated_at` 2026-10-29 for several): #9 `alubias blancas con chorizo y pimentón` ("Añadir las alubias cocidas y el caldo"), #70 `Arroz con pollo` ("Cubrir con agua o caldo caliente"), #93 `Arroz negro con calamar`, #102 `Arroz con pollo y azafrán` ("el caldo con azafrán"), #142 `Estofado de ternera con boniato` ("cubrir con caldo"), #143 `Marmitako de bonito` ("Cubrir con caldo"), #274 `Paella valenciana`, #296 `Arroz negro con calamares`, #298 `Paella de marisco`, #307 `Arroz caldoso con pollo y verduras`.
- Evidence: all have `dieta.sin_gluten=true`, `apio` tagged (so someone read the stock), but the ingredient list has no stock name, so the FRESCO-1050/1051 rule (`GLUTEN_BRAND_DEPENDENT` checked "ingredient list only") never fires. Example #143: ingredients `bonito; patata; cebolla; pimiento verde; tomate; ajo; pimentón dulce`, step `"Cubrir con caldo"`, alergenos `["pescado","apio"]`, sin_gluten true.
- Impact: coeliac user gets a recipe that needs a bought stock (many stock cubes carry wheat). Capped MEDIUM: evidence rests on an assumed commercial product (A7 rule); the owner already accepted this judgement for listed stocks (2026-10-23).
- Fix: in `auditRecipeFindings`, apply `GLUTEN_BRAND_DEPENDENT` words also to steps for `sin_gluten=true` (or require "caldo de verduras/pollo sin gluten" wording), and mirror in the SQL trigger. Pin: unit cases in `recipe-allergen-diet-rules.unit.test.ts` for a step-only `caldo`.
- Status: NEW (sibling path of FRESCO-1050/1051 fix of A7-SAFEA-34/47).

### A8-SAFEA-03  MEDIUM  PLAUSIBLE  Curry dishes without curry in the text: no mostaza, claimed vegano/sin_gluten (green curry paste)
- #99 `Curry de leche de coco con semillas de calabaza`, #118 `Curry de leche de coco picante`, #136 `Tofu al curry verde con aceitunas`, #266 `Tofu al curry verde con lima`. Ingredients e.g. #136: `tofu; calabacín; leche de coco; aceitunas`; step `"Cocer en salsa el tofu junto con calabacín"`; descripcion_corta `"Tofu al curry verde con leche de coco y aceitunas, apta vegana, sin gluten, sin lácteos y keto."`; alergenos `["soja"]`; dieta vegano+sin_gluten true.
- Impact: the "curry" flavour must come from a bought paste/powder, normally with mustard seed (and shrimp paste in Thai green curry). Mustard-allergic users filtered on `mostaza` get them; vegano claim breaks if the paste has shrimp paste. The sibling #190 `Curry de garbanzos y espinacas` lists `curry en polvo` and tags `mostaza`, so the rule (A7-SAFEA-07) is applied only when the word is in ingredients/steps; name/description are not read.
- Fix: list the paste/powder as an ingredient (then the oracle tags `mostaza`) or read `nombre`/`descripcion_corta` in the oracle. Capped MEDIUM (assumed product).
- Status: NEW (name-only variant of A7-SAFEA-07/A7-SAFEB-09, which are FIXED where the word is in the text).

### A8-SAFEA-04  MEDIUM  PLAUSIBLE  "bebida vegetal" unspecified in vegano/sin_lactosa recipes (soy or nut drink possible)
- #158 `Avena con plátano y canela` (id `3ce5c126`, step "Cocer la avena con bebida vegetal", alergenos `["gluten"]`), #220 `Batido de cacao y avena` ("Triturar todos los ingredientes con bebida vegetal", `["gluten"]`), #270 `Porridge de avena con manzana` (`["frutos_de_cascara","gluten"]`). All vegano+sin_lactosa true.
- Impact: a soy-allergic user filtered on `soja` receives them; the drink may be soy. Compare #82, #316 which write `bebida de almendra` and tag `frutos_de_cascara`.
- Fix: name the drink (`bebida de avena`) so the tag is decidable, or tag `soja` conservatively. Capped MEDIUM.
- Status: NEW.

### A8-SAFEA-05  MEDIUM  PLAUSIBLE  Falafel con salsa de yogur: falafel with only chickpeas listed, sin_gluten and sin_huevo true, no sesamo
- #223, slug `falafel-con-salsa-de-yogur-b34`, id `546b260a`, created 2026-09-08, updated 2026-10-29. Ingredients `garbanzos; yogur; menta`; steps `"Formar y freír las bolitas de falafel" | "Preparar la salsa de yogur con menta"`; alergenos `["lactosa"]`; dieta true `sin_gluten, sin_huevo`.
- Impact: falafel is normally bound with flour (or egg) and often contains sesame; a sesame-, gluten- or egg-allergic user filtered on those tags gets it. Hummus rows were fixed this way (sesamo tagged) but falafel (a keyword not in the oracle) was not.
- Fix: list the real ingredients (`harina de garbanzo`, `comino`, `sésamo` if used) or remove `sin_gluten`/`sin_huevo`; add `falafel` to the sesamo/gluten vocabulary. Capped MEDIUM.
- Status: NEW (same family as A7-SAFEB-01 hummus, which is FIXED).

### A8-SAFEA-06  MEDIUM  PLAUSIBLE  Pad thai de gambas (b41): salsa unspecified, soja+gluten now tagged, but sin_huevo=true and no pescado
- #269, slug `pad-thai-de-gambas-b41`, id `64d0fc21`, updated 2026-10-17. Ingredients `fideos de arroz; gambas; cacahuetes`; steps `"Saltear las gambas" | "Añadir los fideos y la salsa" | "Terminar con cacahuetes picados"`; alergenos `["crustaceos","cacahuetes","soja","gluten"]`; dieta true `halal, sin_huevo, sin_lactosa`.
- Impact: tags show someone assumed a soy sauce but pad thai sauce commonly carries fish sauce and egg; an egg- or fish-allergic user is served. The A7 BLOCKER part (soy/gluten) is fixed; the HIGH-PLAUSIBLE residual (egg, fish) is not.
- Fix: list `salsa de pad thai` components or set `sin_huevo=false` and tag `pescado`. Capped MEDIUM.
- Status: STILL-OPEN residual of A7-SAFEA-33 (A7-SAFEA-32 and the soy/gluten part FIXED).

### A8-SAFEA-07  LOW  CONFIRMED (convention)  vegetariano=true on recipes with cheeses that are normally animal-rennet (feta, queso azul, mozzarella, generic queso)
- 20 recipes in my half, 4 of them new (#73 `Pizza margarita casera`, #96 `Tostada de pera y queso azul`, #276 `Pasta integral con calabacín y feta`, #290 `Quesadillas de calabacín y maíz`); the others old: #8, #57, #64, #110, #111, #123, #135, #160, #184, #202, #208, #227, #234, #264, #268, #320.
- The oracle's rennet rule lists only `parmesano|gruyere`, which A7-SAFEA-45 fixed (#51 and #306 no longer vegetariano: FIXED). Feta, queso azul, mozzarella tradition and unnamed `queso` are not covered. Ethical flag, no allergen; assumed product -> LOW. Fix: extend `RENNET_CHEESE`, or document that vegetariano means "lacto-ovo, rennet not considered".
- Status: NEW (extension of A7-SAFEA-45).

### A8-SAFEA-08  INFO  Bucket D: incomplete lists (no flag wrong from the text)
- 9 recipes list `caldo de verduras` in `ingredientes_principales` but not in `ingredientes_cantidades` (#17, #22, #51, #101, #205, #249, #271, #306, #327): `recipes_ingredientes_cantidades_valid` allows it; the shopping list then omits the stock. Not a safety defect.
- #156 `Albondigas en salsa` (id `3bfec4da`): `ternera picada; tomate; cebolla`, keto+paleo+sin_gluten+sin_huevo true; consistent with its text, but meatballs normally need a binder. INFO.
- #112 `Croquetas de bacalao`: sin_lactosa true without any dairy, gluten/huevo tagged (safe direction). Known A7-SAFEA-19 LOW, unchanged.

## 3. A7 findings re-verified (in my half)

| A7-ID | Verdict | Evidence |
|---|---|---|
| A7-SAFEA-01/02/46 (halal with mixed minced meat) | FIXED | #154 `Albóndigas en salsa española` has flags only `sin_lactosa`; #156 uses `ternera picada` |
| A7-SAFEA-08 (crepes sin_huevo) | FIXED | #184 tags `huevo`, flags `halal,kosher,vegetariano` |
| A7-SAFEA-11 (boquerones vinagre sulfitos) | FIXED | #294 tags `pescado,sulfitos` |
| A7-SAFEA-20/36 (kosher with wine) | FIXED | #191, #200, #188 carry no `kosher` |
| A7-SAFEA-22 (cesar sin_huevo) | STILL-OPEN | A8-SAFEA-01 |
| A7-SAFEA-23 (cesar con pollo) | FIXED | #15 tags `gluten,huevo,lactosa,pescado`, sin_huevo/sin_gluten absent |
| A7-SAFEA-24 (mayonesa mostaza/sulfitos) | FIXED | #321 tags `pescado,huevo,mostaza,sulfitos` |
| A7-SAFEA-25 (pasas sulfitos) | FIXED | #91 tags `sulfitos` |
| A7-SAFEA-32 (pad thai soy, gluten) | FIXED | #106 tags `soja,gluten`, sin_gluten absent |
| A7-SAFEA-33 (pad thai b41) | STILL-OPEN (residual) | A8-SAFEA-06 |
| A7-SAFEA-34/35 (stock without apio, unspecified veg stock) | FIXED | every recipe with `caldo` tags `apio`; vegetariano/vegano ones write `caldo de verduras` |
| A7-SAFEA-40 (cerveza sulfitos) | FIXED | #318 tags `gluten,sulfitos` |
| A7-SAFEA-42 (miso gluten) | FIXED | #291 tags `gluten,soja,sesamo`, sin_gluten absent |
| A7-SAFEA-45 (parmesan/gruyere vegetariano) | FIXED | #51, #306 not vegetariano |
| A7-SAFEA-47 (tamari sin_gluten) | FIXED (by wording) | ingredient is now `tamari sin gluten`; claim rests on that wording, not a verified product |
| A7-SAFEA-27 (moussaka) | not in my half | second half |
| A7-SAFEA-41 (ramen soja) | STILL-OPEN LOW | #323 `Ramen de pollo` alergenos `gluten,huevo,apio`, step "Servir con huevo marinado", no `soja` |
| A7-SAFEA-26 (empanada/masa sin_huevo) | STILL-OPEN LOW | #133, #292, #211, #13, #73 `masa` with sin_huevo true |
| A7-SAFEA-19 (croquetas) | STILL-OPEN LOW | #112 |
| A7-SAFEA-03..05,10,12..16,21,28,29,38,39,43,44 (paleo/keto/bajo_fodmap) | FIXED for the rows present | oracle clean; the original slugs no longer exist in my half |
| A7-TEST-01 | FIXED | oracle reads steps, EU-14, reverse diet checks, SQL trigger; live 0 findings (but see blind spots above) |

## 4. Checklist items that found NOTHING
- Hidden sub-recipes in the 55 new rows: none; every dough/bread/pasta/cheese carries its allergen.
- `sin_gluten=true` with tamari/teriyaki/soy sauce/beer/miso without "sin gluten": none.
- `halal=true` with pork, ham, chorizo, bacon, wine, beer, gelatin, lomo/salchicha/longaniza: none (broad list tested).
- `kosher=true` with pork/rabbit/shellfish/wine, or meat + dairy together: none (broad list tested).
- `vegano/vegetariano` with meat, fish, gelatin, anchovy, bare stock, honey (vegano): none.
- `sin_lactosa/sin_huevo` against milk, cream, butter, mayonnaise, alioli, batter: none.
- Allergen vocabulary slugs outside the 14: none (CHECK `recipes_alergenos_vocab`).
- Claims in `descripcion_corta` ("apta vegana, sin gluten, sin lácteos y keto") vs flags: 0 contradictions over the 85 rows with claims in my half.
- Bucket B (paleo/keto/bajo_fodmap): no row contradicts the oracle's definitions. Label opinions I did NOT report as findings (A7 already downgraded these to LOW): `bajo_fodmap` on avocado (~14 rows), butternut squash, red cabbage; `keto` on pumpkin soup. 
- `nombre` containing a double "con" etc.: not a safety item.

## 5. Could not verify
- Whether the bought products (stock cubes, tamari, curry paste, bebida vegetal, masa de empanada, queso azul rennet) really contain the allergen: no label data in the DB; findings A8-SAFEA-02..07 are capped accordingly.
- The 130 generated plant/tamari/tofu rows were checked by script and hit rows, not each read by eye.
- Second half (rows #329..#657) belongs to the other auditor. Quick note for them only, unverified: with name+description+cantidades included, the oracle's extra hits there are `Moussaka de berenjena` (#576 halal with unspecified minced meat), `Chile con carne` (#640 same), `Tofu al curry verde ...` (#412, #514, #565 and `Curry ... ` #457, #510, #589: same curry pattern as A8-SAFEA-03); `Muffin salado de espinacas` (#653) and `Pasta con garbanzos` (#487) look like false positives.
- No human sign-off exists (`revision-alergenos-2026-10-16.csv` unchanged, FRESCO-908), so "clean" here means "no contradiction found by my reading and scans", not a validated declaration.

## 6. secrets_materialized: none; cleaned: yes
(Only files written: JSON dumps of recipe rows and scripts under this scratchpad; no secrets involved.)
