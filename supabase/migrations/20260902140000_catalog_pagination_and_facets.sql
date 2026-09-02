-- FRESCO-384 (audit-4 A4-M7): the /recipes ("Biblioteca") catalog shipped the
-- whole safety-filtered recipe set (~1000 jsonb rows, ~1.1 MB) to the client,
-- which then did search, four-section filtering, and per-render facet counts
-- in memory.
--
-- get_catalog() moves all of that server-side and returns one page plus the
-- facet counts as a single jsonb document:
--
--   { "recipes": [ {id, nombre, foto_url, dieta, clasificacion, meta}, ... ],
--     "total":   <int>,
--     "facets":  { "mealTypes": {...}, "cocinas": {...},
--                  "dietas": {...}, "alergenos": {...} } }
--
-- The safety pre-filter (allergen / diet / disliked-ingredient exclusion from
-- the caller's profile) is NOT reimplemented here — get_catalog reads from
-- public.get_filtered_recipes(p_user_id), so that one definition stays the
-- single source of the food-safety boundary.
--
-- Facet semantics mirror the client's old countWithOption(): for section S,
-- option O, the count is "how many recipes remain if O were the only value
-- checked in S, keeping every OTHER section's current selection". The dieta
-- key list and allergen vocab below are literal — they mirror
-- lib/recipes/labels.ts (DIETA_LABELS) and lib/constants/dietary-options.ts
-- (ALERGENO_OPTIONS), the latter already pinned by the recipes_alergenos_vocab
-- CHECK from 20260901073555. mealTypes and cocinas are derived from the data.

create or replace function public.get_catalog(
  p_user_id     uuid,
  p_search      text    default null,
  p_meal_types  text[]  default '{}',
  p_cocinas     text[]  default '{}',
  p_dietas      text[]  default '{}',
  p_alergenos   text[]  default '{}',
  p_limit       int     default 30,
  p_offset      int     default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search  text := nullif(btrim(coalesce(p_search, '')), '');
  v_result  jsonb;
begin
  if p_user_id <> auth.uid() then
    raise exception 'get_catalog: caller does not own profile %', p_user_id;
  end if;

  with
  base as (
    -- Food-safety boundary lives in get_filtered_recipes(); apply free-text
    -- search on top of it.
    select r.id, r.nombre, r.foto_url, r.dieta, r.clasificacion, r.meta, r.alergenos
    from public.get_filtered_recipes(p_user_id) r
    where v_search is null
       or r.nombre ilike '%' || v_search || '%'
       or exists (
         select 1
         from jsonb_array_elements_text(coalesce(r.ingredientes_principales, '[]'::jsonb)) as e(val)
         where e.val ilike '%' || v_search || '%'
       )
  ),
  flagged as (
    select
      b.*,
      (cardinality(p_meal_types) = 0 or (b.clasificacion->>'tipo_plato') = any (p_meal_types)) as m_ok,
      (cardinality(p_cocinas)    = 0 or (b.clasificacion->>'cocina')     = any (p_cocinas))    as c_ok,
      (cardinality(p_dietas)     = 0 or exists (
        select 1 from unnest(p_dietas) as d(key)
        where coalesce((b.dieta->>d.key)::boolean, false)
      )) as d_ok,
      (cardinality(p_alergenos)  = 0 or not exists (
        select 1
        from jsonb_array_elements_text(coalesce(b.alergenos, '[]'::jsonb)) as ra(val)
        where lower(ra.val) = any (select lower(x) from unnest(p_alergenos) as t(x))
      )) as a_ok
    from base b
  ),
  matched as (
    select * from flagged where m_ok and c_ok and d_ok and a_ok
  ),
  page_rows as (
    select id, nombre, foto_url, dieta, clasificacion, meta
    from matched
    order by id
    -- null / <= 0 limit falls back to a sane page rather than returning
    -- nothing (greatest(null, 0) is 0).
    limit coalesce(nullif(greatest(p_limit, 0), 0), 30)
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  facet_mealtypes as (
    select jsonb_object_agg(tp, n) as v from (
      select f.clasificacion->>'tipo_plato' as tp, count(*) as n
      from flagged f
      where f.c_ok and f.d_ok and f.a_ok
        and f.clasificacion->>'tipo_plato' is not null
      group by 1
    ) x
  ),
  facet_cocinas as (
    select jsonb_object_agg(co, n) as v from (
      select f.clasificacion->>'cocina' as co, count(*) as n
      from flagged f
      where f.m_ok and f.d_ok and f.a_ok
        and f.clasificacion->>'cocina' is not null
      group by 1
    ) x
  ),
  facet_dietas as (
    select jsonb_object_agg(k, n) as v from (
      select d.k,
             count(*) filter (where coalesce((f.dieta->>d.k)::boolean, false)) as n
      from flagged f
      cross join unnest(array[
        'vegetariano','vegano','sin_gluten','sin_lactosa','sin_huevo',
        'bajo_fodmap','keto','paleo','halal','kosher'
      ]) as d(k)
      where f.m_ok and f.c_ok and f.a_ok
      group by d.k
    ) x
  ),
  facet_alergenos as (
    select jsonb_object_agg(a, n) as v from (
      select t.a,
             count(*) filter (
               where not exists (
                 select 1
                 from jsonb_array_elements_text(coalesce(f.alergenos, '[]'::jsonb)) as ra(val)
                 where lower(ra.val) = lower(t.a)
               )
             ) as n
      from flagged f
      cross join unnest(array[
        'gluten','lactosa','huevo','frutos_de_cascara','cacahuetes','soja',
        'pescado','crustaceos','moluscos','sesamo','apio','sulfitos'
      ]) as t(a)
      where f.m_ok and f.c_ok and f.d_ok
      group by t.a
    ) x
  )
  select jsonb_build_object(
    'recipes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nombre', p.nombre,
        'foto_url', p.foto_url,
        'dieta', p.dieta,
        'clasificacion', p.clasificacion,
        'meta', p.meta
      ))
      from page_rows p
    ), '[]'::jsonb),
    'total', (select count(*) from matched),
    'facets', jsonb_build_object(
      'mealTypes', coalesce((select v from facet_mealtypes), '{}'::jsonb),
      'cocinas',   coalesce((select v from facet_cocinas),   '{}'::jsonb),
      'dietas',    coalesce((select v from facet_dietas),    '{}'::jsonb),
      'alergenos', coalesce((select v from facet_alergenos), '{}'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_catalog(uuid, text, text[], text[], text[], text[], int, int) from public, anon;
grant  execute on function public.get_catalog(uuid, text, text[], text[], text[], text[], int, int) to authenticated;

comment on function public.get_catalog(uuid, text, text[], text[], text[], text[], int, int) is
  'FRESCO-384: paginated /recipes catalog + server-side facet counts. Reads get_filtered_recipes() for the food-safety base set. Returns jsonb {recipes, total, facets}.';
