-- Found live while testing the first real login (2026-07-29): every RLS
-- policy on user_profiles/meal_plans/meal_plan_recipes/shopping_lists was
-- correct and matched 1:1 to the app's access patterns, but none of the
-- prior migrations ever ran the table-level GRANT for `authenticated` —
-- only `recipes` had one (its public-read-catalog SELECT). RLS policies
-- restrict rows; they never substitute for the base GRANT Postgres still
-- requires. Result: every authenticated request against these 4 tables
-- failed with "permission denied for table X" regardless of ownership.
--
-- Privileges below match exactly the existing policies in
-- 20260725120100_create_fresco_core_tables.sql (see pg_policies): no DELETE
-- grant for user_profiles/meal_plan_recipes because no delete policy exists
-- for either — a profile or a plan-slot is never deleted directly by a user.

grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update on public.meal_plan_recipes to authenticated;
grant select, insert, update, delete on public.shopping_lists to authenticated;
