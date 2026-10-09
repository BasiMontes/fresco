-- FRESCO-880 (description family): four recipes whose description AND steps use an
-- ingredient that the list leaves out. Same rule as FRESCO-876: the recipe's own text backs
-- the change.
--
--   * Bowl de quinoa con aguacate: "Aliñar con limón y aceite de oliva" -> + limón
--   * Ensalada waldorf con pollo: "Mezclar con manzana, nueces y mayonesa" -> + mayonesa
--   * Espaguetis a la carbonara: "huevo, panceta y queso pecorino" -> + queso pecorino
--   * Poke bowl de atún y edamame: "Cocer el arroz y dejar enfriar" -> + arroz
--
-- `ingredientes_cantidades` gains the matching entry (recipes_ingredientes_cantidades_valid
-- needs every `nombre` listed). `alergenos` and `dieta` do not change: the waldorf already
-- declares huevo, the carbonara already declares lactosa, and limón and arroz break nothing.
-- Each update only fires while the row still holds the exact old list.

-- Bowl de quinoa con aguacate: + limón
update public.recipes
set ingredientes_principales = '["quinoa","aguacate","garbanzos","limón"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":70,"nombre":"quinoa","unidad":"g"},{"cantidad":0.5,"nombre":"aguacate","unidad":"unidades"},{"cantidad":80,"nombre":"garbanzos","unidad":"g"},{"nombre":"limón","cantidad":0.5,"unidad":"unidades"}]'::jsonb
where id = '70dfccb1-406e-46c3-9cdc-f3eb00b31e15'
  and ingredientes_principales = '["quinoa","aguacate","garbanzos"]'::jsonb;

-- Ensalada waldorf con pollo: + mayonesa
update public.recipes
set ingredientes_principales = '["pollo","manzana","nueces","mayonesa"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":100,"nombre":"pollo","unidad":"g"},{"cantidad":1,"nombre":"manzana","unidad":"unidades"},{"cantidad":20,"nombre":"nueces","unidad":"g"},{"nombre":"mayonesa","cantidad":2,"unidad":"cucharadas"}]'::jsonb
where id = 'ae4f6c64-72ea-4889-9c87-252678307dab'
  and ingredientes_principales = '["pollo","manzana","nueces"]'::jsonb;

-- Espaguetis a la carbonara: + queso pecorino
update public.recipes
set ingredientes_principales = '["espaguetis","huevo","panceta","queso pecorino"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":200,"nombre":"espaguetis","unidad":"g"},{"cantidad":3,"nombre":"huevo","unidad":"unidades"},{"cantidad":100,"nombre":"panceta","unidad":"g"},{"nombre":"queso pecorino","cantidad":40,"unidad":"g"}]'::jsonb
where id = '304044ae-bb46-4f10-a607-9304188914f2'
  and ingredientes_principales = '["espaguetis","huevo","panceta"]'::jsonb;

-- Poke bowl de atún y edamame: + arroz
update public.recipes
set ingredientes_principales = '["atún","edamame","aguacate","arroz"]'::jsonb,
    ingredientes_cantidades = '[{"cantidad":120,"nombre":"atún","unidad":"g"},{"cantidad":60,"nombre":"edamame","unidad":"g"},{"cantidad":1,"nombre":"aguacate","unidad":"unidades"},{"nombre":"arroz","cantidad":80,"unidad":"g"}]'::jsonb
where id = '26116c3a-baa3-4881-9407-202d914e0fa5'
  and ingredientes_principales = '["atún","edamame","aguacate"]'::jsonb;

