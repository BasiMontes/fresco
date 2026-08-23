-- FRESCO-239 (ADR-0008): scoreRecipe() only used global aggregate columns
-- (recipes.rating_promedio/veces_cocinada/veces_descartada), never a
-- personal signal. ADR-0006 flagged this as deferred follow-up work.
--
-- This function returns, per recipe, how many times THIS user personally
-- marked it cocinada/descartada (all-time, no window — same reasoning as
-- get_user_cooked_recipe_ids: a personal quality signal shouldn't age out
-- the way the 2-week no-repeat exclusion does). Pro/Family-only caller
-- (generate-meal-plan/index.ts), preserving the ADR-0001 Free/Pro boundary.
--
-- Same ownership-check pattern as every other ADR-0006 function — SECURITY
-- DEFINER bypasses RLS, so this check is the only thing stopping a caller
-- from reading another user's meal history.
create function public.get_user_recipe_engagement(
  p_user_id uuid
)
returns table(
  recipe_id uuid,
  veces_cocinada_usuario integer,
  veces_descartada_usuario integer
) as $$
  select
    mpr.recipe_id,
    count(*) filter (where mpr.estado = 'cocinada')::integer as veces_cocinada_usuario,
    count(*) filter (where mpr.estado = 'descartada')::integer as veces_descartada_usuario
  from public.meal_plan_recipes mpr
  join public.meal_plans mp on mp.id = mpr.meal_plan_id
  where mp.user_id = p_user_id
    and mp.user_id = auth.uid()
    and mpr.estado in ('cocinada', 'descartada')
  group by mpr.recipe_id
$$ language sql stable security definer set search_path = public;

revoke execute on function public.get_user_recipe_engagement(uuid) from public, anon;

grant execute on function public.get_user_recipe_engagement(uuid) to authenticated;
