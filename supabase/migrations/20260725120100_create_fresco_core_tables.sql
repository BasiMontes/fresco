-- Fresco core relational tables: user_profiles, meal_plans, meal_plan_recipes,
-- shopping_lists.
--
-- Deliberate MIXED-SHAPE schema (explicit user decision, 2026-07-25): `recipes`
-- stays JSONB (schema_supabase.sql, already live + seeded, untouched by this
-- migration). These four tables instead follow the typed-relational design
-- from fresco-schema-sql.md — enums and individual typed columns, not jsonb
-- blobs. Do not "fix" this into one consistent shape; it is an explicit,
-- informed trade-off, not an oversight.
--
-- Only the enum types actually consumed by a column below are created here
-- (tipo_plato, plan_usuario, dia_semana, estado_receta_menu, nivel_picante,
-- nivel_contundencia, tipo_cocina). fresco-schema-sql.md's remaining enums
-- (categoria_receta, coste_estimado, dificultad_receta, temporada) describe
-- typed `recipes` columns that do not exist in the live JSONB shape and are
-- intentionally not created here — see architecture.md §4.
--
-- Source: fresco-schema-sql.md Blocks 1, 3-9 (adapted where noted below);
-- architecture.md §4 (ERD); non-functional-requirements.md NFR-SEC-2 (RLS).

-- ── ENUM TYPES ───────────────────────────────────────────────────────────

create type public.tipo_plato as enum ('desayuno', 'comida', 'cena', 'snack');

create type public.tipo_cocina as enum (
  'española', 'italiana', 'mexicana', 'asiática',
  'mediterránea', 'latina', 'internacional'
);

create type public.nivel_picante as enum ('ninguno', 'suave', 'medio', 'fuerte');

create type public.nivel_contundencia as enum ('ligero', 'media', 'contundente');

create type public.plan_usuario as enum ('free', 'pro', 'family');

create type public.dia_semana as enum (
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'
);

create type public.estado_receta_menu as enum ('pendiente', 'cocinada', 'descartada', 'sustituida');

-- ── updated_at trigger function ─────────────────────────────────────────
-- Reuses the function name already established by the live `recipes` table
-- (schema_supabase.sql). `create or replace` is idempotent and keeps this
-- migration self-sufficient if it's ever replayed against a fresh project.

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ── TABLE: user_profiles ────────────────────────────────────────────────

create table public.user_profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  plan                plan_usuario not null default 'free',
  plan_expires_at     timestamptz,

  num_personas        smallint not null default 2 check (num_personas > 0),
  adultos             smallint not null default 2 check (adultos > 0),
  ninos               smallint not null default 0 check (ninos >= 0),

  dieta_vegetariano   boolean not null default false,
  dieta_vegano        boolean not null default false,
  dieta_sin_gluten    boolean not null default false,
  dieta_sin_lactosa   boolean not null default false,
  dieta_sin_huevo     boolean not null default false,
  dieta_keto          boolean not null default false,
  dieta_halal         boolean not null default false,

  alergenos               text[] not null default '{}',
  ingredientes_odiados    text[] not null default '{}',
  ingredientes_favoritos  text[] not null default '{}',
  cocinas_favoritas       tipo_cocina[] not null default '{española}',
  nivel_picante           nivel_picante not null default 'suave',
  contundencia_preferida  nivel_contundencia not null default 'media',

  tiempo_max_semana_min    smallint not null default 30 check (tiempo_max_semana_min > 0),
  tiempo_max_finde_min     smallint not null default 60 check (tiempo_max_finde_min > 0),
  presupuesto_semana_euros numeric(6,2) check (presupuesto_semana_euros > 0),

  constraint check_adultos_personas check (adultos <= num_personas),
  constraint check_vegano_es_vegetariano check (not dieta_vegano or dieta_vegetariano)
);

comment on table public.user_profiles is
  'Onboarding profile per FR-1.1. One row per Supabase Auth user (id = auth.users.id).';

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();

-- ── TABLE: meal_plans ───────────────────────────────────────────────────

create table public.meal_plans (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  user_id         uuid not null references public.user_profiles(id) on delete cascade,

  semana_iso      text not null,       -- ISO week, e.g. '2024-W48'
  fecha_inicio    date not null,       -- Monday of that week

  advertencias    text[] not null default '{}',
  completado      boolean not null default false,

  constraint unique_user_semana unique (user_id, semana_iso)
);

comment on table public.meal_plans is
  'One weekly menu per user per ISO week. FR-2.1, api-contracts.md §1.';

create trigger meal_plans_updated_at
  before update on public.meal_plans
  for each row execute function public.handle_updated_at();

-- ── TABLE: meal_plan_recipes ────────────────────────────────────────────

create table public.meal_plan_recipes (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  meal_plan_id    uuid not null references public.meal_plans(id) on delete cascade,
  recipe_id       uuid not null references public.recipes(id) on delete restrict,

  dia             dia_semana not null,
  tipo_plato      tipo_plato not null,
  estado          estado_receta_menu not null default 'pendiente',
  rating          smallint check (rating between 1 and 5),

  constraint unique_slot unique (meal_plan_id, dia, tipo_plato)
);

comment on table public.meal_plan_recipes is
  'One row per menu slot (21 per plan: 7 days x desayuno/comida/cena). estado drives the FR-5.x learning loop via recipe_learning_trigger (next migration in this batch).';

create trigger meal_plan_recipes_updated_at
  before update on public.meal_plan_recipes
  for each row execute function public.handle_updated_at();

-- ── TABLE: shopping_lists ───────────────────────────────────────────────

create table public.shopping_lists (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  meal_plan_id    uuid not null references public.meal_plans(id) on delete cascade,
  user_id         uuid not null references public.user_profiles(id) on delete cascade,

  -- [{ nombre (pasillo), orden, items: [{ nombre, cantidad, unidad, comprado }] }]
  items           jsonb not null default '[]',

  constraint unique_plan_lista unique (meal_plan_id)
);

comment on table public.shopping_lists is
  'One aisle-grouped shopping list per meal plan. FR-4.1-4.4, api-contracts.md §2.';

create trigger shopping_lists_updated_at
  before update on public.shopping_lists
  for each row execute function public.handle_updated_at();

-- ── INDEXES ──────────────────────────────────────────────────────────────

create index idx_meal_plans_user_id   on public.meal_plans(user_id);
create index idx_meal_plans_semana    on public.meal_plans(semana_iso);

create index idx_mpr_meal_plan_id     on public.meal_plan_recipes(meal_plan_id);
create index idx_mpr_recipe_id        on public.meal_plan_recipes(recipe_id);
create index idx_mpr_estado           on public.meal_plan_recipes(estado);

create index idx_shopping_user_id     on public.shopping_lists(user_id);
create index idx_shopping_meal_plan   on public.shopping_lists(meal_plan_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- `recipes`' own RLS is untouched here — schema_supabase.sql's anon-read
-- policy is confirmed live and authoritative (NFR-SEC-2). Only the four new
-- tables get RLS in this migration.

alter table public.user_profiles     enable row level security;
alter table public.meal_plans        enable row level security;
alter table public.meal_plan_recipes enable row level security;
alter table public.shopping_lists    enable row level security;

-- user_profiles: row-ownership by id = auth.uid()
create policy "profiles_select_own" on public.user_profiles for select
  to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.user_profiles for insert
  to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.user_profiles for update
  to authenticated using (auth.uid() = id);

-- meal_plans: row-ownership by user_id = auth.uid()
create policy "meal_plans_select_own" on public.meal_plans for select
  to authenticated using (auth.uid() = user_id);
create policy "meal_plans_insert_own" on public.meal_plans for insert
  to authenticated with check (auth.uid() = user_id);
create policy "meal_plans_update_own" on public.meal_plans for update
  to authenticated using (auth.uid() = user_id);
create policy "meal_plans_delete_own" on public.meal_plans for delete
  to authenticated using (auth.uid() = user_id);

-- meal_plan_recipes: ownership via join back to meal_plans.user_id
create policy "mpr_select_own" on public.meal_plan_recipes for select
  to authenticated using (
    exists (select 1 from public.meal_plans mp
            where mp.id = meal_plan_recipes.meal_plan_id and mp.user_id = auth.uid())
  );
create policy "mpr_insert_own" on public.meal_plan_recipes for insert
  to authenticated with check (
    exists (select 1 from public.meal_plans mp
            where mp.id = meal_plan_recipes.meal_plan_id and mp.user_id = auth.uid())
  );
create policy "mpr_update_own" on public.meal_plan_recipes for update
  to authenticated using (
    exists (select 1 from public.meal_plans mp
            where mp.id = meal_plan_recipes.meal_plan_id and mp.user_id = auth.uid())
  );

-- shopping_lists: row-ownership by user_id = auth.uid()
create policy "shopping_select_own" on public.shopping_lists for select
  to authenticated using (auth.uid() = user_id);
create policy "shopping_insert_own" on public.shopping_lists for insert
  to authenticated with check (auth.uid() = user_id);
create policy "shopping_update_own" on public.shopping_lists for update
  to authenticated using (auth.uid() = user_id);
create policy "shopping_delete_own" on public.shopping_lists for delete
  to authenticated using (auth.uid() = user_id);

-- ── HELPER FUNCTIONS ─────────────────────────────────────────────────────

-- Last-N-weeks cooked/discarded recipe ids for a user (Pro-only history read,
-- FR-2.5 / FR-5.4). Operates only on the typed-relational tables above, so
-- it is unaffected by `recipes`' jsonb shape. Copied verbatim from
-- fresco-schema-sql.md Block 9 — no adaptation needed.
create or replace function public.get_recent_recipe_ids(
  p_user_id uuid,
  p_weeks   integer default 2
)
returns uuid[] as $$
  select array_agg(distinct mpr.recipe_id)
  from public.meal_plan_recipes mpr
  join public.meal_plans mp on mp.id = mpr.meal_plan_id
  where mp.user_id = p_user_id
    and mp.fecha_inicio >= current_date - (p_weeks * 7)
$$ language sql stable security definer set search_path = public;

-- SQL pre-filter (FR-8.1 Layer 1): excludes any recipe whose declared
-- allergens overlap the user's, or whose ingredientes_principales overlap the
-- user's ingredientes_odiados, plus active dieta_* flags. This is Layer 1 of
-- the two-layer food-safety guardrail — the Gemini system prompt (Layer 2,
-- built in generate-meal-plan's prompt.ts) repeats the same exclusion so a
-- Layer-1 bypass or misconfiguration is never the only thing standing between
-- a user and an allergen. See ADR-0001, architecture.md §5.
--
-- ADAPTED for the live `recipes` JSONB shape (schema_supabase.sql) — NOT the
-- typed columns fresco-schema-sql.md's version of this function assumed
-- (r.alergenos text[], r.vegetariano boolean, ...). recipes.alergenos and
-- recipes.ingredientes_principales are jsonb arrays of strings; recipes.dieta
-- is a jsonb object of boolean flags (architecture.md §4). The `?|` jsonb
-- operator below checks "does any of these text[] elements exist as a
-- top-level jsonb array element", coalesced against '[]'::jsonb / false so a
-- recipe with a null/missing jsonb field is never wrongly excluded from, or
-- wrongly included in, the filtered catalog.
create or replace function public.get_filtered_recipes(p_user_id uuid)
returns setof public.recipes as $$
declare
  v_profile public.user_profiles;
begin
  select * into v_profile from public.user_profiles where id = p_user_id;

  return query
  select r.*
  from public.recipes r
  where
    not (coalesce(r.alergenos, '[]'::jsonb) ?| v_profile.alergenos)
    and (not v_profile.dieta_vegetariano or coalesce((r.dieta->>'vegetariano')::boolean, false))
    and (not v_profile.dieta_vegano      or coalesce((r.dieta->>'vegano')::boolean, false))
    and (not v_profile.dieta_sin_gluten  or coalesce((r.dieta->>'sin_gluten')::boolean, false))
    and (not v_profile.dieta_sin_lactosa or coalesce((r.dieta->>'sin_lactosa')::boolean, false))
    and (not v_profile.dieta_sin_huevo   or coalesce((r.dieta->>'sin_huevo')::boolean, false))
    and (not v_profile.dieta_keto        or coalesce((r.dieta->>'keto')::boolean, false))
    and (not v_profile.dieta_halal       or coalesce((r.dieta->>'halal')::boolean, false))
    and not (coalesce(r.ingredientes_principales, '[]'::jsonb) ?| v_profile.ingredientes_odiados);
end;
$$ language plpgsql stable security definer set search_path = public;

-- Targeted jsonb_set on a single shopping-list item's `comprado` flag
-- (FR-4.4, api-contracts.md §3). Not an Edge Function — called directly from
-- the authenticated client via `supabase.rpc(...)`.
--
-- SECURITY-FIX vs. the founder's draft (fresco-shopping-list.md): that draft's
-- version of this function had no ownership check, which — combined with
-- `security definer` bypassing RLS — would let any authenticated caller edit
-- any shopping list by guessing/enumerating a p_list_id, defeating the
-- shopping_lists RLS policies above entirely. The `and user_id = auth.uid()`
-- clause below is load-bearing, not decorative; do not remove it.
create or replace function public.jsonb_set_comprado(
  p_list_id     uuid,
  p_pasillo_idx integer,
  p_item_idx    integer,
  p_comprado    boolean
)
returns void as $$
  update public.shopping_lists
  set items = jsonb_set(
    items,
    array[p_pasillo_idx::text, 'items', p_item_idx::text, 'comprado'],
    to_jsonb(p_comprado)
  )
  where id = p_list_id
    and user_id = auth.uid();
$$ language sql security definer set search_path = public;
