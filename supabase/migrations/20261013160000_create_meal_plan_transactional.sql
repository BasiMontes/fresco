-- FRESCO-913 (definitive audit C-09): creating the weekly plan is atomic.
--
-- generate-meal-plan inserted the `meal_plans` row and then its slots in two separate calls, with
-- a manual compensating delete if the second failed. Anything that stops the function between the
-- two (a timeout, a crash, a deploy) leaves a plan with no slots, and `unique_user_semana` then
-- answers 409 to every attempt to regenerate that week. Nothing validated `semana_iso` either: any
-- text got in, and any `fecha_inicio`.
--
-- This migration:
--   1. deletes the orphan plans (no slots) that already exist,
--   2. pins `meal_plans.semana_iso` to a real ISO week label with a CHECK,
--   3. adds `create_meal_plan(...)`, one transaction for the plan and all its slots, which also
--      checks that `fecha_inicio` is the Monday of that week.
-- The generator calls the function with the service-role client; no client role can execute it.

-- ── 1. Orphan plans ─────────────────────────────────────────────────────────
-- A plan with no slots holds nothing and blocks regenerating its week. The hour of margin keeps
-- this from deleting a plan the old function is in the middle of creating.

delete from public.meal_plans mp
where mp.created_at < now() - interval '1 hour'
  and not exists (select 1 from public.meal_plan_recipes r where r.meal_plan_id = mp.id);

-- ── 2. A real ISO week label ────────────────────────────────────────────────

alter table public.meal_plans
  add constraint meal_plans_semana_iso_valida
  check (semana_iso ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$');

-- ── 3. The transactional creation ───────────────────────────────────────────
-- SECURITY INVOKER on purpose: the only caller is the service role, which can already insert into
-- both tables, so the function grants nothing a caller does not have (rpc-authorization.md §2).
-- `p_user_id` cannot be removed (the service role has no auth.uid()); the Edge Function takes it
-- from the verified JWT, never from the request body.

create or replace function public.create_meal_plan(
  p_user_id uuid,
  p_semana_iso text,
  p_fecha_inicio date,
  p_advertencias text[],
  p_explicacion_aprendizaje text,
  p_slots jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_plan_id uuid;
  v_monday date;
begin
  -- 0. Actor bind. A NULL auth.uid() is the service-role client, for which the parameter is the only
  --    identity available; a present but different uid is a spoof attempt.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'create_meal_plan: caller does not own this plan' using errcode = 'P0002';
  end if;

  -- 1. The label is a real ISO week. The CHECK on the table catches the shape; the round trip through
  --    to_date also catches week 53 in a year that has only 52.
  if p_semana_iso is null or p_semana_iso !~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$' then
    raise exception 'semana_iso must look like 2026-W41' using errcode = '22023';
  end if;
  v_monday := to_date(p_semana_iso, 'IYYY-"W"IW');
  if to_char(v_monday, 'IYYY-"W"IW') <> p_semana_iso then
    raise exception 'semana_iso % is not an ISO week of that year', p_semana_iso using errcode = '22023';
  end if;

  -- 2. fecha_inicio is the Monday of that week.
  if p_fecha_inicio is distinct from v_monday then
    raise exception 'fecha_inicio % is not the Monday of %', p_fecha_inicio, p_semana_iso using errcode = '22023';
  end if;

  -- 3. A plan without slots is the very thing this function exists to prevent.
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'p_slots must be a non-empty array' using errcode = '22023';
  end if;

  -- 4. Plan and slots in this one transaction: any failure below (a duplicate week, a bad enum value,
  --    a duplicate slot, an unknown recipe) rolls the plan back with it. The slot columns are typed,
  --    so an invalid dia, tipo_plato or estado fails here rather than being stored.
  insert into public.meal_plans (user_id, semana_iso, fecha_inicio, advertencias, explicacion_aprendizaje)
  values (p_user_id, p_semana_iso, p_fecha_inicio, coalesce(p_advertencias, '{}'::text[]), p_explicacion_aprendizaje)
  returning id into v_plan_id;

  insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato, estado)
  select v_plan_id, s.recipe_id, s.dia, s.tipo_plato, coalesce(s.estado, 'pendiente'::public.estado_receta_menu)
  from jsonb_to_recordset(p_slots) as s(recipe_id uuid, dia public.dia_semana, tipo_plato public.tipo_plato, estado public.estado_receta_menu);

  return v_plan_id;
end;
$function$;

comment on function public.create_meal_plan(uuid, text, date, text[], text, jsonb) is
  'Creates a weekly plan and all its slots in one transaction (FRESCO-913). SECURITY INVOKER, executable by service_role only: called by generate-meal-plan with the user id from the verified JWT.';

revoke all on function public.create_meal_plan(uuid, text, date, text[], text, jsonb) from public, anon, authenticated;
grant execute on function public.create_meal_plan(uuid, text, date, text[], text, jsonb) to service_role;
