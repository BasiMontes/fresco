-- FRESCO-1058: a recipe's season is COMPUTED from its ingredients instead of typed by hand.
-- Rule: the season of a recipe is the set of seasons in which ALL its seasonal ingredients are in season.
-- A recipe with no seasonal ingredient is 'todo_el_ano'. When the ingredients share no season the recipe is
-- left untouched and listed for manual review (a conflict is a cooking decision, not something to guess).
--
-- Scope of the table: fresh fruit, vegetables, greens and herbs with a clear season in Spain. Fish, meat,
-- processed products (crushed, canned, frozen, dried, sauces) and pantry items are NOT in it, and neither
-- is tomate (sold all year, owner decision), so they never constrain a recipe. Names are matched exactly
-- (lower case) against `recipes.ingredientes_principales`.
--
-- The table is read-only data for the backend: RLS on, no policy, no grant to anon or authenticated.

create table if not exists public.ingredient_seasons (
  nombre text primary key check (nombre = lower(nombre)),
  temporadas text[] not null
    check (cardinality(temporadas) > 0 and temporadas <@ array['primavera', 'verano', 'otono', 'invierno']::text[])
);

comment on table public.ingredient_seasons is
  'FRESCO-1058. Seasonal ingredients (fresh produce and herbs with a clear season in Spain). Source for compute_recipe_temporada.';

alter table public.ingredient_seasons enable row level security;
revoke all on public.ingredient_seasons from public, anon, authenticated;
grant select on public.ingredient_seasons to service_role;

insert into public.ingredient_seasons (nombre, temporadas) values
  ('pimiento', array['verano', 'otono']),
  ('espinacas', array['otono', 'invierno']),
  ('calabacín', array['primavera', 'verano']),
  ('brócoli', array['otono', 'invierno']),
  ('berenjena', array['verano', 'otono']),
  ('apio', array['otono', 'invierno']),
  ('coliflor', array['otono', 'invierno']),
  ('manzana', array['otono', 'invierno']),
  ('pepino', array['verano']),
  ('lechuga', array['primavera', 'verano']),
  ('albahaca', array['verano']),
  ('espárragos', array['primavera']),
  ('kale', array['otono', 'invierno']),
  ('puerro', array['otono', 'invierno']),
  ('repollo', array['otono', 'invierno']),
  ('boniato', array['otono', 'invierno']),
  ('calabaza', array['otono']),
  ('pimiento rojo', array['verano', 'otono']),
  ('menta', array['primavera', 'verano']),
  ('guisantes', array['primavera']),
  ('frutos rojos', array['primavera', 'verano']),
  ('setas', array['otono']),
  ('coles de bruselas', array['otono', 'invierno']),
  ('judías verdes', array['primavera', 'verano']),
  ('espárragos trigueros', array['primavera']),
  ('pimiento verde', array['verano', 'otono']),
  ('alcachofas', array['invierno', 'primavera']),
  ('uvas', array['otono']),
  ('fresas', array['primavera']),
  ('lechuga romana', array['primavera', 'verano']),
  ('eneldo', array['primavera', 'verano']),
  ('arándanos', array['primavera', 'verano']),
  ('naranja', array['invierno']),
  ('cebollino', array['primavera', 'verano']),
  ('ajetes', array['primavera']),
  ('melón', array['verano']),
  ('pera', array['otono']),
  ('membrillo', array['otono']),
  ('berza', array['otono', 'invierno']),
  ('remolacha', array['otono', 'invierno']),
  ('grelos', array['invierno'])
on conflict (nombre) do update set temporadas = excluded.temporadas;

-- Returns the recipe's seasons in calendar order, ['todo_el_ano'] when no ingredient is seasonal, and NULL
-- when the seasonal ingredients share no season (manual review).
create or replace function public.compute_recipe_temporada(p_ingredientes jsonb)
returns text[]
language sql
stable
set search_path to 'public', 'pg_temp'
as $fn$
  with seasonal as (
    select s.temporadas
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_ingredientes) = 'array' then p_ingredientes else '[]'::jsonb end
    ) as i(nombre)
    join public.ingredient_seasons s on s.nombre = lower(i.nombre)
  ),
  common as (
    select array_agg(t.season order by t.ord) as seasons
    from unnest(array['primavera', 'verano', 'otono', 'invierno']) with ordinality as t(season, ord)
    where not exists (select 1 from seasonal where not (t.season = any (seasonal.temporadas)))
  )
  select case
    when not exists (select 1 from seasonal) then array['todo_el_ano']
    else (select seasons from common)
  end;
$fn$;

comment on function public.compute_recipe_temporada(jsonb) is
  'FRESCO-1058. Seasons shared by every seasonal ingredient of a recipe; todo_el_ano when none is seasonal; NULL on conflict.';

revoke execute on function public.compute_recipe_temporada(jsonb) from public, anon, authenticated;
grant execute on function public.compute_recipe_temporada(jsonb) to service_role;

-- Backfill: every recipe whose ingredients give a clear answer. Conflicts (NULL) keep their current value.
update public.recipes r
set temporada = to_jsonb(public.compute_recipe_temporada(r.ingredientes_principales))
where public.compute_recipe_temporada(r.ingredientes_principales) is not null
  and r.temporada is distinct from to_jsonb(public.compute_recipe_temporada(r.ingredientes_principales));
