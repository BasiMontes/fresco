# Audit 7 - axis SAFEB (allergen and dietary data correctness), slice B

Commit: 1feb6062 (staging). Date: 2026-10-16.
Data: `.context/audits/revision-alergenos-2026-10-16.csv`, file lines 271-539 (269 recipes).
Oracle: `tests/db/recipe-allergen-diet-rules.ts`.

## Findings

| ID | slug | problem | severity | evidence |
|---|---|---|---|---|
| A7-SAFEB-01 | tostada-hummus-pepino (L335) | Hummus contains tahini (sesame paste); `sesamo` not tagged, so a sesame-allergic user is served it | BLOCKER (CONFIRMED from row) | `alergenos="gluten"`; `ingredientes="pan integral (2 unidades); hummus (60 g); pepino (0.5 unidades)"` |
| A7-SAFEB-02 | sopa-miso-tofu-algas (L272) | Generic `miso` tagged soja only and `sin_gluten=true`, while the sibling recipe sopa-miso-con-tofu-b47 (L271) with the same `miso` is tagged `soja gluten` and `sin_gluten=false`. Most miso sold in Spain (mugi/awase) contains barley; the catalogue contradicts itself | BLOCKER (PLAUSIBLE: depends on miso type, which the row does not state) | L272 `alergenos="soja"`, dieta_true includes `sin_gluten`; L271 `alergenos="soja gluten"`, dieta_false includes `sin_gluten`; both `miso (… cucharadas)` |
| A7-SAFEB-03 | sopa-miso-tofu-algas (L272) | `paleo=true` and `keto=true` on a soy (tofu+miso) soup; paleo excludes legumes/soy | MEDIUM | dieta_true `bajo_fodmap halal keto kosher paleo sin_gluten …`; ingredients `miso; tofu (150 g); algas` |
| A7-SAFEB-04 | tostada-con-jamon-serrano-con-frutos-rojos (L336) | `paleo=true` on bread (gluten-tagged) | MEDIUM | `alergenos="gluten"`; dieta_true `paleo sin_huevo sin_lactosa`; `pan integral (8 unidades)` |
| A7-SAFEB-05 | tostada-con-queso-fresco-con-especias-con-frutos-rojos (L337) | `paleo=true` with bread and cheese | MEDIUM | dieta_true `halal kosher paleo sin_huevo vegetariano`; `pan integral (4 unidades); queso fresco (200 g)` |
| A7-SAFEB-06 | tortitas-con-especias-con-canela (L331) | `paleo=true` on wheat pancakes tagged gluten+huevo+lactosa | MEDIUM | `alergenos="gluten huevo lactosa"`; dieta_true `halal kosher paleo vegetariano`; `tortitas (8 unidades); miel` |
| A7-SAFEB-07 | tortilla-francesa-estilo-casero-con-canela (L328) | `paleo=true` with cheese (lactosa tagged). Name says "con canela" but no cinnamon in the list | LOW | `alergenos="huevo lactosa"`; dieta_true `halal keto kosher paleo sin_gluten vegetariano`; `huevo (8 unidades); queso rallado (60 g)` |
| A7-SAFEB-08 | tarta-de-limon-b145 (L276) | Steps use a "crema de limón" that is NOT in the ingredient list; a lemon cream/curd is made with egg. `huevo` untagged and `sin_huevo=true` | BLOCKER (PLAUSIBLE: the hidden sub-recipe is not specified) | CSV `alergenos="gluten lactosa"`, dieta_true `halal kosher sin_huevo vegetariano`, `limón (3 unidades); harina (200 g); mantequilla (100 g)`; DB `pasos_resumen` = ["Preparar la base con harina y mantequilla","Añadir la crema de limón y hornear"] |
| A7-SAFEB-09 | coliflor-al-horno-con-curry-b72 (L435), pollo-al-curry-con-coco-b22 (L507) | Curry powder / "especias de curry" with no allergen tag. Commercial curry blends commonly contain mustard seed (and sometimes celery); `mostaza` untagged. In b22 the curry is not even in the ingredient list (only in the steps) | HIGH (PLAUSIBLE: blend composition not stated) | L435 `curry en polvo (2 cucharadas)`, `alergenos=""`; L507 ingredients `pollo; leche de coco; arroz`, DB step "Sofreír el pollo con especias de curry" |
| A7-SAFEB-10 | arroz-magro-pimientos (L381), seco-de-ternera (L522), crema-calabacin (L446), crema-calabaza-jengibre (L447) | Unspecified commercial stock (`caldo de carne` / `caldo de verduras`) with no allergen. Stock cubes/bricks sold in Spain routinely declare celery (`apio`), sometimes gluten; the recipe gives no "sin apio" stock instruction | HIGH (PLAUSIBLE) | L381 `caldo de carne (800 ml)`; L522 `caldo de carne (400 ml)`; L446 `caldo de verduras (500 ml)`; L447 `caldo de verduras (500 ml)`; all `alergenos=""` |
| A7-SAFEB-11 | tofu-al-curry-verde-… (L305-L309, 5 rows) | Steps say "Cocer en salsa" for a green curry but no curry paste is listed. Thai green curry paste usually contains shrimp paste (crustaceos) and fish sauce; rows are `vegano=true` with only `soja` | MEDIUM (PLAUSIBLE: hidden ingredient, not stated) | L307 `tofu (300 g); calabacín (2 unidades); leche de coco (200 ml); lima`; DB step "Cocer en salsa el tofu junto con calabacín" |
| A7-SAFEB-12 | sopa-miso-con-tofu-b47 (L271) | Steps dissolve miso "en caldo caliente": miso soup stock is traditionally dashi (bonito = pescado); unspecified stock on a `vegano=true` row | MEDIUM (PLAUSIBLE) | DB step "Disolver el miso en caldo caliente"; CSV dieta_true includes `vegano vegetariano`, `alergenos="soja gluten"` |
| A7-SAFEB-13 | tamari rows (18 rows: L289-L293, L301-L304, L353-L361) | All 18 treat `tamari` as gluten-free (`sin_gluten=true`, no gluten tag) while `salsa de soja` rows are tagged gluten. Many tamari brands contain wheat; the recipe never says "tamari sin gluten" | MEDIUM (PLAUSIBLE: correct only if a certified GF tamari is specified) | e.g. L289 `tamari (2 cucharadas)`, `alergenos="soja"`, dieta_true `… sin_gluten …`; contrast L363 `salsa de soja` -> `alergenos="soja gluten"` |
| A7-SAFEB-14 | paleo flag (14 rows) | `paleo=true` on recipes with bread, wheat tortilla, granola, cheese/yogurt, legumes, soy or quinoa: L272, L328, L331, L336, L337, L339, L341, L365, L368, L380, L468, L471, L486, L497 | MEDIUM | e.g. L365 wrap-de-pollo-con-especias-version-ligera `tortilla de trigo (4 unidades)` with dieta_true `halal keto kosher paleo …`; L497 `lentejas (400 g)` paleo true; L368 `yogur griego; granola` paleo true |
| A7-SAFEB-15 | wrap-de-pollo-con-especias-version-ligera (L365), ensalada-de-quinoa-con-guarnicion-de-temporada (L471) | `keto=true` on wheat tortillas (4) and on 240 g quinoa: clearly not keto | MEDIUM | L365 dieta_true `halal keto kosher paleo sin_huevo sin_lactosa`, `tortilla de trigo (4 unidades)`; L471 dieta_true `halal keto kosher paleo …`, `quinoa (240 g)` |
| A7-SAFEB-16 | mushroom rows `bajo_fodmap=true` (8 rows: L392-L396, L478-L480) | Champiñones (150-200 g) are high-FODMAP (mannitol) yet flagged low-FODMAP; same-catalogue rows with garlic correctly say false | LOW | L392 `champiñones (200 g)` dieta_true `bajo_fodmap …`; L478 `champiñones (200 g)` dieta_true `bajo_fodmap …` |
| A7-SAFEB-17 | crema-puerros-patata (L454) | `bajo_fodmap=true` with 4 leeks (leek bulb is high-FODMAP) | LOW | `puerro (4 unidades); patata (400 g)`; dieta_true `bajo_fodmap …` |
| A7-SAFEB-18 | sushi-bowl-de-salmon-b163 (L273) | Steps cook "arroz de sushi" (normally seasoned with rice vinegar, a sulfite source) but no vinegar listed and `sulfitos` untagged | LOW (PLAUSIBLE) | DB step "Cocer el arroz de sushi"; CSV `arroz (80 g); salmón (120 g); alga nori` `alergenos="pescado"` |
| A7-SAFEB-19 | guacamole-con-nachos-b81 (L489) | `sin_gluten=true` on generic `nachos`; description says "nachos de maíz" but many corn chips carry wheat/may-contain; not specified as GF | LOW (PLAUSIBLE) | `nachos (100 g)`, dieta_true `… sin_gluten …` |

## Systematic patterns (slice B, 269 rows)

- The repo oracle (`auditRecipe`) flags 0 of 269 rows in this slice: every finding above is outside its keyword table. Gaps that matter: `hummus` (sesamo), `curry` (mostaza), `caldo` (apio), sub-recipes named only in `pasos_resumen` (crema de limón, curry paste, dashi/caldo), `tamari` treated as GF.
- Hidden sub-ingredients only in steps: 4 rows (L276, L305-L309 counted as 1 family, L507, L271) – the CSV the human reviewer sees lists `ingredientes` only, so these cannot be caught in the review sheet.
- Unspecified commercial stock: 4 rows, all untagged.
- Tamari as gluten-free: 18 rows. Paleo wrong: 14 rows. Keto wrong: 2. Low-FODMAP wrong: 9.
- Kosher inconsistency (not unsafe, conservative): arroz-con-pollo-tradicional L383 and pollo-limon-ensalada-verde L509 are `kosher=false` while equivalent chicken rows L382/L384/L510 are `kosher=true`. INFO.
- Checked and clean: all 102 `tiene_alergeno=si` rows have the obvious allergen of every listed ingredient tagged (bread->gluten, queso/nata/mantequilla/yogur->lactosa, huevo, salmón/rape/pescado->pescado, gambas->crustaceos, mejillones->moluscos, salsa de soja->soja+gluten, avena->gluten, cacahuetes, nueces, tahini->sesamo, vino->sulfitos, apio). No vegano/vegetariano row with meat, fish, egg, dairy or honey. No halal row with pork or alcohol (wine rows L295/L296 are halal=false). No sin_lactosa row with dairy; no sin_huevo row with listed egg. No over-tagging found (every tag explained; L271 gluten via miso, L368 frutos_de_cascara via granola, L320 huevo via tortellini are plausible).
- 167 `tiene_alergeno=no` rows: apart from the stock (4) and curry (1) rows, all ingredients are plain vegetables, legumes, rice, quinoa, seeds (lino, chía, calabaza, girasol – none EU-14), coco, meats, levadura nutricional, papel de arroz, tortilla de maíz. Chorizo/morcilla rows (L379, L398, L415, L416, L429, L484, L497) carry no allergen: Spanish chorizo/morcilla can contain lactose/gluten/sulfites depending on brand – not flagged individually (INFO).
- Quantities: no impossible quantities. Oddities: L329 `sal (0 al gusto)`; L328 name "con canela" without cinnamon; L372 "zumo" with 40 g oats.

## Totals

Reviewed 269 of 269 rows (L271-L539), every row read in full, plus a DB read of `pasos_resumen` for 21 suspicious slugs.
Findings: 19 IDs covering 63 row-level flags (some IDs are pattern rows).
- BLOCKER: 3 (A7-SAFEB-01 CONFIRMED; -02, -08 PLAUSIBLE)
- HIGH: 2 (-09, -10; 6 recipes, PLAUSIBLE)
- MEDIUM: 9 (-03, -04, -05, -06, -11, -12, -13, -14, -15; paleo/keto/tamari/curry paste/dashi)
- LOW: 5 (-07, -16, -17, -18, -19)

## Checklist items that found nothing
Missing tag for listed obvious allergen word (oracle-level); vegano/vegetariano with animal product; halal with pork/alcohol; sin_lactosa with dairy; sin_huevo with listed egg/mayonesa; kosher with pork/shellfish/meat+dairy; over-tagging; worcestershire/fish sauce/anchovy/gelatin/mustard/lupin/beer hidden sources (none present in slice); impossible quantities.

## Could not verify
Brand/composition of miso, tamari, stock, curry powder/paste, nachos, chorizo: depends on product bought; the catalogue does not specify. Severity for those is PLAUSIBLE.

secrets_materialized: none
cleaned: yes
