-- FRESCO-995 (audit 7b: A7-SAFEB-01, A7-SAFEB-08, A7-SAFEA-08, -09, -27, -32, -33): seven active
-- recipes omit an allergen that their own text confirms. The allergen filter
-- (get_filtered_recipes) is a plain tag comparison, so a missing tag serves the recipe to the
-- person who declared the allergy.
--
-- By recipe id, like FRESCO-943 / FRESCO-876:
--   A. Tostada con hummus y pepino: hummus is made with tahini            -> sesamo
--   B. Moussaka de berenjena: bechamel is thickened with flour            -> gluten, sin_gluten = false
--   C. Pad thai de gambas (2 rows): salsa de soja is soy and wheat        -> soja (row 1), gluten, sin_gluten = false
--   D. Crepes de espinacas y queso, Tarta de limón, Croissant con jamón y queso
--      (batter, lemon cream and egg wash)                                  -> huevo, sin_huevo = false
--
-- The egg cases are fixed with the allergen tag, not by adding an egg to ingredientes_principales
-- (the card allows either): the tag is what the filter reads, matches FRESCO-943, and does not
-- invent a quantity. The shopping list therefore does not list eggs for those three recipes;
-- FRESCO-908 (owner review) decides whether the ingredient list should say so.
--
-- Each UPDATE carries a guard on the old value, so the migration is idempotent and never touches
-- a row that is already right. Allergens are appended. Slots already generated
-- (meal_plan_recipes) are not touched. supabase/seed.sql carries the same changes on the same rows.

-- A. hummus without sesamo
update public.recipes
set alergenos = alergenos || '["sesamo"]'::jsonb
where id = '9b0b28d2-2e2d-4fdd-a97d-67499b71d3c4' -- Tostada con hummus y pepino
  and not alergenos ? 'sesamo';

-- C (part). first pad thai row: soy sauce, and no soja tag yet (the b41 row already has it)
update public.recipes
set alergenos = alergenos || '["soja"]'::jsonb
where id = '2504b5b4-40fc-471b-b949-59c940220ade' -- Pad thai de gambas
  and not alergenos ? 'soja';

-- B + C. bechamel and soy sauce carry wheat
update public.recipes
set alergenos = alergenos || '["gluten"]'::jsonb
where id in (
  'e296d8b0-285c-4f47-a762-5b617f6740a8', -- Moussaka de berenjena
  '2504b5b4-40fc-471b-b949-59c940220ade', -- Pad thai de gambas
  '64d0fc21-7a36-4e3e-92ce-e83ce876b9aa' -- Pad thai de gambas (b41)
)
  and not alergenos ? 'gluten';

update public.recipes
set dieta = jsonb_set(dieta, '{sin_gluten}', 'false')
where id in (
  'e296d8b0-285c-4f47-a762-5b617f6740a8', -- Moussaka de berenjena
  '2504b5b4-40fc-471b-b949-59c940220ade', -- Pad thai de gambas
  '64d0fc21-7a36-4e3e-92ce-e83ce876b9aa' -- Pad thai de gambas (b41)
)
  and dieta->>'sin_gluten' = 'true';

-- D. egg in the batter, the lemon cream and the glaze
update public.recipes
set alergenos = alergenos || '["huevo"]'::jsonb
where id in (
  '483e17bb-77b4-4a42-b763-7c4764efaba6', -- Crepes de espinacas y queso
  'eb7514bb-43c6-4dc1-8222-353257be7f80', -- Tarta de limón
  'ff5ef9a9-05ac-4732-8533-195e4030999b' -- Croissant con jamón y queso
)
  and not alergenos ? 'huevo';

update public.recipes
set dieta = jsonb_set(dieta, '{sin_huevo}', 'false')
where id in (
  '483e17bb-77b4-4a42-b763-7c4764efaba6', -- Crepes de espinacas y queso
  'eb7514bb-43c6-4dc1-8222-353257be7f80', -- Tarta de limón
  'ff5ef9a9-05ac-4732-8533-195e4030999b' -- Croissant con jamón y queso
)
  and dieta->>'sin_huevo' = 'true';
