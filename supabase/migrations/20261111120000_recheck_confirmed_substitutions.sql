-- FRESCO-1154 (revisión integral, hallazgo FS-3): a confirmed ingredient substitution was checked against the
-- profile once, when it was confirmed (confirm_ingredient_substitution asks get_safe_ingredient_substitutes),
-- and used for ever after. Two ways it went stale: the person confirms gambas -> tofu firme (tagged soy) and
-- later declares soy; or a guest confirms it and the guest data moves to an account that declares soy (the
-- recipe passes that account's filter, so the slot survives). The shopping list kept buying the tofu and the
-- recipe sheet kept showing it as the active substitute.
--
-- The substitution is now re-checked with the SAME rule that let it be confirmed (allergen overlap, disliked
-- ingredient and diet flags of get_safe_ingredient_substitutes, inlined because that function reads
-- auth.uid()) at every write that can make it unsafe, and cleared when it no longer passes. Only the swap
-- goes: the dish stays. A substitution with no row left in the catalogue is cleared too, because the
-- function returns nothing for it (fail closed). One advertencias entry per affected plan tells the person;
-- the shopping list is flagged stale by mark_shopping_list_stale (FRESCO-1010), which also fires when
-- sustitucion_ingrediente changes, and the screen offers to rebuild it.
--
-- The write points:
--   * a change in the profile: retire_conflicting_slots (FRESCO-1151) already runs then, and now also calls
--     the new helper for the current week and later;
--   * reassigning guest data: reassign_guest_data calls the helper for the plans it moved, against the
--     TARGET profile;
--   * a change in the catalogue substitute (its allergens, diet flags, names, or the row being deleted):
--     a trigger re-checks the people who confirmed that pair, current week and later.
--
-- Authorization (rpc-authorization.md section 4): the helper takes a user id and is SECURITY DEFINER, but NO
-- client role can execute it (revoked from public, anon, authenticated and service_role); only
-- retire_conflicting_slots, reassign_guest_data and the catalogue trigger call it, with the id of the profile
-- that changed, the target account of a reassignment, or the owner of a slot that holds the changed pair.
-- Every row it updates is scoped to meal_plans.user_id = p_user_id. It does not write around the slot
-- protection trigger by itself: it runs inside callers that are already trusted writers (the profile path
-- opens the trusted write, the reassignment runs as service_role, a catalogue change is made by an admin).

create or replace function public.clear_conflicting_substitutions(p_user_id uuid, p_plan_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_semana text := to_char(now() at time zone 'Europe/Madrid', 'IYYY-"W"IW');
  v_plan record;
  v_cleared integer := 0;
  v_mensaje text;
begin
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
    limpiadas as (
      update public.meal_plan_recipes mpr
      set sustitucion_ingrediente = null
      from public.meal_plans mp, perfil tp
      where mp.id = mpr.meal_plan_id
        and mp.user_id = p_user_id
        and case when p_plan_ids is null then mp.semana_iso >= v_semana else mp.id = any (p_plan_ids) end
        and mpr.sustitucion_ingrediente is not null
        and not exists (
          select 1
          from public.ingredient_substitutions c
          where lower(c.ingrediente_original) = lower(mpr.sustitucion_ingrediente->>'original')
            and lower(c.ingrediente_sustituto) = lower(mpr.sustitucion_ingrediente->>'sustituto')
            and not (c.alergenos && tp.alergenos)
            and not (lower(c.ingrediente_sustituto) = any (tp.odiados))
            and (not tp.dieta_vegetariano or coalesce((c.dieta->>'vegetariano')::boolean, false))
            and (not tp.dieta_vegano      or coalesce((c.dieta->>'vegano')::boolean, false))
            and (not tp.dieta_sin_gluten  or coalesce((c.dieta->>'sin_gluten')::boolean, false))
            and (not tp.dieta_sin_lactosa or coalesce((c.dieta->>'sin_lactosa')::boolean, false))
            and (not tp.dieta_sin_huevo   or coalesce((c.dieta->>'sin_huevo')::boolean, false))
            and (not tp.dieta_keto        or coalesce((c.dieta->>'keto')::boolean, false))
            and (not tp.dieta_halal       or coalesce((c.dieta->>'halal')::boolean, false))
        )
      returning mpr.meal_plan_id
    )
    select meal_plan_id, count(*)::integer as n from limpiadas group by meal_plan_id
  loop
    v_cleared := v_cleared + v_plan.n;
    v_mensaje := case
      when v_plan.n = 1 then 'Hemos quitado la sustitución de ingrediente de un plato porque ya no encaja con tu perfil. Revisa la receta y actualiza la lista de la compra.'
      else format('Hemos quitado la sustitución de ingrediente de %s platos porque ya no encajan con tu perfil. Revisa las recetas y actualiza la lista de la compra.', v_plan.n)
    end;
    update public.meal_plans
    set advertencias = array_append(
      array(select a from unnest(advertencias) as a where a not like 'Hemos quitado la sustitución de ingrediente de % con tu perfil.%'),
      v_mensaje
    )
    where id = v_plan.meal_plan_id
      and user_id = p_user_id;
  end loop;

  if v_cleared > 0 then
    raise log 'clear_conflicting_substitutions: cleared % substitution(s) that conflict with the profile of %', v_cleared, p_user_id;
  end if;
  return v_cleared;
end;
$$;

comment on function public.clear_conflicting_substitutions(uuid, uuid[]) is
  'FRESCO-1154: clears the confirmed ingredient substitutions (meal_plan_recipes.sustitucion_ingrediente) that get_safe_ingredient_substitutes would no longer return for the user''s profile, for the current week and later, or only for the given plans, and adds one advertencias entry per affected plan. Internal: executable only by retire_conflicting_slots, reassign_guest_data and the catalogue trigger, no client role.';

revoke execute on function public.clear_conflicting_substitutions(uuid, uuid[]) from public, anon, authenticated, service_role;

-- 1. A change in the profile: retire_conflicting_slots (FRESCO-1151) now also re-checks the substitutions.
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
      set estado = 'excluida', recipe_id = null, sustitucion_ingrediente = null
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

-- 2. Reassigning guest data: re-check the substitutions of the moved plans against the TARGET profile.
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
  'ADR-0004 (FRESCO-20) + A4-H2 (FRESCO-362) + A8-AUTHZ-01 (FRESCO-1089) + FRESCO-1154: moves a guest session''s meal_plans/shopping_lists to a real account, re-filters the moved slots against the target account''s profile (allergens, diet, disliked ingredients, inactive recipes; offenders -> estado excluida, recipe_id null), clears the confirmed ingredient substitutions that the target profile no longer allows, deletes the orphaned guest profile, and returns the count of neutralized slots. service_role only -- called exclusively by the reassign-guest-data Edge Function after it verifies the target account''s password.';

revoke execute on function public.reassign_guest_data(uuid, uuid) from public;
revoke execute on function public.reassign_guest_data(uuid, uuid) from anon;
revoke execute on function public.reassign_guest_data(uuid, uuid) from authenticated;
grant execute on function public.reassign_guest_data(uuid, uuid) to service_role;

-- 3. A change in a catalogue substitute re-checks the people who confirmed that pair, this week and later.
create or replace function public.clear_substitutions_after_catalogue_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_semana text := to_char(now() at time zone 'Europe/Madrid', 'IYYY-"W"IW');
  v_user uuid;
begin
  for v_user in
    select distinct mp.user_id
    from public.meal_plan_recipes mpr
    join public.meal_plans mp on mp.id = mpr.meal_plan_id
    where mp.semana_iso >= v_semana
      and lower(mpr.sustitucion_ingrediente->>'original') = lower(old.ingrediente_original)
      and lower(mpr.sustitucion_ingrediente->>'sustituto') = lower(old.ingrediente_sustituto)
  loop
    perform public.clear_conflicting_substitutions(v_user, null);
  end loop;
  return null;
end;
$$;

revoke execute on function public.clear_substitutions_after_catalogue_change() from public, anon, authenticated, service_role;

create trigger ingredient_substitutions_clear_conflicting_after_update
  after update of ingrediente_original, ingrediente_sustituto, alergenos, dieta
  on public.ingredient_substitutions
  for each row
  when (
    old.ingrediente_original is distinct from new.ingrediente_original
    or old.ingrediente_sustituto is distinct from new.ingrediente_sustituto
    or old.alergenos is distinct from new.alergenos
    or old.dieta is distinct from new.dieta
  )
  execute function public.clear_substitutions_after_catalogue_change();

create trigger ingredient_substitutions_clear_conflicting_after_delete
  after delete
  on public.ingredient_substitutions
  for each row
  execute function public.clear_substitutions_after_catalogue_change();
