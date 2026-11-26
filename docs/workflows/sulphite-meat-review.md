# Sulphites (`sulfitos`) in meat ingredients

> FRESCO-1319. A dated record: what was checked on 2026-11-26, what was decided and what keeps it true. The results below belong to that date; the database is the source for the catalogue.

## Question

Many active recipes with ham, chorizo, panceta, tocino, black pudding or minced meat carry no `sulfitos` tag. Is the tag missing?

## What the law says

In meat, Regulation (EC) 1333/2008 authorises sulphur dioxide and sulphites (E 220-228) as an additive in meat preparations (category 08.2) only: burger meat with at least 4 % vegetable or cereal, breakfast sausages, and fresh salchicha, longaniza and butifarra. The Commission register shows no authorisation for processed meat products. A content of 10 mg/kg or less is not considered present.

- [Commission food additives register, sulphur dioxide and sulphites](https://ec.europa.eu/food/food-feed-portal/screen/food-additives/search/details/POL-FAD-IMPORT-3044)
- [Commission Regulation (EU) 601/2014](https://www.boe.es/buscar/doc.php?id=DOUE-L-2014-81226)

## Decision (owner, 2026-11-26)

A recipe needs the `sulfitos` tag when it names one of those fresh preparations. Cured and cooked meat products require nothing on their own. Recipes that already carry the tag keep it. On 2026-11-26 no recipe, active or not, named any of those preparations, so no recipe row changed.

## What keeps it true

- An active recipe whose text names one of those preparations without the tag is rejected by the database (`recipes_tag_coherence`, words in `recipe_tag_keywords`).
- The same words live in TypeScript (`tests/db/recipe-allergen-diet-rules.ts`), covered by its unit tests and by the parity test between both.

## Not covered

- Sulphites carried into a product by another of its ingredients, such as wine, or added against the regulation. Both depend on the product label, which the app already tells the person to read (`ALERGENOS_AVISO` and `ALERGENOS_RECORDATORIO` in `lib/constants/dietary-options.ts`).
- A preparation named without saying it is fresh (a bare "salchicha" or "longaniza").
