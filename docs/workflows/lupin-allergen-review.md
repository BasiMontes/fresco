# Lupin (`altramuces`) review of the recipe catalogue

> FRESCO-1316 / QAFRESCO-32. A dated record: what was checked on 2026-11-26, what was decided and what keeps it true. The results below belong to that date; the database is the source for the catalogue.

## Question

A person can declare `altramuces`, but no active recipe carried the tag. Is a tag missing, or does no recipe contain lupin?

## What was checked

| Check | Result on 2026-11-26 |
|---|---|
| Active recipes naming lupin in name, description, ingredients, quantities or steps (`altramu`, `lupin`) | none |
| Ingredient lists reviewed for processed products that can contain lupin: breads and breadcrumbs, gluten-free bread, tortillas, dough, flour, pasta and noodles, granola and biscuits, seitan, tempeh, almond drink | no ingredient names lupin |

## Decision (owner, 2026-11-26)

No recipe is tagged. A tag says a recipe contains the allergen, and no recipe lists lupin as an ingredient. Whether a packaged product contains it depends on the brand, which Fresco does not model: the app already tells the person to read the label (`ALERGENOS_AVISO` and `ALERGENOS_RECORDATORIO` in `lib/constants/dietary-options.ts`).

## What keeps it true

- An active recipe whose text names lupin without the `altramuces` tag is rejected by the database (`recipes_tag_coherence`, words in `recipe_tag_keywords`).
- The same rule in TypeScript (`tests/db/recipe-allergen-diet-rules.ts`) is covered by its unit and parity tests.
- Declaring `altramuces` removes a tagged recipe from the filtered catalogue (`tests/db/allergen-vocabulary.test.ts`).

## Not covered

Processed ingredients that contain lupin without naming it. Reopen this review if the catalogue starts naming brands or listing the composition of packaged products.
