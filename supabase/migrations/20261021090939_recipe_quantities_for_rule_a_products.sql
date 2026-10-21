-- FRESCO-1038: rule A of 20261019100000 (FRESCO-997) appended the products a recipe's steps name but its
-- ingredient list did not (curry en polvo, bechamel, crema de limón, vinagre, salsa de soja) to
-- `ingredientes_principales` only. A recipe that carries `ingredientes_cantidades` (FRESCO-863/ADR-0042)
-- then had a principal with no quantity row, and the shopping list, which prefers the recipe's own
-- quantity and falls back to BASE_QUANTITIES, printed "1 unidades" for the four products BASE_QUANTITIES
-- does not know. No ingredient and no allergen was lost; the amount was wrong.
--
-- One row per product, for `meta.raciones` servings of that recipe (the column's contract). The amounts are
-- estimates a cook would use: curry powder 6 g for 2 servings, bechamel 400 ml for the 4 of the moussaka,
-- lemon curd 250 g for the 6 of the tart, 1 spoon of vinegar to poach eggs for 1, soy sauce 30 ml for the
-- pad thai (the ingredient dictionary's own portion). "caldo de verduras" (19 recipes) is left alone on
-- purpose: BASE_QUANTITIES already answers 500 ml for it.
--
-- Guarded: a row is appended only while the recipe carries quantities, the name is one of its principals
-- (recipes_ingredientes_cantidades_valid requires it) and no row of that name exists yet, so a rerun
-- updates 0 rows and a later edit is never overwritten. The local seed carries no quantities, so there
-- this changes nothing; it is hosted-catalogue data, like the other FRESCO-863 backfills.

update public.recipes as r
set ingredientes_cantidades = r.ingredientes_cantidades
  || jsonb_build_array(jsonb_build_object('nombre', v.nombre, 'cantidad', v.cantidad, 'unidad', v.unidad))
from (values
  ('fc8662d7-c5f4-4b26-9ad7-664e18ab36db'::uuid, 'curry en polvo', 6::numeric, 'g'),
  ('4942047f-734d-4103-8ef9-e6fe23eb2554'::uuid, 'curry en polvo', 6::numeric, 'g'),
  ('9e24ff0a-3d62-4f35-b101-2e34e773bbd0'::uuid, 'curry en polvo', 6::numeric, 'g'),
  ('e296d8b0-285c-4f47-a762-5b617f6740a8'::uuid, 'bechamel', 400::numeric, 'ml'),
  ('eb7514bb-43c6-4dc1-8222-353257be7f80'::uuid, 'crema de limón', 250::numeric, 'g'),
  ('48bfc33c-2fb1-457b-ad42-4c6af3ff3315'::uuid, 'vinagre', 1::numeric, 'cucharadas'),
  ('2504b5b4-40fc-471b-b949-59c940220ade'::uuid, 'salsa de soja', 30::numeric, 'ml')
) as v(id, nombre, cantidad, unidad)
where r.id = v.id
  and r.ingredientes_cantidades is not null
  and r.ingredientes_principales ? v.nombre
  and not exists (
    select 1
    from jsonb_array_elements(r.ingredientes_cantidades) as c(item)
    where c.item ->> 'nombre' = v.nombre
  );
