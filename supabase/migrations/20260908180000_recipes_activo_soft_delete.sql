-- FRESCO-460 — execute the near-duplicate prune planned in FRESCO-453.
--
-- Adds a soft-delete flag to `recipes` instead of hard-deleting duplicate
-- rows. Decision from FRESCO-453 (2026-09-07): even though live FK checks
-- showed zero `meal_plan_recipes`/`favorites` references at plan time, that
-- was a snapshot — real usage grows, `meal_plan_recipes.recipe_id` is ON
-- DELETE RESTRICT, and a soft flag is reversible while preserving
-- historical meal-plan integrity. No index on `activo`: the catalog is
-- ~1000 rows and `get_filtered_recipes()` already does a full predicate
-- scan per call (jsonb allergen/ingredient checks), so one more boolean
-- predicate adds no measurable cost.
--
-- `get_filtered_recipes()` is the single food-safety choke point every
-- non-admin reader goes through (menu generation, `/recipes` catalog via
-- get_catalog(), single-recipe detail, substitution safety) — audited live,
-- confirmed by FRESCO-460 planning. Adding `r.activo` here alone covers all
-- of them. The two admin-only direct readers of `public.recipes`
-- (`lib/api/admin-recipes.ts` catalog search, `delete-catalog-recipe` edge
-- function) deliberately stay unfiltered — an admin managing the catalog
-- needs to see and act on inactive rows too, same rationale as the existing
-- comment on `searchCatalogRecipes` for allergen-excluded rows.
--
-- Body is otherwise identical to 20260901160000_stable_order_get_filtered_recipes.sql.

alter table public.recipes
  add column activo boolean not null default true;

comment on column public.recipes.activo is
  'FRESCO-460 soft-delete flag. false = pruned near-duplicate, excluded from get_filtered_recipes() (menu generation, catalog, substitution, recipe detail). Never hard-deleted: meal_plan_recipes.recipe_id is ON DELETE RESTRICT and historical meal-plan rows must keep resolving.';

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
    r.activo
    and (p_recipe_id is null or r.id = p_recipe_id)
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
    )
  order by r.id;
end;
$function$;
