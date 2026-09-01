-- FRESCO-361 (audit-4 A4-B2): `get_filtered_recipes()` is the ONLY structural
-- food-safety enforcement point (ADR-0001, NFR-SEC-3 — the Gemini prompt-rule
-- layer was removed in ADR-0005). Three defects made it leaky:
--
--   1. The allergen match `r.alergenos ?| v_profile.alergenos` is
--      case-sensitive exact string equality. A recipe tagged `"Gluten"` would
--      not be excluded for a user who declared `"gluten"`.
--   2. `recipes.alergenos` had two tags for the same concept — `frutos_secos`
--      (46 recipes) and `frutos_de_cascara` (9), never co-occurring — and the
--      onboarding UI only ever offered `frutos_de_cascara`.
--   3. Nothing constrained `recipes.alergenos` to the known vocabulary, so a
--      typo'd or mis-cased tag would silently never match a declared allergen.
--
-- This migration: (1) merges `frutos_secos` into `frutos_de_cascara`,
-- (2) pins `recipes.alergenos` to the 12-value canonical vocabulary with a
-- CHECK (catalog already 100% conforms — verified live), (3) rewrites the
-- allergen and disliked-ingredient exclusion in `get_filtered_recipes()` to
-- compare with `lower()` on both sides.
--
-- The onboarding allergen chip list (`ALERGENO_OPTIONS`) is expanded to all 12
-- in the same PR, and the free-text "¿Algún otro alérgeno?" input — which fed
-- a column no query ever read — is removed. Known gap (documented, not fixed
-- here): `mostaza` and `altramuces` (2 of the EU-14) are not tagged in the
-- catalog and there is no source data to backfill 1000 recipes.

-- ── 1. Merge frutos_secos → frutos_de_cascara ───────────────────────────────

update public.recipes
set alergenos = (
  select jsonb_agg(distinct tag order by tag)
  from (
    select case when value = 'frutos_secos' then 'frutos_de_cascara' else value end as tag
    from jsonb_array_elements_text(alergenos) as value
  ) merged
)
where alergenos ? 'frutos_secos';

-- ── 2. Pin recipes.alergenos to the canonical vocabulary ────────────────────

alter table public.recipes
  add constraint recipes_alergenos_vocab
  check (
    coalesce(alergenos, '[]'::jsonb) <@ '["apio","cacahuetes","crustaceos","frutos_de_cascara","gluten","huevo","lactosa","moluscos","pescado","sesamo","soja","sulfitos"]'::jsonb
  );

-- ── 3. Case-insensitive allergen / disliked-ingredient exclusion ────────────

create or replace function public.get_filtered_recipes(p_user_id uuid, p_recipe_id uuid default null::uuid)
returns setof public.recipes
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_profile public.user_profiles;
begin
  if p_user_id <> auth.uid() then
    raise exception 'get_filtered_recipes: caller does not own profile %', p_user_id;
  end if;

  select * into v_profile from public.user_profiles where id = p_user_id;

  return query
  select r.*
  from public.recipes r
  where
    (p_recipe_id is null or r.id = p_recipe_id)
    -- Food-safety critical (FRESCO-361 / A4-B2): compare with lower() on both
    -- sides so an allergen match never depends on the casing a recipe was
    -- tagged with. Fails closed — a recipe stays in only if NONE of its
    -- allergens matches any the user declared.
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(r.alergenos, '[]'::jsonb)) as ra(val)
      where lower(ra.val) = any (select lower(a) from unnest(coalesce(v_profile.alergenos, '{}'::text[])) as a)
    )
    and (not v_profile.dieta_vegetariano or coalesce((r.dieta->>'vegetariano')::boolean, false))
    and (not v_profile.dieta_vegano      or coalesce((r.dieta->>'vegano')::boolean, false))
    and (not v_profile.dieta_sin_gluten  or coalesce((r.dieta->>'sin_gluten')::boolean, false))
    and (not v_profile.dieta_sin_lactosa or coalesce((r.dieta->>'sin_lactosa')::boolean, false))
    and (not v_profile.dieta_sin_huevo   or coalesce((r.dieta->>'sin_huevo')::boolean, false))
    and (not v_profile.dieta_keto        or coalesce((r.dieta->>'keto')::boolean, false))
    and (not v_profile.dieta_halal       or coalesce((r.dieta->>'halal')::boolean, false))
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(r.ingredientes_principales, '[]'::jsonb)) as ri(val)
      where lower(ri.val) = any (select lower(i) from unnest(coalesce(v_profile.ingredientes_odiados, '{}'::text[])) as i)
    );
end;
$function$;
