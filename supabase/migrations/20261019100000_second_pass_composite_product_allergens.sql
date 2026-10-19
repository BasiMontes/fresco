-- FRESCO-997 (audit 7b: A7-SAFEA-06, -07, -11, -17, -18, -19, -22 to -26, -31, -40, -41, -47, -48;
-- A7-SAFEB-09, -11, -13, -18, -19): products that are compound (curry, mayonnaise, barbecue sauce,
-- vinegar, raisins, beer, nachos, sushi rice, tamari) hide an allergen the recipe does not tag, and
-- 31 recipes keep sin_gluten = true while naming plain tamari. The allergen filter
-- (get_filtered_recipes) is a plain tag comparison, so a missing tag serves the recipe to the
-- person who declared the allergy.
--
-- Written as RULES over the whole catalogue (like FRESCO-996), so it also covers hosted rows the
-- local seed lacks, and a recipe added later is held to the same words by the oracle in
-- tests/db/recipe-allergen-diet-rules.ts. Owner rule from FRESCO-996: over-tag.
--
--   A. A product the steps name but the ingredient list does not is appended to the list
--      (bechamel, crema de limón, salsa de soja, vinagre, curry), so the shopping list buys it.
--   B. Tamari and nachos in a sin_gluten recipe are named as the gluten-free product ("tamari sin
--      gluten", "nachos sin gluten"): the ingredient tells the buyer what to pick and the flag
--      stays truthful. Recipes with sin_gluten = false are already honest and are not touched.
--   C. mostaza: curry blends and mustard in mayonnaise and barbecue sauce.
--   D. sulfitos: vinegar, raisins, mayonnaise, barbecue sauce, beer and sushi rice. Rice vinegar
--      is made without grape must, so "vinagre de arroz" does not count (same exception as the oracle).
--
-- Every UPDATE carries a guard on the old value, so a rerun updates 0 rows. Allergens are appended.
-- Slots already generated (meal_plan_recipes) are not touched. supabase/seed.sql carries the same
-- changes on the same rows.

-- Rewrites every element of a jsonb array of strings that matches `pattern` and does not yet say
-- "sin gluten" after it. Temporary: it exists only for this migration.
create or replace function pg_temp.name_gluten_free(items jsonb, pattern text, replacement text)
returns jsonb
language sql
as $$
  select coalesce(
    jsonb_agg(
      case
        when item ~* pattern then regexp_replace(item, pattern, replacement, 'gi')
        else item
      end
      order by position
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements_text(items) with ordinality as element(item, position)
$$;

-- A. products named only in the steps join the ingredient list
do $$
declare
  product record;
begin
  for product in
    select pattern, name
    from (values
      ('salsa de soja', 'salsa de soja'),
      ('bechamel', 'bechamel'),
      ('crema de lim[oó]n', 'crema de limón'),
      ('vinagre', 'vinagre'),
      ('curry', 'curry en polvo')
    ) as products(pattern, name)
  loop
    update public.recipes
    set ingredientes_principales = ingredientes_principales || to_jsonb(product.name)
    where lower(coalesce(pasos_resumen::text, '')) ~ ('\m' || product.pattern || '\M')
      and lower(coalesce(ingredientes_principales::text, '')) !~ ('\m' || product.pattern || '\M');
  end loop;
end
$$;

-- B. tamari and nachos in a sin_gluten recipe say which product to buy
update public.recipes
set ingredientes_principales = pg_temp.name_gluten_free(ingredientes_principales, '\mtamari\M(?! sin gluten)', 'tamari sin gluten'),
    pasos_resumen = pg_temp.name_gluten_free(pasos_resumen, '\mtamari\M(?! sin gluten)', 'tamari sin gluten')
where dieta->>'sin_gluten' = 'true'
  and (coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')) ~* '\mtamari\M(?! sin gluten)';

update public.recipes
set ingredientes_principales = pg_temp.name_gluten_free(ingredientes_principales, '\mnachos( de ma[ií]z)?\M(?! sin gluten)', 'nachos sin gluten'),
    pasos_resumen = pg_temp.name_gluten_free(pasos_resumen, '\mnachos( de ma[ií]z)?\M(?! sin gluten)', 'nachos sin gluten')
where dieta->>'sin_gluten' = 'true'
  and (coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')) ~* '\mnachos( de ma[ií]z)?\M(?! sin gluten)';

-- C. mustard
update public.recipes
set alergenos = alergenos || '["mostaza"]'::jsonb
where lower(coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')) ~ '\m(mostaza|curry|mayonesa|barbacoa)\M'
  and not alergenos ? 'mostaza';

-- D. sulfites
update public.recipes
set alergenos = alergenos || '["sulfitos"]'::jsonb
where regexp_replace(lower(coalesce(ingredientes_principales::text, '') || ' ' || coalesce(pasos_resumen::text, '')), 'vinagre de arroz', ' ', 'g')
      ~ '\m(vino|vinagre|pasas|orejones|vermut|cava|sidra|mayonesa|barbacoa|cerveza|arroz de sushi)\M'
  and not alergenos ? 'sulfitos';
