-- FRESCO-1063: the owner reviewed the 41 rows of `ingredient_seasons` one by one against the rule of ADR-0067
-- ("sold all year" is not seasonal, the same reason `tomate` is not in the table). 27 rows are removed, 14 stay.
--
-- Removed (found all year in a Spanish supermarket): pimiento, pimiento rojo, pimiento verde, espinacas,
-- calabacín, brócoli, berenjena, apio, coliflor, manzana, albahaca, lechuga, lechuga romana, pepino, puerro,
-- boniato, repollo, calabaza, menta, setas, judías verdes, uvas, arándanos, eneldo, cebollino, pera, remolacha.
-- Kept (a real season): espárragos, espárragos trigueros, ajetes, guisantes, alcachofas, fresas, frutos rojos,
-- melón, kale, berza, grelos, coles de bruselas, membrillo, naranja.
--
-- The table is the only input of `compute_recipe_temporada`, so a recipe whose ingredients lose a seasonal row
-- changes season (an ingredient that is no longer seasonal stops constraining it). The barrier trigger refuses an
-- active recipe whose stored season differs from `compute_recipe_season`, so the recipes are recomputed in the
-- same migration, exactly as 20261027170000 and 20261028090603 did. The 20261027 migrations are not edited.
--
-- Impact measured before writing this (read-only simulation over the whole catalogue, 1167 recipes, 219 active
-- ones change): active recipes in summer 126 -> 7, spring 63 -> 30, autumn 223 -> 108, winter 158 -> 113,
-- all year 215 -> 395; the 11 recipes that were in conflict (ingredients sharing no season) resolve by themselves.

do $prune$
declare
  v_deleted integer;
begin
  delete from public.ingredient_seasons
  where nombre in (
    'pimiento', 'pimiento rojo', 'pimiento verde', 'espinacas', 'calabacín', 'brócoli', 'berenjena', 'apio',
    'coliflor', 'manzana', 'albahaca', 'lechuga', 'lechuga romana', 'pepino', 'puerro', 'boniato', 'repollo',
    'calabaza', 'menta', 'setas', 'judías verdes', 'uvas', 'arándanos', 'eneldo', 'cebollino', 'pera', 'remolacha'
  );
  get diagnostics v_deleted = row_count;

  -- A different count means the table is not the one the owner reviewed: stop instead of guessing.
  if v_deleted <> 27 then
    raise exception 'FRESCO-1063: se esperaba borrar 27 filas de ingredient_seasons y se borraron %', v_deleted;
  end if;
end
$prune$;

-- With the rows gone, the cold soups lost their only seasonal ingredient (pepino, pimiento) and the dish rule of
-- 20261028082818 would send them to autumn and winter, like any soup. Same case as the salmorejo: a per-slug
-- exception keeps them in summer. The falafel loses its mint and, as a legume dish, would fall to autumn and
-- winter, which it is not: it is eaten all year, like the lentil burger. These are cooking decisions, so they are
-- listed one by one here and not inferred. The two tomato-and-basil soups follow the category rule on purpose.
insert into public.recipe_season_exceptions (slug, temporadas, motivo) values
  ('gazpacho-andaluz', array['verano'], 'Cold soup: without pepino and pimiento in ingredient_seasons the category rule would send it to autumn and winter.'),
  ('gazpacho-andaluz-con-pepino-b49', array['verano'], 'Cold soup: same as gazpacho-andaluz.'),
  ('crema-fria-aguacate-pepino', array['verano'], 'Cold cream: it is served cold, so summer.'),
  ('crema-fria-de-con-lima-con-ajo-asado-24', array['verano'], 'Cold cream: it is served cold, so summer.'),
  ('crema-fria-de-con-lima-con-cilantro-22', array['verano'], 'Cold cream: it is served cold, so summer.'),
  ('crema-fria-de-con-lima-con-limon-21', array['verano'], 'Cold cream: it is served cold, so summer.'),
  ('crema-fria-de-con-lima-con-semillas-de-lino-23', array['verano'], 'Cold cream: it is served cold, so summer.'),
  ('falafel-con-salsa-de-yogur-b34', array['todo_el_ano'], 'Fried chickpea balls, not a stew: eaten all year.')
on conflict (slug) do update set temporadas = excluded.temporadas, motivo = excluded.motivo;

-- Recompute every recipe whose answer changed. A conflict (NULL) and a draft with no season are left alone, as in
-- 20261028090603. The barrier trigger fires per row and accepts exactly the value written here.
update public.recipes r
set temporada = to_jsonb(public.compute_recipe_season(r.ingredientes_principales, r.slug, r.clasificacion))
where r.temporada is not null
  and public.compute_recipe_season(r.ingredientes_principales, r.slug, r.clasificacion) is not null
  and r.temporada is distinct from to_jsonb(public.compute_recipe_season(r.ingredientes_principales, r.slug, r.clasificacion));

-- Refuse to finish over an active recipe that still breaks the rule.
do $check$
declare
  v_broken text;
begin
  select string_agg('  - ' || r.nombre || ': ' || public.recipe_temporada_problem(r.temporada, r.ingredientes_principales, r.slug, r.clasificacion), E'\n' order by r.nombre)
    into v_broken
  from public.recipes r
  where r.activo and public.recipe_temporada_problem(r.temporada, r.ingredientes_principales, r.slug, r.clasificacion) is not null;

  if v_broken is not null then
    raise exception E'Hay recetas activas con temporada incoherente tras podar ingredient_seasons:\n%', v_broken;
  end if;
end
$check$;
