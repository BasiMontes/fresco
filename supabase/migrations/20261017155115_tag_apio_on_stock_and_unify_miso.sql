-- FRESCO-996 (audit 7b: A7-SAFEA-34, -35, -42, A7-SAFEB-02, -10, -12): stock and miso.
--
-- The allergen filter (get_filtered_recipes) is a plain tag comparison, so every tag a recipe
-- omits is a recipe served to the person who declared it. Three rules, written as rules and not
-- as id lists so they also cover any hosted row the local seed lacks:
--
--   A. Every recipe whose ingredients or steps say "caldo" carries `apio`. Owner decision
--      (Basi, 2026-10-17): over-tag by rule, since the safe error is the over-tag. Applied to
--      every row, active or not, so a reactivated recipe is already right. "su caldo" is the
--      cooking liquid of a legume, not a stock, and is left out.
--   B. Every recipe with miso carries `gluten` and `soja` and is not `sin_gluten` (barley miso is
--      common; the four miso recipes used to disagree). "miso sin gluten" would be left out.
--   C. A vegetarian or vegan recipe that uses a stock names "caldo de verduras" in
--      ingredientes_principales, so the flag stops resting on a stock nobody named (it also
--      resolves the dashi question of A7-SAFEB-12 for sopa-miso-con-tofu-b47). The card names 7
--      recipes; a query over the catalogue finds the same defect in more, and the rule treats
--      them alike. ingredientes_cantidades is not touched: it has no quantity for the new item.
--
-- Each UPDATE carries a guard on the old value, so the migration is idempotent and never touches
-- a row that is already right. Allergens are appended. Slots already generated
-- (meal_plan_recipes) are not touched. supabase/seed.sql carries the same changes on the same rows.

-- A. every stock carries apio
update public.recipes
set alergenos = alergenos || '["apio"]'::jsonb
where regexp_replace(lower(coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')), 'su caldo', ' ', 'g') ~ '\mcaldo\M'
  and not alergenos ? 'apio';

-- B. miso: gluten and soja, never sin_gluten
update public.recipes
set alergenos = alergenos || '["gluten"]'::jsonb
where regexp_replace(lower(coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')), 'miso sin gluten', ' ', 'g') ~ '\mmiso\M'
  and not alergenos ? 'gluten';

update public.recipes
set alergenos = alergenos || '["soja"]'::jsonb
where regexp_replace(lower(coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')), 'miso sin gluten', ' ', 'g') ~ '\mmiso\M'
  and not alergenos ? 'soja';

update public.recipes
set dieta = jsonb_set(dieta, '{sin_gluten}', 'false')
where regexp_replace(lower(coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')), 'miso sin gluten', ' ', 'g') ~ '\mmiso\M'
  and dieta->>'sin_gluten' = 'true';

-- C. a vegetarian or vegan stock is named
update public.recipes
set ingredientes_principales = ingredientes_principales || '["caldo de verduras"]'::jsonb
where (dieta->>'vegetariano' = 'true' or dieta->>'vegano' = 'true')
  and regexp_replace(lower(coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')), 'su caldo', ' ', 'g') ~ '\mcaldo\M'
  and not exists (
    select 1
    from jsonb_array_elements_text(ingredientes_principales) as item
    where lower(item) ~ '\mcaldo de (verduras?|vegetal(es)?|hortalizas)\M'
  );
