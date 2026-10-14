-- FRESCO-912 (audit C-08): the allergen vocabulary covered 12 of the 14 allergens the EU
-- requires to be declared. `mostaza` and `altramuces` could be neither declared by a user nor
-- tagged on a recipe. Measured on the linked project on 2026-10-13: 0 of 538 active recipes
-- mention either in ingredients, quantities, name, short description or steps, so there is
-- nothing to re-tag today; tests/db/allergen-vocabulary.test.ts fails if one ever does without
-- carrying the tag.
--
-- Three places hold the list by hand and are widened together (superset of the old one, so every
-- existing row still satisfies it):
--   1. CHECK recipes_alergenos_vocab on public.recipes
--   2. CHECK ingredient_substitutions_alergenos_vocab on public.ingredient_substitutions
--   3. the facet list inside public.get_catalog (counts per allergen for the catalog filter)
-- lib/constants/dietary-options.ts (ALERGENO_OPTIONS) is the application-side source of truth.

-- ── 1. recipes.alergenos ────────────────────────────────────────────────────

alter table public.recipes drop constraint recipes_alergenos_vocab;
alter table public.recipes
  add constraint recipes_alergenos_vocab
  check (
    coalesce(alergenos, '[]'::jsonb) <@ '["altramuces","apio","cacahuetes","crustaceos","frutos_de_cascara","gluten","huevo","lactosa","mostaza","moluscos","pescado","sesamo","soja","sulfitos"]'::jsonb
  );

-- ── 2. ingredient_substitutions.alergenos ───────────────────────────────────

alter table public.ingredient_substitutions drop constraint ingredient_substitutions_alergenos_vocab;
alter table public.ingredient_substitutions
  add constraint ingredient_substitutions_alergenos_vocab
  check (
    alergenos <@ array['altramuces','apio','cacahuetes','crustaceos','frutos_de_cascara','gluten','huevo','lactosa','mostaza','moluscos','pescado','sesamo','soja','sulfitos']::text[]
  );

-- ── 3. get_catalog facets (body identical to 20261007120000 except the allergen array) ──

CREATE OR REPLACE FUNCTION public.get_catalog(p_user_id uuid, p_search text DEFAULT NULL::text, p_meal_types text[] DEFAULT '{}'::text[], p_cocinas text[] DEFAULT '{}'::text[], p_dietas text[] DEFAULT '{}'::text[], p_alergenos text[] DEFAULT '{}'::text[], p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_search  text := nullif(btrim(coalesce(p_search, '')), '');
  v_result  jsonb;
begin
  if p_user_id <> auth.uid() then
    raise exception 'get_catalog: caller does not own profile %', p_user_id;
  end if;

  with
  base as (
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
    limit least(coalesce(nullif(greatest(p_limit, 0), 0), 30), 1000)
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
        'pescado','crustaceos','moluscos','sesamo','apio','sulfitos','mostaza','altramuces'
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
$function$;
