-- FRESCO-715 (EPIC-FRESCO-714): curated allergen-safe ingredient-substitution
-- catalog + a fail-closed lookup RPC. Foundation for FRESCO-534 (per-slot swap
-- flow) and FRESCO-716 (shopping-list reflection) -- see ADR-0032.
--
-- Deliberately never mutates `recipes` or `meal_plan_recipes`: this is a new,
-- global, curated reference table (same governance model as `recipes` itself
-- -- founder-curated, public-read, service-role-write-only), keyed by the
-- ORIGINAL ingredient name and offering zero or more safe SUBSTITUTE rows.
--
-- RPC authorization (ADR-0032, references/rpc-authorization.md): SECURITY
-- INVOKER, no caller-supplied identity parameter at all -- the function reads
-- auth.uid() directly, which both source tables already permit under existing
-- RLS (`user_profiles.profiles_select_own`, this table's own public-read
-- policy below). This deliberately diverges from `get_filtered_recipes`'s
-- SECURITY DEFINER + p_user_id pattern: that escalation is unnecessary here,
-- and removing the identity parameter removes the actor-bind bug class
-- entirely rather than guarding against it.

-- -- 1. Catalog table --------------------------------------------------------

create table public.ingredient_substitutions (
  id uuid primary key default gen_random_uuid(),
  ingrediente_original text not null,
  ingrediente_sustituto text not null,
  -- Allergens the SUBSTITUTE itself carries (checked against the caller's own
  -- user_profiles.alergenos before the candidate is ever returned).
  alergenos text[] not null default '{}',
  -- Dietary flags the substitute satisfies -- same key set as recipes.dieta
  -- so the RPC below reads both with identical syntax.
  dieta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ingredient_substitutions_alergenos_vocab check (
    alergenos <@ array['apio','cacahuetes','crustaceos','frutos_de_cascara','gluten','huevo','lactosa','moluscos','pescado','sesamo','soja','sulfitos']::text[]
  ),
  constraint ingredient_substitutions_unique_pair unique (ingrediente_original, ingrediente_sustituto)
);

alter table public.ingredient_substitutions enable row level security;

create policy ingredient_substitutions_select_all
  on public.ingredient_substitutions
  for select
  to anon, authenticated
  using (true);

grant select on public.ingredient_substitutions to anon, authenticated;
grant select, insert, update, delete on public.ingredient_substitutions to service_role;

-- -- 2. Curated seed data -----------------------------------------------------
-- Cross-checked against the live `recipes.ingredientes_principales` usage
-- this pass (not invented against the full EU-14 list). Covers 8 of the 12
-- canonical allergens where a real, common ingredient actually appears in
-- the catalog today -- moluscos / pescado / sulfitos left for a follow-up
-- seed pass once their real ingredient usage is checked.

insert into public.ingredient_substitutions (ingrediente_original, ingrediente_sustituto, alergenos, dieta) values
  ('leche', 'leche de avena', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('leche', 'leche de coco', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('queso', 'levadura nutricional', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('yogur', 'yogur de coco', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('mantequilla', 'aceite de oliva', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('harina', 'harina de arroz', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('harina de trigo', 'harina de avena sin gluten', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('pasta', 'pasta de arroz', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('huevo', 'pure de platano', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('huevo', 'linaza molida', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('cacahuetes', 'semillas de girasol', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('almendras', 'semillas de girasol', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('gambas', 'tofu firme', '{soja}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('salsa de soja', 'aminos de coco', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('apio', 'hinojo', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}'),
  ('tahini', 'crema de girasol', '{}', '{"vegano":true,"vegetariano":true,"sin_gluten":true,"sin_lactosa":true,"sin_huevo":true}');

-- -- 3. Safety-check RPC -------------------------------------------------------
-- SECURITY INVOKER, no identity parameter (see header note). Fails closed: a
-- caller with no user_profiles row, or an ingredient with no catalog entry,
-- or a catalog entry that fails every filter, all return zero rows -- never
-- an error, never a null.

create function public.get_safe_ingredient_substitutes(p_ingrediente text)
returns table (ingrediente_sustituto text, alergenos text[])
language sql
stable security invoker
set search_path to 'public'
as $function$
  select s.ingrediente_sustituto, s.alergenos
  from public.ingredient_substitutions s
  join public.user_profiles p on p.id = auth.uid()
  where lower(s.ingrediente_original) = lower(p_ingrediente)
    and not (s.alergenos && coalesce(p.alergenos, '{}'::text[]))
    and not exists (
      select 1
      from unnest(coalesce(p.ingredientes_odiados, '{}'::text[])) as odiado
      where lower(odiado) = lower(s.ingrediente_sustituto)
    )
    and (not p.dieta_vegetariano or coalesce((s.dieta->>'vegetariano')::boolean, false))
    and (not p.dieta_vegano      or coalesce((s.dieta->>'vegano')::boolean, false))
    and (not p.dieta_sin_gluten  or coalesce((s.dieta->>'sin_gluten')::boolean, false))
    and (not p.dieta_sin_lactosa or coalesce((s.dieta->>'sin_lactosa')::boolean, false))
    and (not p.dieta_sin_huevo   or coalesce((s.dieta->>'sin_huevo')::boolean, false))
    and (not p.dieta_keto        or coalesce((s.dieta->>'keto')::boolean, false))
    and (not p.dieta_halal       or coalesce((s.dieta->>'halal')::boolean, false));
$function$;

grant execute on function public.get_safe_ingredient_substitutes(text) to authenticated;
