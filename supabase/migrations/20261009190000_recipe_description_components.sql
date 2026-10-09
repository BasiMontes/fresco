-- FRESCO-880 (family 4 of 4, part 2): ten recipes whose DESCRIPTION names a component that
-- the ingredient list leaves out (the steps are generic, so the description is the recipe's
-- own text that backs the change, as in FRESCO-876).
--
--   Arroz negro con calamares + tinta de calamar     Ensalada de pasta fría       + aceitunas
--   Crema de calabacín (the one that says so) + aceite de oliva   Ensalada de pollo con curry + lechuga
--   Curry de garbanzos y espinacas + leche de coco   Ensalada griega               + aceitunas
--   Ensalada de garbanzos con atún (the one that says so) + aceite de oliva
--   Paella valenciana + conejo        Tacos de pescado con repollo + tortilla de maíz
--   Wrap de pollo con hummus + tortilla de trigo
--
-- `ingredientes_cantidades` gains the matching entry (recipes_ingredientes_cantidades_valid
-- needs every `nombre` listed); the quantities are estimates for the recipe's servings.
-- `alergenos` and `dieta` need no change: calamari is already declared as moluscos, the
-- wrap already declares gluten, and coconut milk, olives, lettuce, rabbit, olive oil and
-- corn tortillas add none. Each update only fires while the row still holds its old list.
--
-- Not changed, by decision (they stay in the review query as rows with a note in the ticket):
-- albóndigas, lomo, fideuá and seco de ternera (arroz is a serving suggestion), guacamole
-- (the nachos are the corn), creps ("sin huevo" is a negation).

-- Arroz negro con calamares: + tinta de calamar
update public.recipes
set ingredientes_principales = '["arroz","calamares","ajo","tomate","tinta de calamar"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":270,"nombre":"arroz","unidad":"g"},{"cantidad":450,"nombre":"calamares","unidad":"g"},{"cantidad":3,"nombre":"ajo","unidad":"dientes"},{"cantidad":1,"nombre":"tomate","unidad":"unidades"},{"nombre":"tinta de calamar","cantidad":12,"unidad":"g"}]'::jsonb
where id = '6e33ff5d-daee-4554-9e79-2aab81db38b4'
  and ingredientes_principales = '["arroz","calamares","ajo","tomate"]'::jsonb;

-- Crema de calabacín: + aceite de oliva
update public.recipes
set ingredientes_principales = '["calabacín","cebolla","patata","caldo de verduras","aceite de oliva"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":600,"nombre":"calabacín","unidad":"g"},{"cantidad":1,"nombre":"cebolla","unidad":"unidades"},{"cantidad":200,"nombre":"patata","unidad":"g"},{"cantidad":500,"nombre":"caldo de verduras","unidad":"ml"},{"nombre":"aceite de oliva","cantidad":2,"unidad":"cucharadas"}]'::jsonb
where id = '4861222e-eee8-41ce-becd-74e5ed969247'
  and ingredientes_principales = '["calabacín","cebolla","patata","caldo de verduras"]'::jsonb;

-- Curry de garbanzos y espinacas: + leche de coco
update public.recipes
set ingredientes_principales = '["garbanzos cocidos","espinacas","cebolla","ajo","leche de coco"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":400,"nombre":"garbanzos cocidos","unidad":"g"},{"cantidad":200,"nombre":"espinacas","unidad":"g"},{"cantidad":1,"nombre":"cebolla","unidad":"unidades"},{"cantidad":2,"nombre":"ajo","unidad":"dientes"},{"nombre":"leche de coco","cantidad":200,"unidad":"ml"}]'::jsonb
where id = '4942047f-734d-4103-8ef9-e6fe23eb2554'
  and ingredientes_principales = '["garbanzos cocidos","espinacas","cebolla","ajo"]'::jsonb;

-- Ensalada de garbanzos con atún: + aceite de oliva
update public.recipes
set ingredientes_principales = '["garbanzos","atún","pimiento rojo","aceite de oliva"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":150,"nombre":"garbanzos","unidad":"g"},{"cantidad":80,"nombre":"atún","unidad":"g"},{"cantidad":1,"nombre":"pimiento rojo","unidad":"unidades"},{"nombre":"aceite de oliva","cantidad":1,"unidad":"cucharadas"}]'::jsonb
where id = '5ed45a0d-4482-4c39-9107-172b5d0f8b60'
  and ingredientes_principales = '["garbanzos","atún","pimiento rojo"]'::jsonb;

-- Ensalada de pasta fría: + aceitunas
update public.recipes
set ingredientes_principales = '["pasta","atún en lata","tomate","aceitunas"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":160,"nombre":"pasta","unidad":"g"},{"cantidad":1,"nombre":"atún en lata","unidad":"unidades"},{"cantidad":2,"nombre":"tomate","unidad":"unidades"},{"nombre":"aceitunas","cantidad":40,"unidad":"g"}]'::jsonb
where id = 'd3996882-7bfb-443d-9272-4ee92924df11'
  and ingredientes_principales = '["pasta","atún en lata","tomate"]'::jsonb;

-- Ensalada de pollo con curry: + lechuga
update public.recipes
set ingredientes_principales = '["pollo","mayonesa","curry en polvo","lechuga"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":120,"nombre":"pollo","unidad":"g"},{"cantidad":1,"nombre":"mayonesa","unidad":"cucharadas"},{"cantidad":1,"nombre":"curry en polvo","unidad":"cucharaditas"},{"nombre":"lechuga","cantidad":80,"unidad":"g"}]'::jsonb
where id = 'e5b0c4e4-31b2-4e88-ba6e-53f6efdc6a93'
  and ingredientes_principales = '["pollo","mayonesa","curry en polvo"]'::jsonb;

-- Ensalada griega: + aceitunas
update public.recipes
set ingredientes_principales = '["tomate","pepino","queso feta","aceitunas"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":3,"nombre":"tomate","unidad":"unidades"},{"cantidad":1,"nombre":"pepino","unidad":"unidades"},{"cantidad":100,"nombre":"queso feta","unidad":"g"},{"nombre":"aceitunas","cantidad":50,"unidad":"g"}]'::jsonb
where id = '62f69d82-8f28-4dc3-b1d0-a6a5d08da9da'
  and ingredientes_principales = '["tomate","pepino","queso feta"]'::jsonb;

-- Paella valenciana: + conejo
update public.recipes
set ingredientes_principales = '["arroz","pollo","judías verdes","tomate","conejo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":360,"nombre":"arroz","unidad":"g"},{"cantidad":600,"nombre":"pollo","unidad":"g"},{"cantidad":200,"nombre":"judías verdes","unidad":"g"},{"cantidad":2,"nombre":"tomate","unidad":"unidades"},{"nombre":"conejo","cantidad":400,"unidad":"g"}]'::jsonb
where id = '660b29ce-db9a-486e-b0f4-e42b6652a5d0'
  and ingredientes_principales = '["arroz","pollo","judías verdes","tomate"]'::jsonb;

-- Tacos de pescado con repollo: + tortilla de maíz
update public.recipes
set ingredientes_principales = '["pescado blanco","repollo","lima","tortilla de maíz"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":150,"nombre":"pescado blanco","unidad":"g"},{"cantidad":100,"nombre":"repollo","unidad":"g"},{"cantidad":1,"nombre":"lima","unidad":"unidades"},{"nombre":"tortilla de maíz","cantidad":3,"unidad":"unidades"}]'::jsonb
where id = '33c4f870-84c9-4130-8ec8-5c729b6943cf'
  and ingredientes_principales = '["pescado blanco","repollo","lima"]'::jsonb;

-- Wrap de pollo con hummus: + tortilla de trigo
update public.recipes
set ingredientes_principales = '["pollo","hummus","espinacas","tortilla de trigo"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":100,"nombre":"pollo","unidad":"g"},{"cantidad":40,"nombre":"hummus","unidad":"g"},{"cantidad":40,"nombre":"espinacas","unidad":"g"},{"nombre":"tortilla de trigo","cantidad":1,"unidad":"unidades"}]'::jsonb
where id = 'ce112567-0d9a-4b6f-a846-57a54b15d352'
  and ingredientes_principales = '["pollo","hummus","espinacas"]'::jsonb;

