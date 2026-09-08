-- FRESCO-451 — scripts/clean-recipe-names.ts (recipe-name cleanup, dangling
-- connectors like "con y limón") authenticates as service_role and fails
-- with `permission denied for table recipes` (42501): service_role has
-- REFERENCES/TRIGGER/TRUNCATE on public.recipes (from ownership defaults)
-- but was never granted SELECT/UPDATE — same gap as
-- 20260819124500_grant_service_role_user_profiles_privileges.sql found on
-- user_profiles. service_role bypasses RLS by design, but RLS bypass is
-- separate from base table GRANTs — both are required. Verified live via
-- information_schema.role_table_grants before writing this.

grant select, update on public.recipes to service_role;
