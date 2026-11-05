-- FRESCO-1127 (audit 8 A8-LOGIC-05): copy_meal_plan_to_week reset every copied slot to 'pendiente', so a
-- franja the user had excluded ('excluida', recipe_id null) came back as an empty "Sin receta" slot that looks
-- like a failed generation and counts as open. An 'excluida' source slot now stays 'excluida'; every other
-- slot is still copied as 'pendiente'. Same signature, SECURITY DEFINER and search_path; CREATE OR REPLACE
-- keeps the existing grants. Nothing else in the body changes.

CREATE OR REPLACE FUNCTION public.copy_meal_plan_to_week(p_source_meal_plan_id uuid, p_semana_iso text, p_fecha_inicio date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_source public.meal_plans;
  v_new_id uuid;
  v_allowed uuid[];
  v_dropped text[];
  v_advertencias text[] := '{}';
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
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

  -- FRESCO-1012 (audit 7b A7-AUTHZ-02): a plan can only be copied into the current or the next ISO week
  -- (Madrid), and the Monday must be that week's. Without it one account could mint plans for hundreds of
  -- weeks holding a chosen recipe and move the global cook/discard counters.
  if p_semana_iso is distinct from to_char(v_hoy, 'IYYY-"W"IW')
     and p_semana_iso is distinct from to_char(v_hoy + 7, 'IYYY-"W"IW') then
    raise exception 'copy_meal_plan_to_week: target week % must be the current or the next week', p_semana_iso
      using errcode = '22023';
  end if;

  if p_fecha_inicio is distinct from to_date(p_semana_iso, 'IYYY-"W"IW') then
    raise exception 'copy_meal_plan_to_week: fecha_inicio % is not the Monday of week %', p_fecha_inicio, p_semana_iso
      using errcode = '22023';
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
    case when mpr.estado = 'excluida' then 'excluida' else 'pendiente' end::public.estado_receta_menu
  from public.meal_plan_recipes mpr
  where mpr.meal_plan_id = p_source_meal_plan_id;

  return v_new_id;
end;
$function$;
