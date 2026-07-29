-- Found live while testing a real menu generation end-to-end (2026-07-29):
-- "Recetas públicas para lectura" (public.recipes SELECT policy) only listed
-- role `anon`, not `authenticated`. The base GRANT for `authenticated` on
-- `recipes` was already correct (added in
-- 20260729120000_grant_authenticated_table_privileges.sql), but RLS blocks a
-- role the policy doesn't name regardless of the GRANT — so a real logged-in
-- user's own session could generate a meal plan (the Edge Function reads
-- recipes through a security-definer RPC, unaffected) but could never read
-- it back via `/menu`'s direct `recipes(*)` embedded select, which runs
-- under that user's own RLS context. `reshapeMenu()`'s completeness guard
-- (added FRESCO-11 Stage 2) caught this correctly and fell back to the empty
-- state instead of crashing — this migration fixes the actual cause.

alter policy "Recetas públicas para lectura" on public.recipes
  to anon, authenticated;
