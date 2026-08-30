-- ─────────────────────────────────────────────────────────────────────────────
-- FRESCO-310 — Baseline: reconstruct the pre-migration `public.recipes` catalog.
--
-- WHY THIS EXISTS
-- `public.recipes` (plus its indexes, RLS policies and updated_at trigger) was
-- created on the production project by a hand-run `schema_supabase.sql`, BEFORE
-- the tracked migration history began. Every migration from
-- `20260725120000_add_aprendizaje_columns_to_recipes.sql` onward only ALTERs the
-- table — none creates it. As a result `supabase db reset` against a fresh local
-- (or CI) database failed at migration #1 with `relation "public.recipes" does
-- not exist`, which blocked isolating the e2e suite from the prod backend.
--
-- This migration is timestamped `20260725110000` so it sorts BEFORE every
-- existing migration and runs first on a clean database. It reproduces ONLY the
-- schema surface that existed at that point in time:
--   * the 14 original columns (the 4 ADR-0001 "aprendizaje" columns,
--     `foto_url`, and the short-lived `source` column are all added by later
--     migrations and are deliberately absent here);
--   * `recipes_pkey` / `recipes_slug_key`;
--   * the 6 original GIN indexes (later migrations add two more, `_gin`-suffixed);
--   * both original RLS policies — including the broken
--     "Solo administradores pueden escribir" — so that
--     `20260726010000_drop_broken_admin_write_policy_on_recipes.sql` and
--     `20260729130000_allow_authenticated_read_recipes.sql` have something to
--     DROP / ALTER;
--   * the base `GRANT SELECT` to `anon` + `authenticated` that the hand-run
--     `schema_supabase.sql` issued (verified live on prod). RLS restricts
--     rows, never substitutes for the table-level GRANT Postgres still
--     requires — and with `config.toml`'s `auto_expose_new_tables` unset
--     (the current cloud default) a migration-created table gets no implicit
--     grant, so without this every RLS-context read of `recipes` fails with
--     `permission denied for table recipes` on a fresh local / CI database
--     while prod (where the grant already exists) is unaffected;
--   * `pg_trgm` in the `public` schema (moved to `extensions` later by
--     `20260801030000_move_pg_trgm_out_of_public.sql`);
--   * `public.handle_updated_at()` + the `recipes` BEFORE UPDATE trigger
--     (`20260725120100` re-creates the function with `create or replace`).
--
-- PRODUCTION
-- On prod this schema already exists, so this migration is registered as
-- already-applied and never actually run there:
--   supabase migration repair --status applied 20260725110000
-- It is written fully idempotently (IF NOT EXISTS / catalog guards / OR REPLACE)
-- so a re-run against any database is a safe no-op.
-- ─────────────────────────────────────────────────────────────────────────────

-- pg_trgm backs idx_recipes_nombre_trgm below. Pre-migration reality: installed
-- in `public` (see 20260801030000, which relocates it to `extensions`).
create extension if not exists pg_trgm with schema public;

-- ── updated_at trigger function ──────────────────────────────────────────────
-- Same body 20260725120100 re-declares; kept here so the trigger below can be
-- created on a clean database. `create or replace` → idempotent.
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ── TABLE: public.recipes (14 pre-migration columns) ─────────────────────────
create table if not exists public.recipes (
  id                                uuid        not null default gen_random_uuid(),
  created_at                        timestamptz not null default timezone('utc'::text, now()),
  updated_at                        timestamptz not null default timezone('utc'::text, now()),
  nombre                            text        not null,
  slug                              text        not null,
  descripcion_corta                 text,
  meta                              jsonb,
  clasificacion                     jsonb,
  dieta                             jsonb,
  alergenos                         jsonb,
  ingredientes_principales          jsonb,
  ingredientes_que_puede_desagradar jsonb,
  temporada                         jsonb,
  pasos_resumen                     jsonb,
  constraint recipes_pkey primary key (id),
  constraint recipes_slug_key unique (slug)
);

alter table public.recipes enable row level security;

-- ── RLS policies (original pair) ─────────────────────────────────────────────
-- "Recetas públicas para lectura": pre-migration this listed only `anon`
-- (20260729130000 adds `authenticated`).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipes'
      and policyname = 'Recetas públicas para lectura'
  ) then
    create policy "Recetas públicas para lectura" on public.recipes
      for select to anon using (true);
  end if;
end $$;

-- "Solo administradores pueden escribir": a misnamed, always-true write policy
-- for the `authenticated` role. Reconstructed only so
-- 20260726010000_drop_broken_admin_write_policy_on_recipes.sql can DROP it.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipes'
      and policyname = 'Solo administradores pueden escribir'
  ) then
    create policy "Solo administradores pueden escribir" on public.recipes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ── Base table privileges ───────────────────────────────────────────────────
-- Reissue the catalog-read GRANT the pre-migration `schema_supabase.sql` set
-- (prod: anon + authenticated both hold SELECT). Idempotent. Never runs on
-- prod (this migration is `migration repair`'d as already-applied there); it
-- exists so a fresh local / CI `db reset` matches prod instead of 500ing
-- every `recipes` read with `permission denied for table recipes`.
grant select on public.recipes to anon, authenticated;

-- ── Indexes (6 original GIN indexes) ────────────────────────────────────────
create index if not exists idx_recipes_alergenos     on public.recipes using gin (alergenos);
create index if not exists idx_recipes_clasificacion on public.recipes using gin (clasificacion);
create index if not exists idx_recipes_dieta         on public.recipes using gin (dieta);
create index if not exists idx_recipes_ingredientes  on public.recipes using gin (ingredientes_principales);
create index if not exists idx_recipes_temporada     on public.recipes using gin (temporada);
create index if not exists idx_recipes_nombre_trgm   on public.recipes using gin (nombre gin_trgm_ops);

-- ── updated_at trigger ──────────────────────────────────────────────────────
drop trigger if exists on_public_recipes_updated_at on public.recipes;
create trigger on_public_recipes_updated_at
  before update on public.recipes
  for each row execute function public.handle_updated_at();
