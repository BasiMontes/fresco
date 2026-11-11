-- FRESCO-1157 (revisión integral, hallazgo FS-7): when a dish is taken out because it does not fit the profile,
-- the slot was left `excluida`, which the calendar paints "Excluida por ti" and which no recipe can be put into
-- (assign_recipe_to_slot only opens `pendiente` and `sustituida` slots). Two things were wrong:
--   * the label says the person chose it, when it was the profile (`excluida` is only ever assigned by the system:
--     the user's own meal choice at generation, the weekdays already over, and, since FRESCO-1151 and
--     FRESCO-362/1089, food safety; the database stores no reason, and 20261106100000 left it written that a
--     stored reason would be the answer if a third reason appeared);
--   * the notice of FRESCO-1151 says "rellena el hueco con otra receta", which was not possible for such a slot.
--
-- Both are fixed without a new column: a dish taken out for the profile now leaves an OPEN empty slot (`pendiente`,
-- no recipe), exactly what copy_meal_plan_to_week already does for a recipe that no longer passes (FRESCO-994). The
-- calendar paints it "Sin receta", which is true, and the person can put another recipe in it. `excluida` goes back
-- to meaning only what it can honestly say.
--
-- retire_conflicting_slots (FRESCO-1151) leaves `pendiente`. reassign_guest_data does the same for the open slots
-- it neutralizes (`pendiente`, `sustituida`); a slot that was already cooked, discarded or excluded keeps being
-- hidden as `excluida`, as before, so a moved guest's history is not rewritten. reassign_guest_data also writes the
-- same advertencias notice per moved plan, with the number of dishes taken out (copy-week already warned; this did
-- not), and clears the ingredient substitution of a neutralized slot. Its return value, the count, is unchanged; the
-- Edge function now returns it as `slots_quitados` instead of only logging it.
--
-- Authorization is unchanged for both (rpc-authorization.md section 4): same signatures, SECURITY DEFINER,
-- search_path, and execute grants (retire_conflicting_slots: no client role; reassign_guest_data: service_role).
-- `retire_conflicting_slots` still mentions the trusted-write setting and is in the pgTAP allowlist.

create or replace function public.retire_conflicting_slots(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_semana text := to_char(now() at time zone 'Europe/Madrid', 'IYYY-"W"IW');
  v_plan record;
  v_retired integer := 0;
  v_mensaje text;
begin
  -- A trusted write that is not a learning signal: the person did not cook or discard these dishes.
  perform set_config('app.mpr_trusted_write', 'on', true);
  perform set_config('app.skip_recipe_learning', 'on', true);

  for v_plan in
    with perfil as (
      select
        array(select lower(a) from unnest(coalesce(up.alergenos, '{}'::text[])) as a) as alergenos,
        array(select lower(i) from unnest(coalesce(up.ingredientes_odiados, '{}'::text[])) as i) as odiados,
        up.dieta_vegetariano, up.dieta_vegano, up.dieta_sin_gluten, up.dieta_sin_lactosa,
        up.dieta_sin_huevo, up.dieta_keto, up.dieta_halal
      from public.user_profiles up
      where up.id = p_user_id
    ),
    retirados as (
      update public.meal_plan_recipes mpr
      set estado = 'pendiente', recipe_id = null, sustitucion_ingrediente = null
      from public.meal_plans mp, public.recipes r, perfil tp
      where mp.id = mpr.meal_plan_id
        and mp.user_id = p_user_id
        and mp.semana_iso >= v_semana
        and mpr.estado in ('pendiente', 'sustituida')
        and mpr.recipe_id = r.id
        and (
          not r.activo
          or exists (
            select 1
            from jsonb_array_elements_text(coalesce(r.alergenos, '[]'::jsonb)) as ra(val)
            where lower(ra.val) = any (tp.alergenos)
          )
          or exists (
            select 1
            from jsonb_array_elements_text(coalesce(r.ingredientes_principales, '[]'::jsonb)) as ri(val)
            where lower(ri.val) = any (tp.odiados)
          )
          or (tp.dieta_vegetariano and not coalesce((r.dieta->>'vegetariano')::boolean, false))
          or (tp.dieta_vegano      and not coalesce((r.dieta->>'vegano')::boolean, false))
          or (tp.dieta_sin_gluten  and not coalesce((r.dieta->>'sin_gluten')::boolean, false))
          or (tp.dieta_sin_lactosa and not coalesce((r.dieta->>'sin_lactosa')::boolean, false))
          or (tp.dieta_sin_huevo   and not coalesce((r.dieta->>'sin_huevo')::boolean, false))
          or (tp.dieta_keto        and not coalesce((r.dieta->>'keto')::boolean, false))
          or (tp.dieta_halal       and not coalesce((r.dieta->>'halal')::boolean, false))
        )
      returning mpr.meal_plan_id
    )
    select meal_plan_id, count(*)::integer as n from retirados group by meal_plan_id
  loop
    v_retired := v_retired + v_plan.n;
    v_mensaje := case
      when v_plan.n = 1 then 'Hemos quitado de tu menú un plato que ya no encaja con tu perfil. Actualiza la lista de la compra y rellena el hueco con otra receta.'
      else format('Hemos quitado de tu menú %s platos que ya no encajan con tu perfil. Actualiza la lista de la compra y rellena los huecos con otras recetas.', v_plan.n)
    end;
    update public.meal_plans
    set advertencias = array_append(
      array(select a from unnest(advertencias) as a where a not like 'Hemos quitado de tu menú % con tu perfil.%'),
      v_mensaje
    )
    where id = v_plan.meal_plan_id
      and user_id = p_user_id;
  end loop;

  -- FRESCO-1154: the dishes that stay may carry a confirmed substitution the profile no longer allows.
  perform public.clear_conflicting_substitutions(p_user_id, null);

  perform set_config('app.mpr_trusted_write', 'off', true);
  perform set_config('app.skip_recipe_learning', 'off', true);

  if v_retired > 0 then
    raise log 'retire_conflicting_slots: retired % slot(s) that conflict with the profile of %', v_retired, p_user_id;
  end if;
  return v_retired;
end;
$$;

create or replace function public.reassign_guest_data(p_from_user_id uuid, p_to_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved_plan_ids uuid[];
  v_excluded_slots integer := 0;
  v_plan record;
  v_mensaje text;
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
  -- get_filtered_recipes (FRESCO-361). FRESCO-1157: an open slot stays open and empty, and each moved plan is told
  -- how many dishes were taken out; a slot already cooked, discarded or excluded keeps being hidden as excluida.
  for v_plan in
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
      set estado = (case when mpr.estado in ('pendiente', 'sustituida') then 'pendiente' else 'excluida' end)::public.estado_receta_menu,
          recipe_id = null,
          sustitucion_ingrediente = null
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
      returning mpr.meal_plan_id
    )
    select meal_plan_id, count(*)::integer as n from neutralized group by meal_plan_id
  loop
    v_excluded_slots := v_excluded_slots + v_plan.n;
    v_mensaje := case
      when v_plan.n = 1 then 'Hemos quitado de tu menú un plato que ya no encaja con tu perfil. Actualiza la lista de la compra y rellena el hueco con otra receta.'
      else format('Hemos quitado de tu menú %s platos que ya no encajan con tu perfil. Actualiza la lista de la compra y rellena los huecos con otras recetas.', v_plan.n)
    end;
    update public.meal_plans
    set advertencias = array_append(
      array(select a from unnest(advertencias) as a where a not like 'Hemos quitado de tu menú % con tu perfil.%'),
      v_mensaje
    )
    where id = v_plan.meal_plan_id
      and user_id = p_to_user_id;
  end loop;

  if v_excluded_slots > 0 then
    raise log 'reassign_guest_data: neutralized % slot(s) failing the target-profile food-safety filter (from % to %)',
      v_excluded_slots, p_from_user_id, p_to_user_id;
  end if;

  -- FRESCO-1154: a substitution the guest confirmed may not pass the target profile although its recipe does.
  -- Only the swap is cleared; the dish stays. The count returned below is still the neutralized slots.
  perform public.clear_conflicting_substitutions(p_to_user_id, v_moved_plan_ids);

  -- Drop the now-orphaned guest profile. Anything left behind (a week that
  -- conflicted above) cascade-deletes with it -- the target's own data for
  -- that week is the one that survives. The target's own profile (diet,
  -- allergens, etc.) is never touched here.
  delete from public.user_profiles where id = p_from_user_id;

  return v_excluded_slots;
end;
$$;

comment on function public.reassign_guest_data(uuid, uuid) is
  'ADR-0004 (FRESCO-20) + A4-H2 (FRESCO-362) + A8-AUTHZ-01 (FRESCO-1089) + FRESCO-1154 + FRESCO-1157: moves a guest session''s meal_plans/shopping_lists to a real account, re-filters the moved slots against the target account''s profile (allergens, diet, disliked ingredients, inactive recipes; an offending open slot -> an open empty slot, recipe_id null, estado pendiente, one advertencias entry per plan; one already cooked, discarded or excluded -> estado excluida), clears the confirmed ingredient substitutions the target profile no longer allows, deletes the orphaned guest profile, and returns the count of neutralized slots. service_role only -- called exclusively by the reassign-guest-data Edge Function after it verifies the target account''s password.';

revoke execute on function public.reassign_guest_data(uuid, uuid) from public;
revoke execute on function public.reassign_guest_data(uuid, uuid) from anon;
revoke execute on function public.reassign_guest_data(uuid, uuid) from authenticated;
grant execute on function public.reassign_guest_data(uuid, uuid) to service_role;
