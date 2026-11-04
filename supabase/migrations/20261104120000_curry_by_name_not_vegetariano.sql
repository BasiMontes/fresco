-- FRESCO-1118 (open decision of FRESCO-1092, audit 8 A8-SAFEA-03): the 10 recipes whose NAME says curry
-- but whose text names no curry lost `vegano` and `sin_gluten` and gained `mostaza` in
-- 20261104110000, because the curry paste is a bought product the recipe does not specify. A Thai green
-- paste can carry shrimp paste, and that breaks `vegetariano` exactly as it breaks `vegano`. The owner
-- decided on 2026-11-04 to apply the same criterion: when a claim rests on a product the recipe does
-- not specify, the claim is withdrawn.
--
-- By rule and not by id, like 20261104110000, so inactive duplicates and rows added since are covered.
-- The recipe NAME is not a text source of the barrier (recipe_tag_findings does not receive it), so the
-- rule stays held by the catalogue test in tests/db/recipe-composite-products.test.ts. Idempotent: a row
-- that no longer claims `vegetariano` is not touched. Slots already generated are not touched.
update public.recipes
set dieta = jsonb_set(dieta, '{vegetariano}', 'false'::jsonb)
where public.recipe_tag_norm(nombre) ~ '\mcurr[yi]\M'
  and public.recipe_tag_norm(coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')) !~ '\mcurr[yi]\M'
  and (dieta ->> 'vegetariano') = 'true';
