-- Additive `p_recipe_id` narrowing parameter lets Postgres use the
-- `recipes` primary-key index for single-recipe lookups (`getRecipeDetail`)
-- instead of scanning the whole filtered catalog just to find one row by id
-- afterward (the previous behavior of `.eq('id', id)` chained onto the RPC
-- result client-side). Existing callers (`getAvailableRecipesCount`,
-- `getLatestAvailableRecipes`, `getCatalogRecipes`, `generate-meal-plan`)
-- are unaffected -- none of them pass `p_recipe_id`, which defaults to
-- `null`, making the new predicate a no-op and leaving their WHERE clause
-- byte-for-byte identical to before.
--
-- Postgres treats a changed argument list as a NEW overload, not a
-- same-signature replace -- `create or replace` alone would leave the old
-- `get_filtered_recipes(uuid)` in place *alongside* this one, making every
-- existing single-argument RPC call ambiguous (Postgres can't pick between
-- two functions whose only difference is a trailing default parameter). The
-- function is explicitly dropped first so only one signature ever exists.
drop function if exists public.get_filtered_recipes(uuid);

create function public.get_filtered_recipes(p_user_id uuid, p_recipe_id uuid default null)
returns setof public.recipes as $$
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
    and not (coalesce(r.alergenos, '[]'::jsonb) ?| v_profile.alergenos)
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

-- Same least-privilege grants as the original hardening migration
-- (20260801010000), reissued for the new (uuid, uuid) signature -- dropping
-- the function also drops its grants, so these must be re-applied or the
-- function would be unreachable by `authenticated` (default deny).
revoke execute on function public.get_filtered_recipes(uuid, uuid) from public, anon;
grant execute on function public.get_filtered_recipes(uuid, uuid) to authenticated;
