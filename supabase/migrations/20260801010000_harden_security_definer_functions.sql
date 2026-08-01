-- Supabase security advisor (2026-08-01): 7 SECURITY DEFINER functions were
-- callable by anon/authenticated via PostgREST RPC purely because Postgres
-- grants EXECUTE to PUBLIC by default on new functions.
--
-- Two of them (get_filtered_recipes, get_recent_recipe_ids) trusted their
-- p_user_id parameter without checking it against auth.uid() — unlike
-- swap_meal_plan_slots/jsonb_set_comprado, which already validate ownership.
-- Since both are SECURITY DEFINER (bypasses RLS), any caller with the anon
-- key could read another real user's recent meal history or diet/allergen
-- profile by passing an arbitrary user id. This directly violates ADR-0001
-- (a user's history must never leak outside their own account).

create or replace function public.get_filtered_recipes(p_user_id uuid)
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

create or replace function public.get_recent_recipe_ids(
  p_user_id uuid,
  p_weeks   integer default 2
)
returns uuid[] as $$
  select array_agg(distinct mpr.recipe_id)
  from public.meal_plan_recipes mpr
  join public.meal_plans mp on mp.id = mpr.meal_plan_id
  where mp.user_id = p_user_id
    and mp.user_id = auth.uid()
    and mp.fecha_inicio >= current_date - (p_weeks * 7)
$$ language sql stable security definer set search_path = public;

-- Least-privilege cleanup: revoke the default PUBLIC EXECUTE grant on all 7
-- flagged functions, then re-grant only what the app actually uses.
-- get_filtered_recipes / get_recent_recipe_ids / jsonb_set_comprado /
-- swap_meal_plan_slots are called via supabase.rpc() by real logged-in-or-
-- anonymous-session callers (role authenticated) — anon (no session at all)
-- never needs them. handle_updated_at / update_recipe_learning are trigger-
-- only (`for each row execute function ...`); rls_auto_enable is an event-
-- trigger callback (platform-managed). None of the three is ever called
-- directly — triggers run in the function owner's context regardless of
-- these grants, so revoking does not break them.
revoke execute on function public.get_filtered_recipes(uuid) from public, anon;
revoke execute on function public.get_recent_recipe_ids(uuid, integer) from public, anon;
revoke execute on function public.jsonb_set_comprado(uuid, integer, integer, boolean) from public, anon;
revoke execute on function public.swap_meal_plan_slots(uuid, uuid) from public, anon;
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
revoke execute on function public.update_recipe_learning() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

grant execute on function public.get_filtered_recipes(uuid) to authenticated;
grant execute on function public.get_recent_recipe_ids(uuid, integer) to authenticated;
grant execute on function public.jsonb_set_comprado(uuid, integer, integer, boolean) to authenticated;
grant execute on function public.swap_meal_plan_slots(uuid, uuid) to authenticated;
