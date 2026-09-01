-- FRESCO-362 (audit-4 A4-H2): reassign_guest_data() moved a guest's meal_plans
-- to the target account without re-filtering them against THAT account's
-- allergen profile. The moved plans were built against the guest's profile, so
-- a plan could carry a recipe with an allergen the target account declared.
--
-- This migration rewrites the function to, after the move, re-filter every
-- MOVED slot against the target profile's declared allergens (the same
-- case-insensitive match get_filtered_recipes has used since FRESCO-361) and
-- neutralize any offending slot: estado 'excluida', recipe_id null — exactly
-- the shape menu generation writes for a slot with no safe recipe
-- (20260731150000_allow_null_recipe_id_for_unsafe_slots.sql,
-- 20260817090100_add_excluida_estado_receta_menu.sql).
--
-- The return type changes (void -> integer: count of neutralized slots), which
-- Postgres cannot do via CREATE OR REPLACE, hence the DROP. Grants/comment are
-- re-issued after the recreate. Only service_role may EXECUTE, and only the
-- reassign-guest-data Edge Function holds that role (ADR-0004) — unchanged.

drop function if exists public.reassign_guest_data(uuid, uuid);

create function public.reassign_guest_data(p_from_user_id uuid, p_to_user_id uuid)
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
  -- actually moved so the allergen re-filter below touches only those.
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

  -- A4-H2: re-filter the moved slots against the TARGET profile's allergens.
  with target_allergens as (
    select array(
      select lower(a) from unnest(coalesce(up.alergenos, '{}'::text[])) as a
    ) as al
    from public.user_profiles up
    where up.id = p_to_user_id
  ),
  neutralized as (
    update public.meal_plan_recipes mpr
    set estado = 'excluida', recipe_id = null
    from public.recipes r, target_allergens ta
    where mpr.meal_plan_id = any (v_moved_plan_ids)
      and mpr.recipe_id = r.id
      and array_length(ta.al, 1) is not null
      and exists (
        select 1
        from jsonb_array_elements_text(coalesce(r.alergenos, '[]'::jsonb)) as ra(val)
        where lower(ra.val) = any (ta.al)
      )
    returning mpr.id
  )
  select count(*) into v_excluded_slots from neutralized;

  if v_excluded_slots > 0 then
    raise log 'reassign_guest_data: neutralized % slot(s) carrying a target-profile allergen (from % to %)',
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
  'ADR-0004 (FRESCO-20) + A4-H2 (FRESCO-362): moves a guest session''s meal_plans/shopping_lists to a real account, re-filters the moved slots against the target account''s allergen profile (offenders -> estado excluida, recipe_id null), deletes the orphaned guest profile, and returns the count of neutralized slots. service_role only -- called exclusively by the reassign-guest-data Edge Function after it verifies the target account''s password.';

revoke execute on function public.reassign_guest_data(uuid, uuid) from public;
revoke execute on function public.reassign_guest_data(uuid, uuid) from anon;
revoke execute on function public.reassign_guest_data(uuid, uuid) from authenticated;
grant execute on function public.reassign_guest_data(uuid, uuid) to service_role;
