-- FRESCO-880 (family 2 of 4, follow-up of FRESCO-876): recipes whose title or description
-- names a spice or seed that their own steps use, but that is missing from the ingredient list.
--
-- 23 recipes ("Berenjenas asadas con sésamo y …", "Repollo salteado con semillas de sésamo
-- y …", "Champiñones al ajillo con perejil y …", "Coliflor asada con cúrcuma, comino y …").
-- The generator put the variable garnish in the list (lima, cilantro, aceitunas…) and left
-- the fixed one out, while `pasos_resumen` says "Añadir sésamo con …". The recipe's own
-- steps back the change, which is the rule FRESCO-876 set for editing data instead of
-- renaming.
--
-- * `ingredientes_principales` gains the missing ingredient; `ingredientes_cantidades` gains a
--   matching entry (recipes_ingredientes_cantidades_valid needs every `nombre` listed). Quantity
--   per recipe: sésamo 10 g and comino 2 g from the ingredient dictionary's `porcionReceta`;
--   perejil 10 g, like the cilantro already used in sibling recipes (not in the dictionary).
-- * `alergenos` gains `sesamo` where sésamo is added: sesame is one of the 14 EU allergens
--   and the food-safety filter reads this column. `dieta` does not change (sésamo, perejil
--   and comino break none of its flags).
--
-- Each update only fires while the row still holds the exact old list, so it is idempotent
-- and never overwrites a later edit.

-- Berenjenas asadas con sésamo y ajo asado: + sésamo
update public.recipes
set ingredientes_principales = '["berenjena","tamari","ajo","sésamo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":2,"nombre":"berenjena","unidad":"unidades"},{"cantidad":2,"nombre":"tamari","unidad":"cucharadas"},{"cantidad":3,"nombre":"ajo","unidad":"dientes"},{"nombre":"sésamo","cantidad":10,"unidad":"g"}]'::jsonb,
    alergenos = '["soja","sesamo"]'::jsonb
where id = '53d0a44d-2bd0-4c24-9985-50f8a7b98455'
  and ingredientes_principales = '["berenjena","tamari","ajo"]'::jsonb;

-- Berenjenas asadas con sésamo y cilantro: + sésamo
update public.recipes
set ingredientes_principales = '["berenjena","tamari","cilantro","sésamo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":2,"nombre":"berenjena","unidad":"unidades"},{"cantidad":2,"nombre":"tamari","unidad":"cucharadas"},{"cantidad":1,"nombre":"cilantro","unidad":"cucharadas"},{"nombre":"sésamo","cantidad":10,"unidad":"g"}]'::jsonb,
    alergenos = '["soja","sesamo"]'::jsonb
where id = '83faf9e6-c99b-4a3a-b7f5-01f2ecf78216'
  and ingredientes_principales = '["berenjena","tamari","cilantro"]'::jsonb;

-- Berenjenas asadas con sésamo y limón: + sésamo
update public.recipes
set ingredientes_principales = '["berenjena","tamari","limón","sésamo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":2,"nombre":"berenjena","unidad":"unidades"},{"cantidad":2,"nombre":"tamari","unidad":"cucharadas"},{"cantidad":1,"nombre":"limón","unidad":"unidades"},{"nombre":"sésamo","cantidad":10,"unidad":"g"}]'::jsonb,
    alergenos = '["soja","sesamo"]'::jsonb
where id = '32660bdd-9ce2-4767-ae01-b94448186de6'
  and ingredientes_principales = '["berenjena","tamari","limón"]'::jsonb;

-- Berenjenas asadas con sésamo y semillas de lino: + sésamo
update public.recipes
set ingredientes_principales = '["berenjena","tamari","semillas de lino","sésamo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":2,"nombre":"berenjena","unidad":"unidades"},{"cantidad":2,"nombre":"tamari","unidad":"cucharadas"},{"cantidad":2,"nombre":"semillas de lino","unidad":"cucharadas"},{"nombre":"sésamo","cantidad":10,"unidad":"g"}]'::jsonb,
    alergenos = '["soja","sesamo"]'::jsonb
where id = '3963916b-a2e6-4996-9d8c-b869dbb15004'
  and ingredientes_principales = '["berenjena","tamari","semillas de lino"]'::jsonb;

-- Champiñones al ajillo con perejil picante: + perejil
update public.recipes
set ingredientes_principales = '["champiñones","ajo","jengibre","perejil"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"champiñones","unidad":"g"},{"cantidad":3,"nombre":"ajo","unidad":"dientes"},{"cantidad":5,"nombre":"jengibre","unidad":"g"},{"nombre":"perejil","cantidad":10,"unidad":"g"}]'::jsonb
where id = 'e3c206a5-c165-4c9e-ac36-90b580d36e20'
  and ingredientes_principales = '["champiñones","ajo","jengibre"]'::jsonb;

-- Champiñones al ajillo con perejil y aceitunas: + perejil
update public.recipes
set ingredientes_principales = '["champiñones","ajo","aceitunas","perejil"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"champiñones","unidad":"g"},{"cantidad":3,"nombre":"ajo","unidad":"dientes"},{"cantidad":40,"nombre":"aceitunas","unidad":"g"},{"nombre":"perejil","cantidad":10,"unidad":"g"}]'::jsonb
where id = '2eb196b4-12f1-4f53-b822-b6cb9a997219'
  and ingredientes_principales = '["champiñones","ajo","aceitunas"]'::jsonb;

-- Champiñones al ajillo con perejil y cilantro fresco: + perejil
update public.recipes
set ingredientes_principales = '["champiñones","ajo","cilantro","perejil"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"champiñones","unidad":"g"},{"cantidad":3,"nombre":"ajo","unidad":"dientes"},{"cantidad":10,"nombre":"cilantro","unidad":"g"},{"nombre":"perejil","cantidad":10,"unidad":"g"}]'::jsonb
where id = '4e55c50d-0c69-48b5-a934-fd3bd0027dc5'
  and ingredientes_principales = '["champiñones","ajo","cilantro"]'::jsonb;

-- Champiñones al ajillo con perejil y lima: + perejil
update public.recipes
set ingredientes_principales = '["champiñones","ajo","lima","perejil"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"champiñones","unidad":"g"},{"cantidad":4,"nombre":"ajo","unidad":"dientes"},{"cantidad":1,"nombre":"lima","unidad":"unidades"},{"nombre":"perejil","cantidad":10,"unidad":"g"}]'::jsonb
where id = '46c9ca5f-e5c1-4839-bfac-ddb564c90634'
  and ingredientes_principales = '["champiñones","ajo","lima"]'::jsonb;

-- Champiñones al ajillo con perejil y semillas de calabaza: + perejil
update public.recipes
set ingredientes_principales = '["champiñones","ajo","semillas de calabaza","perejil"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"champiñones","unidad":"g"},{"cantidad":3,"nombre":"ajo","unidad":"dientes"},{"cantidad":30,"nombre":"semillas de calabaza","unidad":"g"},{"nombre":"perejil","cantidad":10,"unidad":"g"}]'::jsonb
where id = '4a4b533e-895d-47c3-98f1-9db86917cf7f'
  and ingredientes_principales = '["champiñones","ajo","semillas de calabaza"]'::jsonb;

-- Champiñones portobello a la plancha con jengibre: + perejil
update public.recipes
set ingredientes_principales = '["portobello","ajo","jengibre","perejil"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":200,"nombre":"portobello","unidad":"g"},{"cantidad":1,"nombre":"ajo","unidad":"dientes"},{"cantidad":5,"nombre":"jengibre","unidad":"g"},{"nombre":"perejil","cantidad":10,"unidad":"g"}]'::jsonb
where id = '1bdfb9eb-0e1b-4b70-8483-fe89853ed51c'
  and ingredientes_principales = '["portobello","ajo","jengibre"]'::jsonb;

-- Champiñones portobello a la plancha con lima y cilantro: + perejil
update public.recipes
set ingredientes_principales = '["portobello","ajo","lima","cilantro","perejil"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":150,"nombre":"portobello","unidad":"g"},{"cantidad":1,"nombre":"ajo","unidad":"dientes"},{"cantidad":0.5,"nombre":"lima","unidad":"unidades"},{"cantidad":5,"nombre":"cilantro","unidad":"g"},{"nombre":"perejil","cantidad":10,"unidad":"g"}]'::jsonb
where id = 'affca230-07cf-4c10-9a9e-882efb550492'
  and ingredientes_principales = '["portobello","ajo","lima","cilantro"]'::jsonb;

-- Champiñones portobello a la plancha con limón: + perejil
update public.recipes
set ingredientes_principales = '["portobello","ajo","limón","perejil"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":200,"nombre":"portobello","unidad":"g"},{"cantidad":1,"nombre":"ajo","unidad":"dientes"},{"cantidad":0.5,"nombre":"limón","unidad":"unidades"},{"nombre":"perejil","cantidad":10,"unidad":"g"}]'::jsonb
where id = 'd9363395-e8aa-4ee2-ab14-9012704c178b'
  and ingredientes_principales = '["portobello","ajo","limón"]'::jsonb;

-- Champiñones portobello a la plancha con semillas de lino: + perejil
update public.recipes
set ingredientes_principales = '["portobello","ajo","semillas de lino","perejil"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":200,"nombre":"portobello","unidad":"g"},{"cantidad":1,"nombre":"ajo","unidad":"dientes"},{"cantidad":10,"nombre":"semillas de lino","unidad":"g"},{"nombre":"perejil","cantidad":10,"unidad":"g"}]'::jsonb
where id = 'd98f8ca1-b442-4d07-bc8a-a773be3cbdeb'
  and ingredientes_principales = '["portobello","ajo","semillas de lino"]'::jsonb;

-- Coliflor asada con cúrcuma: + comino
update public.recipes
set ingredientes_principales = '["coliflor","aceite de oliva","jengibre","comino"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":600,"nombre":"coliflor","unidad":"g"},{"cantidad":40,"nombre":"aceite de oliva","unidad":"ml"},{"cantidad":10,"nombre":"jengibre","unidad":"g"},{"nombre":"comino","cantidad":2,"unidad":"g"}]'::jsonb
where id = 'f63b6deb-4fcb-4b72-a91a-82c98da08d49'
  and ingredientes_principales = '["coliflor","aceite de oliva","jengibre"]'::jsonb;

-- Coliflor asada con cúrcuma, comino y aceitunas: + comino
update public.recipes
set ingredientes_principales = '["coliflor","aceite de oliva","aceitunas","comino"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":600,"nombre":"coliflor","unidad":"g"},{"cantidad":2,"nombre":"aceite de oliva","unidad":"cucharadas"},{"cantidad":30,"nombre":"aceitunas","unidad":"g"},{"nombre":"comino","cantidad":2,"unidad":"g"}]'::jsonb
where id = '58b5bc06-54a8-4630-8f0c-356a883344dc'
  and ingredientes_principales = '["coliflor","aceite de oliva","aceitunas"]'::jsonb;

-- Coliflor asada con cúrcuma, comino y cilantro fresco: + comino
update public.recipes
set ingredientes_principales = '["coliflor","aceite de oliva","cilantro","comino"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":600,"nombre":"coliflor","unidad":"g"},{"cantidad":2,"nombre":"aceite de oliva","unidad":"cucharadas"},{"cantidad":5,"nombre":"cilantro","unidad":"g"},{"nombre":"comino","cantidad":2,"unidad":"g"}]'::jsonb
where id = 'cf45a7bb-641d-4795-903d-6ec46e75bbca'
  and ingredientes_principales = '["coliflor","aceite de oliva","cilantro"]'::jsonb;

-- Coliflor asada con cúrcuma, comino y lima: + comino
update public.recipes
set ingredientes_principales = '["coliflor","aceite de oliva","lima","comino"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":600,"nombre":"coliflor","unidad":"g"},{"cantidad":2,"nombre":"aceite de oliva","unidad":"cucharadas"},{"cantidad":1,"nombre":"lima","unidad":"unidades"},{"nombre":"comino","cantidad":2,"unidad":"g"}]'::jsonb
where id = 'a3dc98e4-3494-42ac-8973-822e80634027'
  and ingredientes_principales = '["coliflor","aceite de oliva","lima"]'::jsonb;

-- Coliflor asada con cúrcuma, comino y semillas de calabaza: + comino
update public.recipes
set ingredientes_principales = '["coliflor","aceite de oliva","semillas de calabaza","comino"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":600,"nombre":"coliflor","unidad":"g"},{"cantidad":30,"nombre":"aceite de oliva","unidad":"ml"},{"cantidad":20,"nombre":"semillas de calabaza","unidad":"g"},{"nombre":"comino","cantidad":2,"unidad":"g"}]'::jsonb
where id = '28c03b6d-0abd-413c-9b9c-5001e74f67f4'
  and ingredientes_principales = '["coliflor","aceite de oliva","semillas de calabaza"]'::jsonb;

-- Repollo salteado: + sésamo
update public.recipes
set ingredientes_principales = '["repollo","tofu","jengibre","sésamo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"repollo","unidad":"g"},{"cantidad":200,"nombre":"tofu","unidad":"g"},{"cantidad":10,"nombre":"jengibre","unidad":"g"},{"nombre":"sésamo","cantidad":10,"unidad":"g"}]'::jsonb,
    alergenos = '["soja","sesamo"]'::jsonb
where id = '4d7ee658-376f-4a24-a5b9-7fda01ba1a5b'
  and ingredientes_principales = '["repollo","tofu","jengibre"]'::jsonb;

-- Repollo salteado con semillas de sésamo y aceitunas: + sésamo
update public.recipes
set ingredientes_principales = '["repollo","tofu","aceitunas","sésamo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"repollo","unidad":"g"},{"cantidad":200,"nombre":"tofu","unidad":"g"},{"cantidad":40,"nombre":"aceitunas","unidad":"g"},{"nombre":"sésamo","cantidad":10,"unidad":"g"}]'::jsonb,
    alergenos = '["soja","sesamo"]'::jsonb
where id = '0cb54b8f-1571-4cc1-b018-ad5c941effc0'
  and ingredientes_principales = '["repollo","tofu","aceitunas"]'::jsonb;

-- Repollo salteado con semillas de sésamo y cilantro fresco: + sésamo
update public.recipes
set ingredientes_principales = '["repollo","tofu","cilantro","sésamo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"repollo","unidad":"g"},{"cantidad":200,"nombre":"tofu","unidad":"g"},{"cantidad":10,"nombre":"cilantro","unidad":"g"},{"nombre":"sésamo","cantidad":10,"unidad":"g"}]'::jsonb,
    alergenos = '["soja","sesamo"]'::jsonb
where id = '5194026b-43e9-4132-b0af-19dcf59988a5'
  and ingredientes_principales = '["repollo","tofu","cilantro"]'::jsonb;

-- Repollo salteado con semillas de sésamo y lima: + sésamo
update public.recipes
set ingredientes_principales = '["repollo","tofu","lima","sésamo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":300,"nombre":"repollo","unidad":"g"},{"cantidad":200,"nombre":"tofu","unidad":"g"},{"cantidad":1,"nombre":"lima","unidad":"unidades"},{"nombre":"sésamo","cantidad":10,"unidad":"g"}]'::jsonb,
    alergenos = '["soja","sesamo"]'::jsonb
where id = 'e9420560-6909-435a-9a34-62100aab1007'
  and ingredientes_principales = '["repollo","tofu","lima"]'::jsonb;

-- Repollo salteado con semillas de sésamo y semillas de calabaza: + sésamo
update public.recipes
set ingredientes_principales = '["repollo","tofu","semillas de calabaza","sésamo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"repollo","unidad":"g"},{"cantidad":200,"nombre":"tofu","unidad":"g"},{"cantidad":20,"nombre":"semillas de calabaza","unidad":"g"},{"nombre":"sésamo","cantidad":10,"unidad":"g"}]'::jsonb,
    alergenos = '["soja","sesamo"]'::jsonb
where id = '9ebe6499-bd0c-41e9-b620-c790914633e5'
  and ingredientes_principales = '["repollo","tofu","semillas de calabaza"]'::jsonb;

