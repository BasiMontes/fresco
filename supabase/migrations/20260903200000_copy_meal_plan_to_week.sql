-- copy_meal_plan_to_week(p_source_meal_plan_id uuid, p_semana_iso text,
--   p_fecha_inicio date) returns uuid — FRESCO-427 "Usar este menú en la
-- semana actual" from the "Histórico de menús" read-only view.
--
-- Copies the 21 (dia x tipo_plato) slots of an OWNED source meal_plans row
-- onto the target ISO week, replacing whatever plan the caller currently has
-- for that week. One function call = one implicit transaction: the DELETE +
-- the two INSERTs either all land or all roll back, so a network drop can
-- never leave the target week with a header and a partial set of children
-- (the NFR-REL-2 gap `generate-meal-plan`'s own non-transactional inserts
-- still carry).
--
-- security definer bypasses RLS, so — same as swap_meal_plan_slots
-- (ADR-0002) — the ownership check is replicated here explicitly
-- (meal_plans.user_id = auth.uid()) rather than relying on RLS.
--
-- `estado` is reset to 'pendiente' for every copied slot: this is a fresh
-- menu to cook, not a record — the cocinada/descartada history of the source
-- week stays on the source week. `recipe_learning_trigger` is `after update`
-- and no-ops on `old.estado = new.estado`, so the INSERTs here never touch
-- the `recipes` aggregate counters — no need to disable it (unlike the swap
-- RPC, which UPDATEs estado).
--
-- Raises (never silently no-ops) when: the caller doesn't own the source
-- plan, or the source plan already IS the target week (a self-copy).

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
begin
  select * into v_source
  from public.meal_plans
  where id = p_source_meal_plan_id;

  if not found then
    raise exception 'copy_meal_plan_to_week: source plan % not found', p_source_meal_plan_id;
  end if;

  if v_source.user_id <> v_user_id then
    raise exception 'copy_meal_plan_to_week: caller does not own source plan %', p_source_meal_plan_id;
  end if;

  if v_source.semana_iso = p_semana_iso then
    raise exception 'copy_meal_plan_to_week: source plan is already the target week %', p_semana_iso;
  end if;

  -- Replace any existing plan for the target week. `on delete cascade` on
  -- meal_plan_recipes.meal_plan_id removes its 21 children with it.
  delete from public.meal_plans
  where user_id = v_user_id and semana_iso = p_semana_iso;

  insert into public.meal_plans (user_id, semana_iso, fecha_inicio)
  values (v_user_id, p_semana_iso, p_fecha_inicio)
  returning id into v_new_id;

  insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato, estado)
  select v_new_id, recipe_id, dia, tipo_plato, 'pendiente'
  from public.meal_plan_recipes
  where meal_plan_id = p_source_meal_plan_id;

  return v_new_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.copy_meal_plan_to_week(uuid, text, date) from public;
grant execute on function public.copy_meal_plan_to_week(uuid, text, date) to authenticated;

comment on function public.copy_meal_plan_to_week(uuid, text, date) is
  'FRESCO-427: atomically copy an owned meal_plans row''s 21 slots onto the target ISO week, replacing any existing plan there. estado reset to pendiente.';
