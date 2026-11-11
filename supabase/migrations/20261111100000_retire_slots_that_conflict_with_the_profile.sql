-- FRESCO-1151 (revisión integral, hallazgo FS-1): a menu already generated was never re-checked.
-- Declaring an allergen or a diet after generating the week, or re-tagging a recipe in the catalogue,
-- left the now forbidden dish in the menu of this week and the next ones, with no warning.
--
-- Owner decision (2026-11-11): the dish is taken out by itself and the person is told, instead of
-- being left in sight with a warning. It is the same fail-closed answer the guest reassignment
-- (FRESCO-362, FRESCO-1089) and copy-week (FRESCO-994) already give.
--
-- What it does:
--   * retire_conflicting_slots(user) puts every `pendiente` or `sustituida` slot of this ISO week
--     (Europe/Madrid) and the following ones whose recipe now breaks that user's profile into
--     `excluida`, `recipe_id` null, no ingredient substitution. The rules are the four of
--     get_filtered_recipes (ADR-0001), inlined as reassign_guest_data does: declared allergens, diet
--     flags, disliked ingredients and `recipes.activo`. Past weeks and cooked or discarded slots are
--     never touched: they happened.
--   * It adds ONE entry to `meal_plans.advertencias` per affected plan (the banner of /menu and
--     /calendar already shows it) and replaces the entry a previous run left, so repeating it never
--     stacks warnings. A change that conflicts with nothing writes nothing.
--   * Two triggers call it, so every path that changes the profile or the catalogue is covered
--     without each one having to remember: user_profiles (allergens, disliked ingredients, diet
--     flags) and recipes (allergens, diet, main ingredients, activo).
--   * The shopping list is left alone on purpose: mark_shopping_list_stale (FRESCO-1010) already
--     flags the list when a slot loses its recipe, and the screen offers "Actualizar lista", which
--     rebuilds it without those dishes.
--   * A one-off sweep at the end retires the conflicts that already exist.
--
-- Authorization (rpc-authorization.md section 4):
--   * SECURITY DEFINER is needed: `estado` and `recipe_id` of a slot can only change through the
--     paths protect_meal_plan_recipes_integrity trusts (it checks app.mpr_trusted_write), and the
--     two columns must change together with the warning. search_path is pinned with pg_temp.
--   * The helper takes a user id, but NO client role can execute it (revoked from public, anon,
--     authenticated and service_role): only the two trigger functions call it, with the id of the
--     profile row that changed, or of the owner of a slot that holds the changed recipe. The trigger
--     functions take no parameter at all.
--   * Every row it updates is scoped to meal_plans.user_id = p_user_id; nothing is returned to a
--     client.

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

  perform set_config('app.mpr_trusted_write', 'off', true);
  perform set_config('app.skip_recipe_learning', 'off', true);

  if v_retired > 0 then
    raise log 'retire_conflicting_slots: retired % slot(s) that conflict with the profile of %', v_retired, p_user_id;
  end if;
  return v_retired;
end;
$$;

comment on function public.retire_conflicting_slots(uuid) is
  'FRESCO-1151: puts the pendiente/sustituida slots of this ISO week and later whose recipe now conflicts with the user''s profile (allergens, diet, disliked ingredients, inactive recipe) into estado excluida with recipe_id null, and adds one advertencias entry per affected plan. Internal: executable only by its two triggers, no client role.';

revoke execute on function public.retire_conflicting_slots(uuid) from public, anon, authenticated, service_role;

-- A change in the profile re-checks that person's menu.
create or replace function public.retire_slots_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.retire_conflicting_slots(new.id);
  return null;
end;
$$;

revoke execute on function public.retire_slots_after_profile_change() from public, anon, authenticated, service_role;

create trigger user_profiles_retire_conflicting_slots
  after update of alergenos, ingredientes_odiados, dieta_vegetariano, dieta_vegano, dieta_sin_gluten,
    dieta_sin_lactosa, dieta_sin_huevo, dieta_keto, dieta_halal
  on public.user_profiles
  for each row
  when (
    old.alergenos is distinct from new.alergenos
    or old.ingredientes_odiados is distinct from new.ingredientes_odiados
    or old.dieta_vegetariano is distinct from new.dieta_vegetariano
    or old.dieta_vegano is distinct from new.dieta_vegano
    or old.dieta_sin_gluten is distinct from new.dieta_sin_gluten
    or old.dieta_sin_lactosa is distinct from new.dieta_sin_lactosa
    or old.dieta_sin_huevo is distinct from new.dieta_sin_huevo
    or old.dieta_keto is distinct from new.dieta_keto
    or old.dieta_halal is distinct from new.dieta_halal
  )
  execute function public.retire_slots_after_profile_change();

-- A change in the catalogue re-checks every menu that holds the recipe, this week and later.
create or replace function public.retire_slots_after_recipe_change()
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
    where mpr.recipe_id = new.id
      and mp.semana_iso >= v_semana
      and mpr.estado in ('pendiente', 'sustituida')
  loop
    perform public.retire_conflicting_slots(v_user);
  end loop;
  return null;
end;
$$;

revoke execute on function public.retire_slots_after_recipe_change() from public, anon, authenticated, service_role;

create trigger recipes_retire_conflicting_slots
  after update of alergenos, dieta, ingredientes_principales, activo
  on public.recipes
  for each row
  when (
    old.alergenos is distinct from new.alergenos
    or old.dieta is distinct from new.dieta
    or old.ingredientes_principales is distinct from new.ingredientes_principales
    or old.activo is distinct from new.activo
  )
  execute function public.retire_slots_after_recipe_change();

-- One-off: retire the conflicts that already exist, for every account with a plan this week or later.
do $$
declare
  v_user uuid;
  v_semana text := to_char(now() at time zone 'Europe/Madrid', 'IYYY-"W"IW');
begin
  for v_user in
    select distinct mp.user_id from public.meal_plans mp where mp.semana_iso >= v_semana
  loop
    perform public.retire_conflicting_slots(v_user);
  end loop;
end;
$$;
