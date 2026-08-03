-- FRESCO-68 (Biblioteca | Crear una receta propia). Deliberately typed-relational
-- (mirrors user_profiles/meal_plans from 20260725120100_create_fresco_core_tables.sql),
-- NOT the `recipes` jsonb shape -- personal recipes are fully separate from the
-- founder-owned catalog, confirmed with the user to never enter
-- `get_filtered_recipes()` or the AI menu generator. No dieta/alergenos/foto_url/
-- clasificacion columns -- explicitly out of scope for this story.

create table public.recetas_propias (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  user_id      uuid not null references public.user_profiles(id) on delete cascade,

  nombre       text not null check (char_length(trim(nombre)) > 0),
  ingredientes text[] not null default '{}',
  pasos        text[] not null default '{}'
);

comment on table public.recetas_propias is
  'Personal recipes a user creates for their own library (FRESCO-68). Visible only to their creator; never read by get_filtered_recipes() or generate-meal-plan -- a deliberate exclusion, not an oversight.';

create trigger recetas_propias_updated_at
  before update on public.recetas_propias
  for each row execute function public.handle_updated_at();

create index idx_recetas_propias_user_id on public.recetas_propias(user_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────

alter table public.recetas_propias enable row level security;

create policy "recetas_propias_select_own" on public.recetas_propias for select
  to authenticated using ((select auth.uid()) = user_id);

create policy "recetas_propias_insert_own" on public.recetas_propias for insert
  to authenticated with check ((select auth.uid()) = user_id);

-- No update/delete policy: editing/deleting an already-created personal recipe
-- is explicitly out of scope (confirmed with the user). RLS denies by default
-- when no policy exists for an action, so this is enforced at the DB layer,
-- not just withheld in the UI.
