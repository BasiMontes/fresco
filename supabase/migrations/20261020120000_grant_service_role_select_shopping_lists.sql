-- FRESCO-1032 — scripts/pilot-report.ts reads the pilot's activity as service_role and fails with
-- `permission denied for table shopping_lists` (42501): service_role has REFERENCES/TRIGGER/TRUNCATE on
-- public.shopping_lists from ownership defaults but was never granted SELECT. Same gap as
-- 20260908150000_grant_service_role_recipes_privileges.sql (recipes) and
-- 20260819124500_grant_service_role_user_profiles_privileges.sql (user_profiles). service_role bypasses RLS,
-- but RLS bypass is separate from the base table GRANT; both are required. Verified live through
-- information_schema.role_table_grants before writing this (meal_plans and meal_plan_recipes already grant SELECT).
--
-- Read only, on purpose: the report never writes. No client role (anon, authenticated) is touched.

grant select on public.shopping_lists to service_role;
