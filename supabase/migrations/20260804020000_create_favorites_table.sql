-- FRESCO-77 (favoritar recetas del catálogo, botón corazón en RecipeCard).
-- Mirrors `recetas_propias`' shape (simple user-owned relational table) --
-- catalog recipes only (`public.recipes`), not `recetas_propias`: no
-- favorite-heart UI exists on personal-recipe cards today, and adding one
-- is out of scope.

create table public.favorites (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  user_id      uuid not null references public.user_profiles(id) on delete cascade,
  recipe_id    uuid not null references public.recipes(id) on delete cascade,

  unique (user_id, recipe_id)
);

comment on table public.favorites is
  'Catalog recipes a user has favorited (FRESCO-77/71). Toggle-only: insert to favorite, delete to unfavorite -- no update verb needed.';

create index idx_favorites_user_id on public.favorites(user_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────

alter table public.favorites enable row level security;

create policy "favorites_select_own" on public.favorites for select
  to authenticated using ((select auth.uid()) = user_id);

create policy "favorites_insert_own" on public.favorites for insert
  to authenticated with check ((select auth.uid()) = user_id);

create policy "favorites_delete_own" on public.favorites for delete
  to authenticated using ((select auth.uid()) = user_id);

-- No update policy: a favorite is either present or absent, never edited.
