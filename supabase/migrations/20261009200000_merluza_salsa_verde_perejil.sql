-- FRESCO-880 (closing): "Merluza en salsa verde" describes itself as "salsa verde de perejil y ajo"
-- and its title is the dish, but `perejil` is not in the ingredient list. The description is the
-- recipe's own text that backs the change (same rule as FRESCO-876). `ingredientes_cantidades`
-- gains the matching entry (10 g, an estimate; recipes_ingredientes_cantidades_valid needs every
-- `nombre` listed). `alergenos` and `dieta` do not change: parsley adds no allergen. The update
-- only fires while the row still holds its old list.

update public.recipes
set ingredientes_principales = '["merluza", "ajo", "aceite de oliva", "perejil"]'::jsonb,
    ingredientes_cantidades = '[{"nombre": "merluza", "cantidad": 400, "unidad": "g"}, {"nombre": "ajo", "cantidad": 3, "unidad": "dientes"}, {"nombre": "aceite de oliva", "cantidad": 3, "unidad": "cucharadas"}, {"nombre": "perejil", "cantidad": 10, "unidad": "g"}]'::jsonb
where id = 'afe90ab0-8fcd-4abd-b7ff-046d5f3305bc'
  and ingredientes_principales = '["merluza", "ajo", "aceite de oliva"]'::jsonb;
