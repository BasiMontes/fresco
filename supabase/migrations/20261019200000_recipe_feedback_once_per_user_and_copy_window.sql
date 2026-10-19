-- FRESCO-1012 (audit 7b A7-AUTHZ-02, A7-LOGIC-05/09/10): the global recipe ranking stops being movable
-- from one account, and the rating signal is retired.
--
--  1. recipe_user_feedback: learning is counted once per (user, recipe). The trigger used to add 1 to
--     veces_cocinada / veces_descartada on EVERY state change of every slot, so one account copying a plan
--     into hundreds of weeks and discarding the same recipe in each buried it for everybody (3 discards
--     already cost a recipe 4 points). The aggregate now moves only the first time a user cooks or
--     discards a recipe. The table is backfilled from the marks that already exist so those are not
--     counted again; the counters themselves are NOT recomputed: the hosted ones (211 cooked, 102
--     discarded) are mostly seed values that no mark explains.
--  2. update_recipe_learning no longer touches rating_promedio / veces_calificada (ADR-0063): no screen
--     ever sent a rating, the menu selector no longer weighs it, and it was the term a single account could
--     move the most. The columns stay (they are history, not worth a destructive drop).
--  3. copy_meal_plan_to_week only targets the current or the next ISO week (Madrid), and fecha_inicio must
--     be that week's Monday.

create table public.recipe_user_feedback (
  user_id       uuid not null references auth.users(id) on delete cascade,
  recipe_id     uuid not null references public.recipes(id) on delete cascade,
  cocinada_at   timestamptz,
  descartada_at timestamptz,
  primary key (user_id, recipe_id)
);

comment on table public.recipe_user_feedback is
  'FRESCO-1012. First time each user cooked / discarded each recipe: the global counters on recipes move once per (user, recipe). Written only by update_recipe_learning().';

alter table public.recipe_user_feedback enable row level security;
revoke all on public.recipe_user_feedback from public, anon, authenticated;
grant select on public.recipe_user_feedback to service_role;

insert into public.recipe_user_feedback (user_id, recipe_id, cocinada_at, descartada_at)
select mp.user_id,
       mpr.recipe_id,
       min(mpr.updated_at) filter (where mpr.estado = 'cocinada'),
       min(mpr.updated_at) filter (where mpr.estado = 'descartada')
from public.meal_plan_recipes mpr
join public.meal_plans mp on mp.id = mpr.meal_plan_id
where mpr.estado in ('cocinada', 'descartada')
  and mpr.recipe_id is not null
group by mp.user_id, mpr.recipe_id
on conflict do nothing;

create or replace function public.update_recipe_learning()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user uuid;
  v_first integer;
begin
  -- FRESCO-383: swap_meal_plan_slots sets this for its transaction so a learning-neutral position swap
  -- does not record phantom cocinada/descartada events.
  if current_setting('app.skip_recipe_learning', true) is not distinct from 'on' then
    return new;
  end if;

  -- Only act on an actual state transition
  if old.estado = new.estado then
    return new;
  end if;

  if new.recipe_id is null or new.estado not in ('cocinada', 'descartada') then
    return new;
  end if;

  select user_id into v_user from public.meal_plans where id = new.meal_plan_id;
  if v_user is null then
    return new;
  end if;

  if new.estado = 'cocinada' then
    insert into public.recipe_user_feedback as f (user_id, recipe_id, cocinada_at)
    values (v_user, new.recipe_id, now())
    on conflict (user_id, recipe_id) do update set cocinada_at = excluded.cocinada_at
    where f.cocinada_at is null;
    get diagnostics v_first = row_count;

    update public.recipes
    set veces_cocinada     = veces_cocinada + v_first,
        ultima_vez_en_menu = current_date
    where id = new.recipe_id;

  else
    insert into public.recipe_user_feedback as f (user_id, recipe_id, descartada_at)
    values (v_user, new.recipe_id, now())
    on conflict (user_id, recipe_id) do update set descartada_at = excluded.descartada_at
    where f.descartada_at is null;
    get diagnostics v_first = row_count;

    update public.recipes
    set veces_descartada = veces_descartada + v_first
    where id = new.recipe_id;
  end if;

  return new;
end;
$$;

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
    'pendiente'
  from public.meal_plan_recipes mpr
  where mpr.meal_plan_id = p_source_meal_plan_id;

  return v_new_id;
end;
$function$;
