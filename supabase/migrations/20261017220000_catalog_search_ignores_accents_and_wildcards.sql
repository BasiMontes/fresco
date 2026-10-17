-- FRESCO-1011 (audit 7b: A7-LOGIC-06, A7-UI-07): the Biblioteca search did not ignore accents ('salmon'
-- did not find 'salmón', 'limon' not 'limón'), and `%` or `_` typed in the box were passed to ILIKE as
-- wildcards, so searching `%` returned the whole catalogue.
--
-- Two changes, nothing else:
--   1. `unaccent` (a free, trusted extension on Supabase) behind an immutable wrapper, `public.f_unaccent`.
--      The extension lives in the `extensions` schema, which `get_catalog`'s `search_path = public` does not
--      see, so the wrapper qualifies it; calling `unaccent` with an explicit dictionary is what makes it safe
--      to declare IMMUTABLE.
--   2. `get_catalog` escapes `\`, `%` and `_` in the search term, removes accents from the term and from
--      the columns it matches, and compares with ILIKE.
--
-- The rest of `get_catalog` is the CURRENT definition (20261013120000: `pg_temp` last on the search_path, the
-- `p_limit` ceiling, the mustard and lupin vocabulary), unchanged: still SECURITY DEFINER with an
-- actor bind at step 0 (`p_user_id <> auth.uid()`), still reads only from `get_filtered_recipes(p_user_id)`,
-- so every row is the caller's own safety-filtered catalogue; the search only narrows it. The spoof against
-- the real database is proven by tests/db/security-definer-spoof.test.ts.

create extension if not exists unaccent with schema extensions;

create or replace function public.f_unaccent(p_text text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p_text)
$$;

revoke execute on function public.f_unaccent(text) from public, anon;
grant  execute on function public.f_unaccent(text) to authenticated, service_role;

-- CREATE OR REPLACE keeps the function's privileges (revoked from public and anon, granted to authenticated).

CREATE OR REPLACE FUNCTION public.get_catalog(p_user_id uuid, p_search text DEFAULT NULL::text, p_meal_types text[] DEFAULT '{}'::text[], p_cocinas text[] DEFAULT '{}'::text[], p_dietas text[] DEFAULT '{}'::text[], p_alergenos text[] DEFAULT '{}'::text[], p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_search  text := nullif(btrim(coalesce(p_search, '')), '');
  -- FRESCO-1011: `%`, `_` and `\` in the search box are literal characters, not ILIKE wildcards, and
  -- accents are ignored on both sides, so 'salmon' finds 'salmón' and '%' no longer lists the catalogue.
  v_pattern text;
  v_result  jsonb;
begin
  if p_user_id <> auth.uid() then
    raise exception 'get_catalog: caller does not own profile %', p_user_id;
  end if;

  if v_search is not null then
    v_pattern := '%' || public.f_unaccent(replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_')) || '%';
  end if;

  with
  base as (
    select r.id, r.nombre, r.foto_url, r.dieta, r.clasificacion, r.meta, r.alergenos
    from public.get_filtered_recipes(p_user_id) r
    where v_search is null
       or public.f_unaccent(r.nombre) ilike v_pattern
       or exists (
         select 1
         from jsonb_array_elements_text(coalesce(r.ingredientes_principales, '[]'::jsonb)) as e(val)
         where public.f_unaccent(e.val) ilike v_pattern
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
