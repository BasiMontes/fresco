-- FRESCO-994 (audit-7b A7-AUTHZ-01 + A7-TEST-02): "Usar este menú" re-applied no
-- food-safety rule.
--
-- `copy_meal_plan_to_week` copied every slot of the source week as it was, so the
-- recipes reached the new plan without passing `get_filtered_recipes` (ADR-0001:
-- the one structural food-safety enforcement point). A user who declared an
-- allergen after that week was generated, whose diet changed, or whose recipe was
-- re-tagged or retired since, got the dish back. Every other write path already
-- filters: the generator through the selector, `assign_recipe_to_slot` and
-- `confirm_ingredient_substitution` through `get_filtered_recipes`.
--
-- Authorization (rpc-authorization.md section 4, answered in the FRESCO-994 plan):
--   * Still SECURITY DEFINER: `authenticated` has no INSERT on `meal_plans` /
--     `meal_plan_recipes` (FRESCO-777), so an INVOKER copy could not write.
--   * No identity parameter: the actor is `auth.uid()`. The only caller-supplied
--     scope is the source plan id, read behind the ownership-folded existence
--     check of FRESCO-736 (one generic "not found" for missing and foreign).
--   * The filter is `get_filtered_recipes(auth.uid())`, which itself rejects any
--     other user id, plus `activo` (it does not exclude retired recipes by itself).
--
-- A slot whose recipe no longer passes is written with `recipe_id = null`,
-- `estado = 'pendiente'`: the shape the generator already stores for
-- `SIN_RECETA_SEGURA` (a visible gap the user can fill from the Biblioteca), never
-- an invented recipe. The new plan carries ONE aggregated `advertencias` entry
-- naming those slots; one per slot could not fit, because
-- `meal_plans_advertencias_bounds` caps the array at 20 entries and a plan has 21
-- slots. A slot that was already empty (a gap or an excluded franja) is copied as
-- before and is not reported.
--
-- Rate limit: the RPC had none (FRESCO-383 added it to its sibling
-- `swap_meal_plan_slots`). 20 per hour, same fixed-hour window and mechanism as
-- the Edge Functions (ADR-0010). The counter is checked after the ownership
-- check, so a probe for ids that do not exist does not spend the caller's budget
-- and the check cannot tell the two cases apart. A call that raises later rolls
-- the increment back with the rest of the transaction.

insert into public.rate_limit_endpoints (endpoint, max_per_hour) values
  ('copy_meal_plan_to_week', 20);

create or replace function public.copy_meal_plan_to_week(
  p_source_meal_plan_id uuid,
  p_semana_iso text,
  p_fecha_inicio date
)
returns uuid as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.meal_plans;
  v_new_id uuid;
  v_allowed uuid[];
  v_dropped text[];
  v_advertencias text[] := '{}';
begin
  -- FRESCO-736: ownership folded into the existence check, a source plan owned
  -- by another user is indistinguishable from one that does not exist.
  select * into v_source
  from public.meal_plans
  where id = p_source_meal_plan_id and user_id = v_user_id;

  if not found then
    raise exception 'copy_meal_plan_to_week: source plan % not found', p_source_meal_plan_id;
  end if;

  if not public.check_and_increment_rate_limit(v_user_id, 'copy_meal_plan_to_week', 20, 3600) then
    raise exception 'copy_meal_plan_to_week: rate limit exceeded';
  end if;

  if v_source.semana_iso = p_semana_iso then
    raise exception 'copy_meal_plan_to_week: source plan is already the target week %', p_semana_iso;
  end if;

  -- Food safety, server side (FRESCO-994): the recipes the caller's CURRENT
  -- profile allows (allergens, diet, disliked ingredients) and that are active.
  -- Read once; a slot is kept only if its recipe is in this set.
  select coalesce(array_agg(f.id), '{}'::uuid[]) into v_allowed
  from public.get_filtered_recipes(v_user_id) f
  where f.activo;

  select array_agg(mpr.dia::text || ' ' || mpr.tipo_plato::text order by mpr.dia, mpr.tipo_plato)
  into v_dropped
  from public.meal_plan_recipes mpr
  where mpr.meal_plan_id = p_source_meal_plan_id
    and mpr.recipe_id is not null
    and mpr.recipe_id <> all (v_allowed);

  if v_dropped is not null then
    v_advertencias := array[format(
      case when cardinality(v_dropped) = 1
        then 'Al copiar el menú se ha dejado un hueco sin receta porque su plato ya no encaja con tu perfil (alérgenos, dieta o ingredientes que evitas) o ya no está disponible: %s.'
        else 'Al copiar el menú se han dejado %s huecos sin receta porque sus platos ya no encajan con tu perfil (alérgenos, dieta o ingredientes que evitas) o ya no están disponibles: %s.'
      end,
      variadic case when cardinality(v_dropped) = 1
        then array[v_dropped[1]]
        else array[cardinality(v_dropped)::text, array_to_string(v_dropped, ', ')]
      end
    )];
  end if;

  -- Replace any existing plan for the target week. `on delete cascade` on
  -- meal_plan_recipes.meal_plan_id removes its 21 children with it.
  delete from public.meal_plans
  where user_id = v_user_id and semana_iso = p_semana_iso;

  insert into public.meal_plans (user_id, semana_iso, fecha_inicio, advertencias)
  values (v_user_id, p_semana_iso, p_fecha_inicio, v_advertencias)
  returning id into v_new_id;

  insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato, estado)
  select
    v_new_id,
    case when mpr.recipe_id = any (v_allowed) then mpr.recipe_id else null end,
    mpr.dia,
    mpr.tipo_plato,
    'pendiente'
  from public.meal_plan_recipes mpr
  where mpr.meal_plan_id = p_source_meal_plan_id;

  return v_new_id;
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.copy_meal_plan_to_week(uuid, text, date) is
  'FRESCO-427: atomically copy an owned meal_plans row''s slots onto the target ISO week, replacing any existing plan there. estado reset to pendiente. FRESCO-736: existence + ownership checked as one query, single generic error either way (non-disclosure). FRESCO-994: every recipe is re-checked through get_filtered_recipes(auth.uid()) + activo; a slot whose recipe no longer passes is copied empty (recipe_id null, pendiente) with one aggregated advertencias entry on the new plan; rate limited at 20/hour (rate_limit_endpoints).';
