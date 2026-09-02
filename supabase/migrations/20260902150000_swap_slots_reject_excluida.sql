-- FRESCO-396 (audit-4 A4-L9): swap_meal_plan_slots did not reject slots in
-- estado 'excluida'. An 'excluida' slot is exactly a (dia, tipo_plato) the
-- user removed from their planning_selection — it holds the FRANJA_EXCLUIDA
-- sentinel, no real recipe, estado 'excluida'. A direct RPC call could swap a
-- real recipe into it, producing a 'pendiente' slot with a real recipe on a
-- day/meal the user excluded (and, symmetrically, blanking a real slot).
--
-- Rejecting either side being 'excluida' is the planning_selection
-- consistency guard: excluded franjas and 'excluida' slots are the same set,
-- so no separate planning_selection lookup is needed.
--
-- Body is otherwise verbatim from
-- 20260902130000_swap_slots_skip_learning_guc.sql — only the new guard block
-- (after the ownership check, before the learning-skip GUC) is added.
-- update_recipe_learning() is untouched by this migration.

create or replace function public.swap_meal_plan_slots(
  p_slot_a_id uuid,
  p_slot_b_id uuid
)
returns void as $$
declare
  v_slot_a public.meal_plan_recipes;
  v_slot_b public.meal_plan_recipes;
begin
  if p_slot_a_id = p_slot_b_id then
    return;
  end if;

  -- FRESCO-383: the RPC had no rate limit. 120/hour, same fixed-hour window
  -- and mechanism as the Edge Functions (ADR-0010). A rolled-back swap does
  -- not count against the limit (same transaction).
  if not public.check_and_increment_rate_limit(auth.uid(), 'swap_meal_plan_slots', 120, 3600) then
    raise exception 'swap_meal_plan_slots: rate limit exceeded';
  end if;

  select * into v_slot_a from public.meal_plan_recipes where id = p_slot_a_id;
  if not found then
    raise exception 'swap_meal_plan_slots: slot % not found', p_slot_a_id;
  end if;

  select * into v_slot_b from public.meal_plan_recipes where id = p_slot_b_id;
  if not found then
    raise exception 'swap_meal_plan_slots: slot % not found', p_slot_b_id;
  end if;

  if v_slot_a.meal_plan_id <> v_slot_b.meal_plan_id then
    raise exception 'swap_meal_plan_slots: slots % and % belong to different meal plans', p_slot_a_id, p_slot_b_id;
  end if;

  if v_slot_a.tipo_plato <> v_slot_b.tipo_plato then
    raise exception 'swap_meal_plan_slots: slots % and % have different tipo_plato (% vs %)',
      p_slot_a_id, p_slot_b_id, v_slot_a.tipo_plato, v_slot_b.tipo_plato;
  end if;

  if not exists (
    select 1 from public.meal_plans mp
    where mp.id = v_slot_a.meal_plan_id and mp.user_id = auth.uid()
  ) then
    raise exception 'swap_meal_plan_slots: caller does not own meal plan %', v_slot_a.meal_plan_id;
  end if;

  -- FRESCO-396 (A4-L9): an 'excluida' slot is a franja the user removed from
  -- planning_selection. Swapping it would put a real recipe on an excluded
  -- day/meal (or blank a real slot). Reject either side being 'excluida'.
  if v_slot_a.estado = 'excluida' or v_slot_b.estado = 'excluida' then
    raise exception 'swap_meal_plan_slots: no se puede intercambiar una franja excluida';
  end if;

  -- Learning-neutral: skip recipe_learning_trigger for the two swap updates
  -- only. is_local => true keeps the setting inside the current transaction
  -- (no table lock, unlike the former ALTER TABLE ... DISABLE TRIGGER); the
  -- explicit reset below narrows it further to just this block, so anything
  -- else sharing the transaction still records learning normally.
  perform set_config('app.skip_recipe_learning', 'on', true);

  update public.meal_plan_recipes
  set recipe_id = v_slot_b.recipe_id,
      estado    = v_slot_b.estado,
      rating    = v_slot_b.rating
  where id = p_slot_a_id;

  update public.meal_plan_recipes
  set recipe_id = v_slot_a.recipe_id,
      estado    = v_slot_a.estado,
      rating    = v_slot_a.rating
  where id = p_slot_b_id;

  perform set_config('app.skip_recipe_learning', 'off', true);
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.swap_meal_plan_slots(uuid, uuid) is
  'STORY-FRESCO-11 calendar reorder: learning-neutral position swap between two meal_plan_recipes rows of the same tipo_plato. See ADR-0002. FRESCO-383: rate-limited, skips learning via app.skip_recipe_learning GUC (no table lock). FRESCO-396: rejects slots in estado excluida (A4-L9).';
