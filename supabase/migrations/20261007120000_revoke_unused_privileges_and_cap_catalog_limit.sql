-- FRESCO-816 (audit-6 A6-S9, A6-S14): privileges nobody uses, and a bounded catalog page.
--
-- S9. Supabase's default privileges hand every new public table the full set to
-- `anon` and `authenticated`. RLS gates SELECT/INSERT/UPDATE/DELETE, but
-- TRUNCATE (which RLS does not apply to), TRIGGER, REFERENCES and MAINTAIN (VACUUM, LOCK TABLE) are never used by
-- the app (PostgREST does not expose TRUNCATE; the app creates no triggers or
-- foreign keys from a client role). Revoke them on the 16 tables that carry them,
-- and stop new tables inheriting them. Trigger functions are invoked by the
-- trigger machinery, which does not check EXECUTE, so revoking EXECUTE from the
-- client roles and PUBLIC changes nothing for the triggers and removes the direct
-- call path (two SECURITY DEFINER ones were executable by PUBLIC).
--
-- S14. get_catalog(): p_limit was unbounded (a caller could ask for every row) and
-- search_path lacked pg_temp last (a SECURITY DEFINER function should resolve
-- pg_temp after public so a caller-created temp object cannot shadow a name). The
-- client asks for page * 30 rows cumulatively ("load more"), so the ceiling must
-- cover the active catalog: 601 recipes today, 1000 leaves headroom. A catalog
-- that grows past 1000 active recipes needs this ceiling raised, or the client
-- moved to offset pagination.

revoke truncate, trigger, references, maintain on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
  end loop;
end
$$;

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
$function$;
