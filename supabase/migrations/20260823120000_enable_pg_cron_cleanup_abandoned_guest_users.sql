-- FRESCO-238: ADR-0003 named this as a real, unresolved operational gap —
-- anonymous guest sessions (`auth.users.is_anonymous = true`) that never
-- convert to a real account accumulate forever, since Supabase provides no
-- built-in garbage collection for stale anonymous users.
--
-- Retention threshold (7 days) is an explicit product decision, not a
-- silent default, per ADR-0003's own instruction.
--
-- No Edge Function / Admin API call is needed: every user-owned table
-- (`user_profiles`, `meal_plans` -> `meal_plan_recipes`, `shopping_lists`,
-- `recetas_propias`) is already FK'd `ON DELETE CASCADE` to
-- `auth.users(id)` (see `delete-account` Edge Function), so deleting the
-- `auth.users` row alone is sufficient cleanup.
--
-- `is_anonymous = true` alone is the correct filter: a guest who upgrades
-- via `updateUser({ email, password })` (ADR-0003's Progressive Signup
-- path) flips `is_anonymous` to `false` on conversion, so an upgraded
-- guest is never a delete candidate.

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'cleanup-abandoned-guest-users',
  '0 3 * * *',
  $$ delete from auth.users where is_anonymous = true and created_at < now() - interval '7 days' $$
);
