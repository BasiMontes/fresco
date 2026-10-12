-- FRESCO-943 (audit 2026-10-12 C-02): allergen and diet tags of ACTIVE recipes that contradict
-- their own ingredient list. The allergen filter (get_filtered_recipes) is a plain tag
-- comparison, so a missing tag serves a recipe to the person who declared the allergy.
--
-- Corrections found by a word-boundary keyword table over ingredientes_principales
-- (the minimum, not an exhaustive review: FRESCO-908). By recipe id, like FRESCO-876:
--   A. 27 recipes with dairy and no `lactosa` allergen.
--   B. 7 recipes with pork or wine and `dieta.halal = true` (wine in cooking counts as non-halal).
--   C. Wrap de pollo: tortilla de trigo, so `gluten` allergen and sin_gluten = false.
--   D. Pollo al ajillo uses wine (sulfitos); Gofres and Tortitas contain egg and dairy
--      (their allergen arrays already said so) but sin_huevo / sin_lactosa were true.
--   E. kosher = false (7 recipes) for rabbit, shellfish, pork and meat + dairy.
-- Each UPDATE carries a guard on the old value, so the migration is idempotent and
-- never touches a row that is already right. Allergens are appended (distinct). Slots
-- already generated (meal_plan_recipes) are not touched. supabase/seed.sql carries the
-- same changes on the same rows.

-- A. dairy without the lactosa allergen
update public.recipes
set alergenos = alergenos || '["lactosa"]'::jsonb
where id in (
  'acb795a9-8727-4a6a-b265-809f423f468d', -- Arepa rellena de queso
  'de2f7d8d-2ed4-4809-b137-05d5f457fceb', -- Bagel con salmón ahumado
  '0f5febbd-da66-465f-bb96-e6b30ec4509b', -- Batido de proteína con frutos rojos
  'ea0a6a22-f3a6-4451-b125-65af2f8c3d9b', -- Berenjenas rellenas de verduras
  '21a7e935-b70c-4c14-b9a7-ebbc6b2d5987', -- Bizcocho casero de yogur
  '02260641-9167-4041-8d9a-99d730ed8c63', -- Bol de requesón con fresas
  'a10a3985-36b0-476d-b1e8-25a0237d5bda', -- Bol de yogur griego con granola
  'd1327021-dc26-4013-92e9-deef50c40cf9', -- Boniato relleno de verduras
  'b76ddfe2-c955-4e2a-ac56-2362cd458cc3', -- Crema de espinacas y queso
  'c3d5e272-089a-44ac-98fe-7c7984607931', -- Creps de avena y plátano
  'ff5ef9a9-05ac-4732-8533-195e4030999b', -- Croissant con jamón y queso
  '787f768e-6a0a-486b-bfe5-246871e15b3c', -- Ensalada de garbanzos y feta
  '32757589-da5c-4ea8-93be-0188ff005717', -- Ensalada de rúcula, pera y nueces
  '62f69d82-8f28-4dc3-b1d0-a6a5d08da9da', -- Ensalada griega
  '0e7cbace-4c4f-4aed-af3c-de6d9325fec4', -- Gachas dulces andaluzas
  '3e78a7df-5f5e-4c01-9105-61130885d97d', -- Lasaña de verduras
  'e296d8b0-285c-4f47-a762-5b617f6740a8', -- Moussaka de berenjena
  '99347051-5b66-4885-9a0c-7804ab0e0fc8', -- Muesli con leche y frutos secos
  'fe5405d2-64b1-4e38-86af-1abced51b891', -- Muffin salado de espinacas
  'f51574b7-f91c-496d-a8a2-00127f5a84fa', -- Panqueques integrales con miel
  'b4ae0bef-1db9-4879-a0c7-a20740e22fb6', -- Risotto de setas
  '5f8c3403-95d7-4041-9739-f2af71841093', -- Sándwich de pavo y queso
  '43c0571e-7383-4818-b1be-d4af03ea0634', -- Torrijas caseras
  'a7004001-c3ec-465f-80aa-b42e00f44fc9', -- Tostada francesa salada con jamón
  'f6ae0b9d-0630-466c-9caa-e2b399bfd3a8', -- Tostada integral con tomates cherry
  '748b1ab4-64e4-4b2e-8e68-fdc5671ab694', -- Yogur griego con miel y nueces
  '1eec4534-2113-4c52-93a0-7ee25a3e22b8' -- Bol de skyr
)
  and not alergenos ? 'lactosa';

-- B. pork or wine with halal = true
update public.recipes
set dieta = jsonb_set(dieta, '{halal}', 'false')
where id in (
  '9f8e4eed-a111-4ec0-aeca-aa4f0ee29517', -- Tostada con tomate y jamón serrano
  'ff5ef9a9-05ac-4732-8533-195e4030999b', -- Croissant con jamón y queso
  '71f63131-f877-4a54-a8de-404992b0c8de', -- Revuelto de champiñones y jamón
  'a7004001-c3ec-465f-80aa-b42e00f44fc9', -- Tostada francesa salada con jamón
  'c01e6490-af49-4d67-991c-046281998196', -- Conejo al ajillo
  'a8cc4e66-e1db-439b-9178-feb0c97943ad', -- Mejillones al vapor
  'f620e9cc-4e38-48e7-a12f-88a5d2cb3a80' -- Ternera guisada
)
  and dieta->>'halal' = 'true';

-- C. Wrap de pollo: flour tortilla (trigo)
update public.recipes
set alergenos = alergenos || '["gluten"]'::jsonb
where id in (
  'dd88540d-e87a-4b1d-953b-96467de108a3' -- Wrap de pollo
)
  and not alergenos ? 'gluten';

update public.recipes
set dieta = jsonb_set(dieta, '{sin_gluten}', 'false')
where id = 'dd88540d-e87a-4b1d-953b-96467de108a3' -- Wrap de pollo
  and dieta->>'sin_gluten' = 'true';

-- D. Pollo al ajillo: wine
update public.recipes
set alergenos = alergenos || '["sulfitos"]'::jsonb
where id in (
  '48d1c389-8970-4ab0-a43a-534e4ee82277' -- Pollo al ajillo
)
  and not alergenos ? 'sulfitos';

-- D. Gofres and Tortitas contain egg
update public.recipes
set dieta = jsonb_set(dieta, '{sin_huevo}', 'false')
where id in (
  '8773e3b5-835d-462e-9316-75a8a69a2485', -- Gofres
  '281acba9-3a7e-4d31-99bc-d0d609ca66ad' -- Tortitas
)
  and dieta->>'sin_huevo' = 'true';

-- D. Gofres and Tortitas contain dairy
update public.recipes
set dieta = jsonb_set(dieta, '{sin_lactosa}', 'false')
where id in (
  '8773e3b5-835d-462e-9316-75a8a69a2485', -- Gofres
  '281acba9-3a7e-4d31-99bc-d0d609ca66ad' -- Tortitas
)
  and dieta->>'sin_lactosa' = 'true';

-- E. kosher = false: rabbit, shellfish, pork, meat + dairy
update public.recipes
set dieta = jsonb_set(dieta, '{kosher}', 'false')
where id in (
  'c01e6490-af49-4d67-991c-046281998196', -- Conejo al ajillo
  '660b29ce-db9a-486e-b0f4-e42b6652a5d0', -- Paella valenciana
  'e29fd4de-2e1c-487f-8aef-f57875dcabac', -- Gambas al ajillo
  'a8cc4e66-e1db-439b-9178-feb0c97943ad', -- Mejillones al vapor
  '5a2b8324-625b-490d-931b-75a5a337eb19', -- Ensalada cesar
  '82edb728-a851-4c38-b7da-b76e0f4da624', -- Hamburguesa de ternera
  'd4c3e7c4-aa56-457e-9a6e-c18b9252f253' -- Calamares a la plancha
)
  and dieta->>'kosher' = 'true';
