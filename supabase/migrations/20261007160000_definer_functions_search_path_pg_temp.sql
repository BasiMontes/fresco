-- FRESCO-816 (audit-6 A6-S14): pg_temp last on every SECURITY DEFINER search_path.
--
-- A SECURITY DEFINER function resolves unqualified names through its search_path. When
-- pg_temp is not listed, Postgres searches the session's temporary schema FIRST, so a
-- caller who can create temporary objects could shadow a name the function uses. Every
-- function here qualifies `public.` today, so the risk is low, but listing pg_temp last
-- closes the class instead of relying on that habit.
--
-- Only the functions whose search_path is exactly `public` are touched: 17 of them, the
-- ones this project wrote. `get_catalog` already got the same setting in 20261007120000,
-- and `rls_auto_enable` (`pg_catalog`) is Supabase's own and is left alone.
-- Only the setting changes; the bodies, grants and owners do not.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and 'search_path=public' = any (coalesce(p.proconfig, '{}'))
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.signature);
  end loop;
end
$$;
