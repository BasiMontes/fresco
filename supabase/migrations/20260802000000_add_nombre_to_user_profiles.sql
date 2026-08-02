-- Add nullable nombre column to user_profiles (FRESCO-55: greet the user by
-- name on /menu). No default, no check constraint -- empty-after-trim
-- validation happens at the application layer (lib/api/user-profile.ts,
-- updateNombre). Existing RLS policies (profiles_select_own /
-- profiles_insert_own / profiles_update_own) already cover the whole row, so
-- no new policy is needed; no trigger needed either.

alter table public.user_profiles
  add column nombre text;

comment on column public.user_profiles.nombre is
  'Display name for the /menu greeting (FRESCO-55). Nullable -- falls back to a generic greeting when unset.';
