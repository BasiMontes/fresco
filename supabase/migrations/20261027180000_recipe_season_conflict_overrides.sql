-- FRESCO-1058: the five active recipes whose ingredients share no season (compute_recipe_temporada returns
-- NULL for them, so the backfill of 20261027170000 left them alone). The owner decided each by when the
-- dish is wanted, not only by when its ingredients are in season: they are hearty, hot dishes.
--
-- A person decides these, the function does not: the values are pinned by recipe id and by the slug as a
-- guard, so a renamed or replaced recipe is never overwritten by mistake.

update public.recipes as r
set temporada = v.temporada::jsonb
from (values
  ('7267271d-5850-4a8d-bbb4-a66304e39228'::uuid, 'arroz-caldoso-pollo-verduras',                   '["otono", "invierno"]'),
  ('65383e60-8da3-455f-82d9-3f95723c2592'::uuid, 'arroz-meloso-con-setas-y-guisantes-b7',          '["otono", "invierno"]'),
  ('daac3e97-4ab6-4ee7-8e0c-9b3628c98d26'::uuid, 'ternera-salsa-guisantes',                        '["otono", "invierno"]'),
  ('eb5ad4c9-43a2-46fd-be87-5b6fbc8f6a25'::uuid, 'arroz-con-pollo-tradicional',                    '["otono"]'),
  ('154f8b38-3815-4f7a-a765-8af1ee20d774'::uuid, 'crema-de-calabacin-con-especias-version-ligera', '["otono", "invierno"]')
) as v(id, slug, temporada)
where r.id = v.id and r.slug = v.slug;
