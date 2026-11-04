-- FRESCO-1089 (audit-8 A8-AUTHZ-01): reassign_guest_data() re-filtered the moved
-- slots only against the target account's ALLERGENS (FRESCO-362, A4-H2). The
-- target's diet, its disliked ingredients and retired recipes still reached the
-- account's menu. Its sibling copy_meal_plan_to_week got the full filter in
-- FRESCO-994 (A7-AUTHZ-01).
--
-- This migration widens the re-filter to the same four rules get_filtered_recipes
-- applies (ADR-0001): declared allergens, diet flags, disliked ingredients, and
-- `recipes.activo`. A slot that fails any of them is neutralized exactly as before:
-- estado 'excluida', recipe_id null.
--
-- The predicate is inlined against the TARGET profile instead of calling
-- get_filtered_recipes(): that function compares p_user_id with auth.uid(), which
-- is null under service_role, so it is not a dependable path here. The allergen
-- block already worked this way.
--
-- Authorization (rpc-authorization.md section 4) is unchanged: still SECURITY
-- DEFINER, still service_role only, called solely by the reassign-guest-data Edge
-- Function after it verifies the target account's password (ADR-0004). No new
-- identity parameter; every row touched is scoped to v_moved_plan_ids.
--
-- Same signature and return type (integer: count of neutralized slots), so
-- CREATE OR REPLACE keeps the existing grants; they are re-issued below anyway.

create or replace function public.reassign_guest_data(p_from_user_id uuid, p_to_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved_plan_ids uuid[];
  v_excluded_slots integer := 0;
begin
  -- Reassign meal_plans, skipping any week the target account already has a
  -- plan for (unique_user_semana) -- the target's own existing data wins;
  -- the guest's conflicting week is not force-merged. Capture the ids that
  -- actually moved so the re-filter below touches only those.
  with moved as (
    update public.meal_plans mp
    set user_id = p_to_user_id
    where mp.user_id = p_from_user_id
      and not exists (
        select 1 from public.meal_plans existing
        where existing.user_id = p_to_user_id
          and existing.semana_iso = mp.semana_iso
      )
    returning mp.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_moved_plan_ids from moved;

  -- Mirror the reassignment onto shopping_lists (own user_id column, not
  -- derived from meal_plans.user_id at read time) for whichever plans moved.
  update public.shopping_lists sl
  set user_id = p_to_user_id
  where sl.user_id = p_from_user_id
    and sl.meal_plan_id in (
      select id from public.meal_plans where user_id = p_to_user_id
    );

  -- A4-H2 + A8-AUTHZ-01: re-filter the moved slots against the TARGET profile.
  -- Every comparison is lower() on both sides and fails closed, like
  -- get_filtered_recipes (FRESCO-361).
  with target_profile as (
    select
      array(select lower(a) from unnest(coalesce(up.alergenos, '{}'::text[])) as a) as allergens,
      array(select lower(i) from unnest(coalesce(up.ingredientes_odiados, '{}'::text[])) as i) as disliked,
      up.dieta_vegetariano, up.dieta_vegano, up.dieta_sin_gluten, up.dieta_sin_lactosa,
      up.dieta_sin_huevo, up.dieta_keto, up.dieta_halal
    from public.user_profiles up
    where up.id = p_to_user_id
  ),
  neutralized as (
    update public.meal_plan_recipes mpr
    set estado = 'excluida', recipe_id = null
    from public.recipes r, target_profile tp
    where mpr.meal_plan_id = any (v_moved_plan_ids)
      and mpr.recipe_id = r.id
      and (
        not r.activo
        or exists (
          select 1
          from jsonb_array_elements_text(coalesce(r.alergenos, '[]'::jsonb)) as ra(val)
          where lower(ra.val) = any (tp.allergens)
        )
        or exists (
          select 1
          from jsonb_array_elements_text(coalesce(r.ingredientes_principales, '[]'::jsonb)) as ri(val)
          where lower(ri.val) = any (tp.disliked)
        )
        or (tp.dieta_vegetariano and not coalesce((r.dieta->>'vegetariano')::boolean, false))
        or (tp.dieta_vegano      and not coalesce((r.dieta->>'vegano')::boolean, false))
        or (tp.dieta_sin_gluten  and not coalesce((r.dieta->>'sin_gluten')::boolean, false))
        or (tp.dieta_sin_lactosa and not coalesce((r.dieta->>'sin_lactosa')::boolean, false))
        or (tp.dieta_sin_huevo   and not coalesce((r.dieta->>'sin_huevo')::boolean, false))
        or (tp.dieta_keto        and not coalesce((r.dieta->>'keto')::boolean, false))
        or (tp.dieta_halal       and not coalesce((r.dieta->>'halal')::boolean, false))
      )
    returning mpr.id
  )
  select count(*) into v_excluded_slots from neutralized;

  if v_excluded_slots > 0 then
    raise log 'reassign_guest_data: neutralized % slot(s) failing the target-profile food-safety filter (from % to %)',
      v_excluded_slots, p_from_user_id, p_to_user_id;
  end if;

  -- Drop the now-orphaned guest profile. Anything left behind (a week that
  -- conflicted above) cascade-deletes with it -- the target's own data for
  -- that week is the one that survives. The target's own profile (diet,
  -- allergens, etc.) is never touched here.
  delete from public.user_profiles where id = p_from_user_id;

  return v_excluded_slots;
end;
$$;

comment on function public.reassign_guest_data(uuid, uuid) is
  'ADR-0004 (FRESCO-20) + A4-H2 (FRESCO-362) + A8-AUTHZ-01 (FRESCO-1089): moves a guest session''s meal_plans/shopping_lists to a real account, re-filters the moved slots against the target account''s profile (allergens, diet, disliked ingredients, inactive recipes; offenders -> estado excluida, recipe_id null), deletes the orphaned guest profile, and returns the count of neutralized slots. service_role only -- called exclusively by the reassign-guest-data Edge Function after it verifies the target account''s password.';

revoke execute on function public.reassign_guest_data(uuid, uuid) from public;
revoke execute on function public.reassign_guest_data(uuid, uuid) from anon;
revoke execute on function public.reassign_guest_data(uuid, uuid) from authenticated;
grant execute on function public.reassign_guest_data(uuid, uuid) to service_role;
