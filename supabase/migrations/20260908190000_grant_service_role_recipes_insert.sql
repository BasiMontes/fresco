-- FRESCO-461 — scripts/prune-duplicate-recipes.ts (FRESCO-460) and the FRESCO-461
-- repopulation batch both authenticate as service_role. UPDATE/SELECT were
-- granted for the FRESCO-460 prune (20260908150000_grant_service_role_recipes_privileges.sql)
-- but INSERT was never added — same class of gap that migration itself
-- documented (base-table GRANTs are separate from RLS bypass). Confirmed live
-- via a failed batch insert (42501 permission denied) before writing this.

grant insert on public.recipes to service_role;
