-- pgTAP structural guard for FRESCO-777 (audit-6 A6-S4 + A6-S5).
--
-- `authenticated` must not be able to INSERT into `meal_plans` or
-- `meal_plan_recipes`: the only writer is the `generate-meal-plan` Edge
-- Function (service role), after its own rate limit, entitlement and allergen
-- checks. Otherwise a signed-in caller could forge slots (estado, rating,
-- recipe_id, sustitucion_ingrediente) or create plans without those checks.
--
-- The behavioural half (real PostgREST denial, shopping_lists ownership on
-- INSERT/UPDATE) lives in tests/db/meal-plan-insert-paths.test.ts.
--
-- Run by `supabase test db` (CI: the e2e job in .github/workflows/pr-check.yml).

begin;
select plan(8);

select ok(
  not has_table_privilege('authenticated', 'public.meal_plans', 'INSERT'),
  'authenticated cannot INSERT into meal_plans'
);

select ok(
  not has_table_privilege('authenticated', 'public.meal_plan_recipes', 'INSERT'),
  'authenticated cannot INSERT into meal_plan_recipes'
);

select ok(
  not has_table_privilege('anon', 'public.meal_plans', 'INSERT')
    and not has_table_privilege('anon', 'public.meal_plan_recipes', 'INSERT'),
  'anon cannot INSERT into either table'
);

select ok(
  has_table_privilege('service_role', 'public.meal_plans', 'INSERT')
    and has_table_privilege('service_role', 'public.meal_plan_recipes', 'INSERT'),
  'service_role can INSERT (generate-meal-plan writes with it)'
);

-- No client INSERT policy is left behind: if the privilege is ever re-granted
-- by accident, the tables fail closed instead of reopening the hole.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename in ('meal_plans', 'meal_plan_recipes')
      and cmd = 'INSERT'),
  0,
  'no INSERT policy remains on meal_plans / meal_plan_recipes'
);

-- shopping_lists keeps its authenticated INSERT but must check plan ownership.
select ok(
  (select with_check from pg_policies
    where schemaname = 'public' and tablename = 'shopping_lists' and policyname = 'shopping_insert_own')
    like '%meal_plans%',
  'shopping_insert_own checks ownership of meal_plan_id'
);

select ok(
  (select with_check from pg_policies
    where schemaname = 'public' and tablename = 'shopping_lists' and policyname = 'shopping_update_own')
    like '%meal_plans%',
  'shopping_update_own checks ownership of meal_plan_id'
);

select ok(
  has_table_privilege('authenticated', 'public.shopping_lists', 'INSERT'),
  'authenticated keeps INSERT on shopping_lists (generate-shopping-list writes with the caller client)'
);

select * from finish();
rollback;
