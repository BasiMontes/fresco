-- pgTAP: invariants of the REAL catalogue of the test database (FRESCO-1168, integral review F1).
-- Run by `supabase test db` (CI: the e2e job, right after `supabase db reset`).
--
-- The invariants about privileges and search paths used to be checked by reading the TEXT of one old migration
-- (tests/db/revoked-privileges-and-catalog-limit.test.ts), which could never see a later `create or replace`
-- undo it: four of them did. These read what the database actually is after every migration ran, so a future
-- migration that reintroduces any of them fails here.

begin;
select plan(6);

-- 1. A SECURITY DEFINER function runs with its owner's privileges, so its search path must name pg_temp last
--    (otherwise Postgres searches the temporary schema FIRST and a temp object can shadow what it uses).
select is_empty(
  $$select p.oid::regprocedure::text as security_definer_without_pg_temp
    from pg_proc p
    where p.prosecdef
      and p.pronamespace = 'public'::regnamespace
      and array_to_string(coalesce(p.proconfig, '{}'), ',') not ilike '%pg_temp%'
    order by 1$$,
  'every SECURITY DEFINER function in public has pg_temp in its search_path'
);

-- 2. Row level security on every table of public: the data API exposes the schema, and a table without RLS is
--    readable and writable by any role that holds a grant on it.
select is_empty(
  $$select c.relname::text as table_without_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
    order by 1$$,
  'every table in public has row level security enabled'
);

-- 3. What the anonymous role may execute is a short, reviewed list. These two are the helpers of CHECK
--    constraints on `recipes`, which Postgres evaluates with the invoker's privileges. Trigger functions are
--    never callable through the API and are left out. A new entry needs a reason written here.
select is_empty(
  $$select p.oid::regprocedure::text as function_executable_by_anon
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname not in ('recipe_ingredient_quantities_valid', 'recipe_ingredient_names_distinct')
    order by 1$$,
  'only the reviewed allow-list of functions in public is executable by anon'
);

-- 4. No client role writes an internal table. "Internal" is read from the catalogue itself: row level security on
--    and no policy at all means no client path was meant to exist (the job heartbeats, the Stripe event ledger,
--    the rate limits, the erasure record, the mark history...). A grant on one of them would be a hole that RLS
--    alone papers over.
select is_empty(
  $$select c.relname::text as internal_table_with_client_dml
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and not exists (select 1 from pg_policy pl where pl.polrelid = c.oid)
      and (has_table_privilege('anon', c.oid, 'insert,update,delete')
           or has_table_privilege('authenticated', c.oid, 'insert,update,delete'))
    order by 1$$,
  'no internal table (RLS on, no policy) has INSERT, UPDATE or DELETE for anon or authenticated'
);

-- 5. The anonymous role has no write path on any table of public: a visitor with no session changes nothing
--    through the data API. (A guest is an authenticated, anonymous-sign-in user, not the `anon` role.)
select is_empty(
  $$select c.relname::text as table_with_anon_dml
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and has_table_privilege('anon', c.oid, 'insert,update,delete')
    order by 1$$,
  'anon has no INSERT, UPDATE or DELETE on any table in public'
);

-- 6. The checks above are not vacuous: the catalogue has definer functions and internal tables to look at.
select cmp_ok(
  (select count(*)::int from pg_proc where prosecdef and pronamespace = 'public'::regnamespace)
  + (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
         and not exists (select 1 from pg_policy pl where pl.polrelid = c.oid)),
  '>', 15,
  'the catalogue has SECURITY DEFINER functions and internal tables to check (the invariants are not vacuous)'
);

select * from finish();
rollback;
