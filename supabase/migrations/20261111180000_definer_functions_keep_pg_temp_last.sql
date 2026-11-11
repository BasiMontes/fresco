-- FRESCO-1168 (integral review F1): every SECURITY DEFINER function in `public` resolves `pg_temp` last again.
--
-- FRESCO-816 (20261007160000) set `search_path = public, pg_temp` on every SECURITY DEFINER function. Later
-- CREATE OR REPLACE statements rewrote some of them with `set search_path = public` and dropped it again. With
-- `pg_temp` not named, Postgres searches it FIRST: a role that can create temporary tables could shadow a
-- table or function the definer function uses. PostgREST cannot create temp tables, so it was not reachable
-- through the API, but a definer function runs with its owner's privileges and the rule is cheap to keep.
--
-- Hosted on 2026-11-10: copy_meal_plan_to_week, jsonb_add_item, prevent_client_subscription_writes,
-- reassign_guest_data and rls_auto_enable. The migrations of FRESCO-1155 (swap_meal_plan_slots) and FRESCO-1184
-- (the three mark readers) did it again with `set search_path = public`; they are covered here too.
--
-- This does what 20261007160000 did, but for every definer function that does not name `pg_temp`, whatever its
-- current search_path, so the next regression is fixed by the same statement. `rls_auto_enable` is the one that
-- keeps `pg_catalog` first (it is an event trigger the platform installs). The fix is also pinned by a catalogue
-- test (supabase/tests/catalog_invariants.test.sql) that fails when a later migration drops `pg_temp` again.

do $$
declare
  fn record;
  new_path text;
begin
  for fn in
    select p.oid::regprocedure as signature,
           array_to_string(coalesce(p.proconfig, '{}'), ',') as config
    from pg_proc p
    where p.prosecdef
      and p.pronamespace = 'public'::regnamespace
      and array_to_string(coalesce(p.proconfig, '{}'), ',') not ilike '%pg_temp%'
    order by 1
  loop
    new_path := case when fn.config like '%search_path=pg_catalog%' then 'pg_catalog, pg_temp' else 'public, pg_temp' end;
    execute format('alter function %s set search_path = %s', fn.signature, new_path);
    raise notice 'pg_temp last on %: search_path = %', fn.signature, new_path;
  end loop;
end
$$;
