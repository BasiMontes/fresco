-- FRESCO-120: `get_recent_recipe_ids` excluded every recipe from the last
-- 2 weeks regardless of `estado` (pendiente/cocinada/descartada/sustituida)
-- — a Pro user who never marked anything got the exact same exclusion as
-- one who diligently marked cocinado/descartado, contradicting the
-- product copy's promise that Pro "aprende de lo que cocinas y descartas".
--
-- Replaces it with `get_recent_recipe_marks`, which returns `estado`
-- alongside `recipe_id` so the caller (generate-meal-plan/index.ts) can
-- exclude cocinada+descartada (an explicit signal) while leaving
-- pendiente/sustituida (no real feedback) untouched.
--
-- Both new functions keep the `mp.user_id = auth.uid()` ownership check
-- the 2026-08-01 hardening pass (20260801010000) added to the function
-- being replaced here — SECURITY DEFINER bypasses RLS, so this check is
-- the only thing stopping a caller from reading another user's meal
-- history by passing an arbitrary p_user_id (ADR-0001).
drop function if exists public.get_recent_recipe_ids(uuid, integer);

create function public.get_recent_recipe_marks(
  p_user_id uuid,
  p_weeks   integer default 2
)
returns table(recipe_id uuid, estado public.estado_receta_menu) as $$
  -- A recipe can appear more than once in the window with different marks
  -- (e.g. cocinada one week, descartada another) — collapse to the most
  -- decisive signal: descartada > cocinada > pendiente/sustituida.
  select distinct on (mpr.recipe_id)
    mpr.recipe_id,
    mpr.estado
  from public.meal_plan_recipes mpr
  join public.meal_plans mp on mp.id = mpr.meal_plan_id
  where mp.user_id = p_user_id
    and mp.user_id = auth.uid()
    and mp.fecha_inicio >= current_date - (p_weeks * 7)
  order by mpr.recipe_id,
    case mpr.estado
      when 'descartada' then 1
      when 'cocinada' then 2
      else 3
    end
$$ language sql stable security definer set search_path = public;

-- FRESCO-120: `destacadas` ("recetas que ya te funcionaron bien") used to
-- read `recipes.veces_cocinada`/`rating_promedio` — aggregate columns
-- shared across ALL users, not a personal signal. This returns recipes
-- THIS user has personally marked cocinada at least once, with no time
-- window (a returning favorite from before the exclusion window still
-- counts as "worked well for you").
create function public.get_user_cooked_recipe_ids(
  p_user_id uuid
)
returns uuid[] as $$
  select array_agg(distinct mpr.recipe_id)
  from public.meal_plan_recipes mpr
  join public.meal_plans mp on mp.id = mpr.meal_plan_id
  where mp.user_id = p_user_id
    and mp.user_id = auth.uid()
    and mpr.estado = 'cocinada'
$$ language sql stable security definer set search_path = public;

revoke execute on function public.get_recent_recipe_marks(uuid, integer) from public, anon;
revoke execute on function public.get_user_cooked_recipe_ids(uuid) from public, anon;

grant execute on function public.get_recent_recipe_marks(uuid, integer) to authenticated;
grant execute on function public.get_user_cooked_recipe_ids(uuid) to authenticated;
