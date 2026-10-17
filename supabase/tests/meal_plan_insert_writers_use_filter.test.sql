-- pgTAP test — FRESCO-994 (audit-7b A7-TEST-02): every function that INSERTs into
-- meal_plan_recipes reaches the food-safety filter.
--
-- `get_filtered_recipes` is the one structural food-safety enforcement point
-- (ADR-0001). `copy_meal_plan_to_week` inserted slots without it and nothing
-- noticed: the suite tested each function's mechanics, never "does a new writer
-- go through the filter". This test reads the live function bodies from the
-- catalog (`pg_proc` / `pg_get_functiondef`), so a NEW writer fails it until it
-- either calls `get_filtered_recipes` or is added to the exemption list below
-- with the reason it is safe.
--
-- Scope: INSERT writers, as the audit card asks. UPDATE writers of recipe_id
-- (swap, confirm substitution, reassign) move or re-check recipes that are
-- already in a plan and are covered by their own tests.
--
-- Run by `supabase test db` (CI: the e2e job in .github/workflows/pr-check.yml).

begin;
select plan(5);

-- ── The writers, from the catalog ──────────────────────────────────────
-- The inner select with `offset 0` keeps the planner from calling
-- pg_get_functiondef on aggregates (it raises for them) before the prokind filter.
create temp table writers as
select p.oid as fn_oid, p.proname::text as name, pg_get_functiondef(p.oid) as def
from (
  select p.*
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
  offset 0
) p
where pg_get_functiondef(p.oid) ~* 'insert\s+into\s+(public\.)?meal_plan_recipes\M';

-- Functions that INSERT into meal_plan_recipes WITHOUT calling the filter, and why
-- that is acceptable. An entry is valid only while the function is closed to
-- `anon` and `authenticated` (asserted below), so it can never be reached with a
-- caller-chosen recipe id.
create temp table exempt (name text primary key, reason text not null);
insert into exempt values
  ('create_meal_plan',
   'service_role only; called by the generate-meal-plan Edge Function, whose menu selector builds the menu from get_filtered_recipes');

-- ── Case 1: the introspection sees the writers we know about ───────────
-- Guards against a vacuous pass (a regex that matches nothing proves nothing).
select ok(
  exists (select 1 from writers where name = 'copy_meal_plan_to_week')
    and exists (select 1 from writers where name = 'create_meal_plan'),
  'introspection finds copy_meal_plan_to_week and create_meal_plan as INSERT writers'
);

-- ── Case 2: every non-exempt writer calls get_filtered_recipes ─────────
select is(
  coalesce((
    select string_agg(w.name, ', ' order by w.name)
    from writers w
    where w.name not in (select name from exempt)
      and w.def !~* 'get_filtered_recipes'
  ), ''),
  '',
  'every function that inserts into meal_plan_recipes goes through get_filtered_recipes (offenders listed)'
);

-- ── Case 3: copy_meal_plan_to_week, the audit finding, is covered ──────
select ok(
  (select def ~* 'get_filtered_recipes' from writers where name = 'copy_meal_plan_to_week'),
  'copy_meal_plan_to_week calls get_filtered_recipes'
);

-- ── Case 4: no stale exemption (the function still exists and still writes) ─
select is(
  coalesce((
    select string_agg(e.name, ', ' order by e.name)
    from exempt e
    where e.name not in (select name from writers)
  ), ''),
  '',
  'every exemption is still an INSERT writer (remove an entry when its function stops writing)'
);

-- ── Case 5: an exempt writer is closed to anon and authenticated ───────
select is(
  coalesce((
    select string_agg(w.name, ', ' order by w.name)
    from writers w
    where w.name in (select name from exempt)
      and (has_function_privilege('anon', w.fn_oid, 'execute')
        or has_function_privilege('authenticated', w.fn_oid, 'execute'))
  ), ''),
  '',
  'exempt writers are not executable by anon or authenticated'
);

select * from finish();
rollback;
