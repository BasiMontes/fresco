-- FRESCO-880 (family 4 of 4, part 1): recipes that are broken beyond their ingredient list,
-- resolved one by one as product decisions.
--
--   * Sopa de ajo x4 (kale + jengibre): the steps and the "apta vegana, sin gluten, keto"
--     claim describe a kale and ginger soup, so they are renamed after what they are. The
--     real castilian "Sopa de ajo con huevo" is untouched.
--   * Ensalada cesar x2: no lettuce, no dressing, "Servir caliente". "Ensalada cesar con
--     verduras salteadas" (not in any menu) is deactivated; "Ensalada cesar" is in a menu,
--     so it stays: it gains lechuga romana and steps of a real Caesar salad.
--   * Rollitos de primavera: "obertura de arroz" is a typo for papel de arroz (list,
--     quantities, description and steps).
--   * Bizcocho casero de yogur: `pan integral` -> `harina`, with the twin "Bizcocho de
--     yogur"'s 180 g.
--   * Arepa rellena de queso: `arroz` -> `harina de maíz` (a corn dough; the allergens are
--     unchanged, both are gluten free).
--   * Gachas dulces andaluzas (in 9 menus, so it is fixed, not deactivated): `pan` ->
--     `harina` (60 g per 500 ml of milk), the step stops saying "pan troceado" and the
--     description says canela like the list and the steps (it said matalahúva).
--   * Ensalada de burrata y tomate: lists mozzarella while its twin "Ensalada de burrata con
--     tomate" lists the burrata; deactivated (not in any menu).
--
-- Deactivating is the FRESCO-460 mechanism (`activo = false`, reversible). A recipe that is in
-- a menu is never deactivated: its detail page resolves through get_filtered_recipes(). Slugs
-- are kept so existing links work. Each update only fires while the row still holds its old
-- name, list, description and steps, so it is idempotent and never overwrites a later edit.
-- Quantities for the changed ingredients are estimates.

-- Sopa de ajo -> Sopa de kale y jengibre con ajo y semillas de lino
update public.recipes
set nombre = 'Sopa de kale y jengibre con ajo y semillas de lino',
    descripcion_corta = 'Sopa de kale y jengibre con ajo y semillas de lino, apta vegana, sin gluten, sin lácteos y keto.'
where id = '03ff12b2-e35c-4cde-8ac5-563ed6df5cb6'
  and activo
  and nombre = 'Sopa de ajo'
  and descripcion_corta = 'Sopa con ajo y semillas de lino, apta vegana, sin gluten, sin lácteos y keto.';

-- Sopa de ajo con ajo asado -> Sopa de kale y jengibre con ajo asado
update public.recipes
set nombre = 'Sopa de kale y jengibre con ajo asado',
    descripcion_corta = 'Sopa de kale y jengibre con ajo asado, apta vegana, sin gluten, sin lácteos y keto.'
where id = 'eb97ffea-2bd6-4a09-b9e4-8ecbfb96120e'
  and activo
  and nombre = 'Sopa de ajo con ajo asado'
  and descripcion_corta = 'Sopa con ajo y ajo asado, apta vegana, sin gluten, sin lácteos y keto.';

-- Sopa de ajo con cilantro -> Sopa de kale y jengibre con ajo y cilantro
update public.recipes
set nombre = 'Sopa de kale y jengibre con ajo y cilantro',
    descripcion_corta = 'Sopa de kale y jengibre con ajo y cilantro, apta vegana, sin gluten, sin lácteos y keto.'
where id = 'b76179c6-65f8-4052-9736-6c5acf94ae9c'
  and activo
  and nombre = 'Sopa de ajo con cilantro'
  and descripcion_corta = 'Sopa con ajo y cilantro, apta vegana, sin gluten, sin lácteos y keto.';

-- Sopa de ajo con limón -> Sopa de kale y jengibre con ajo y limón
update public.recipes
set nombre = 'Sopa de kale y jengibre con ajo y limón',
    descripcion_corta = 'Sopa de kale y jengibre con ajo y limón, apta vegana, sin gluten, sin lácteos y keto.'
where id = 'c39cf178-e1fd-4e58-a4e4-f47881656d04'
  and activo
  and nombre = 'Sopa de ajo con limón'
  and descripcion_corta = 'Sopa con ajo y limón, apta vegana, sin gluten, sin lácteos y keto.';

-- deactivate
update public.recipes
set activo = false
where id = '4ec20162-b88c-4f2d-be8f-37991facd49a'
  and activo;

-- Ensalada cesar: + lechuga romana, pasos
update public.recipes
set ingredientes_principales = '["pechuga de pollo","lechuga romana","queso rallado","pan integral"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":600,"nombre":"pechuga de pollo","unidad":"g"},{"nombre":"lechuga romana","cantidad":1,"unidad":"unidades"},{"cantidad":60,"nombre":"queso rallado","unidad":"g"},{"cantidad":4,"nombre":"pan integral","unidad":"unidades"}]'::jsonb,
    pasos_resumen = '["Hacer la pechuga de pollo a la plancha y trocear","Mezclar con la lechuga romana y el queso rallado","Añadir el pan integral tostado en dados y aliñar"]'::jsonb
where id = '5a2b8324-625b-490d-931b-75a5a337eb19'
  and activo
  and nombre = 'Ensalada cesar'
  and ingredientes_principales = '["pechuga de pollo","queso rallado","pan integral"]'::jsonb
  and pasos_resumen = '["Preparar pechuga de pollo","Cocinar con queso rallado, pan integral","Sazonar al gusto","Servir caliente"]'::jsonb;

-- Rollitos: obertura -> papel de arroz
update public.recipes
set descripcion_corta = 'Rollitos de repollo y zanahoria en papel de arroz.',
    ingredientes_principales = '["repollo","zanahoria","papel de arroz"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":300,"nombre":"repollo","unidad":"g"},{"cantidad":2,"nombre":"zanahoria","unidad":"unidades"},{"cantidad":8,"nombre":"papel de arroz","unidad":"unidades"}]'::jsonb,
    pasos_resumen = '["Cortar el repollo y la zanahoria en tiras","Envolver en la papel de arroz humedecida"]'::jsonb
where id = 'c6428995-e4cc-4460-b64d-d2b3abd17de1'
  and activo
  and nombre = 'Rollitos de primavera'
  and descripcion_corta = 'Rollitos de repollo y zanahoria en obertura de arroz.'
  and ingredientes_principales = '["repollo","zanahoria","obertura de arroz"]'::jsonb
  and pasos_resumen = '["Cortar el repollo y la zanahoria en tiras","Envolver en la obertura de arroz humedecida"]'::jsonb;

-- Bizcocho: pan integral -> harina
update public.recipes
set ingredientes_principales = '["yogur natural","huevo","harina"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":125,"nombre":"yogur natural","unidad":"g"},{"cantidad":2,"nombre":"huevo","unidad":"unidades"},{"cantidad":180,"nombre":"harina","unidad":"g"}]'::jsonb
where id = '21a7e935-b70c-4c14-b9a7-ebbc6b2d5987'
  and activo
  and nombre = 'Bizcocho casero de yogur'
  and ingredientes_principales = '["yogur natural","huevo","pan integral"]'::jsonb;

-- Arepa: arroz -> harina de maíz
update public.recipes
set ingredientes_principales = '["harina de maíz","queso"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":80,"nombre":"harina de maíz","unidad":"g"},{"cantidad":50,"nombre":"queso","unidad":"g"}]'::jsonb
where id = 'acb795a9-8727-4a6a-b265-809f423f468d'
  and activo
  and nombre = 'Arepa rellena de queso'
  and ingredientes_principales = '["arroz","queso"]'::jsonb;

-- Gachas: pan -> harina
update public.recipes
set descripcion_corta = 'Gachas tradicionales de harina, leche y canela.',
    ingredientes_principales = '["harina","leche","canela"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":60,"nombre":"harina","unidad":"g"},{"cantidad":500,"nombre":"leche","unidad":"ml"},{"cantidad":1,"nombre":"canela","unidad":"cucharaditas"}]'::jsonb,
    pasos_resumen = '["Hervir la leche con canela","Añadir la harina poco a poco","Cocer removiendo hasta espesar"]'::jsonb
where id = '0e7cbace-4c4f-4aed-af3c-de6d9325fec4'
  and activo
  and nombre = 'Gachas dulces andaluzas'
  and descripcion_corta = 'Gachas tradicionales de harina, leche y matalahúva.'
  and ingredientes_principales = '["pan","leche","canela"]'::jsonb
  and pasos_resumen = '["Hervir la leche con canela","Añadir el pan troceado","Cocer removiendo hasta espesar"]'::jsonb;

-- deactivate
update public.recipes
set activo = false
where id = 'fc9b80ef-b86e-47d3-b4a2-ec180a34f8b2'
  and activo;

