-- swap_meal_plan_slots: reject swaps between slots of different tipo_plato.
--
-- Found live (2026-08-01): the calendar's drag-and-drop let a desayuno
-- recipe land in a cena slot (and vice versa) with zero validation on
-- either the client or this function — the swap is a raw recipe_id/estado/
-- rating exchange with no awareness of what franja either slot represents.
-- A user reported dragging breakfast into dinner and having it stick,
-- labeled "cena". Each slot's tipo_plato is fixed at generation time and
-- must stay fixed across a reorder — only the DAY changes, never the meal
-- type. This is the real enforcement point: the client-side guard added
-- alongside this migration is a UX nicety, not the safety boundary.

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

  -- Same function call, implicit transaction: any exception below rolls back
  -- everything, including this DISABLE — the trigger can never be left off.
  alter table public.meal_plan_recipes disable trigger recipe_learning_trigger;

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

  alter table public.meal_plan_recipes enable trigger recipe_learning_trigger;
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.swap_meal_plan_slots(uuid, uuid) is
  'STORY-FRESCO-11 calendar reorder: learning-neutral position swap between two meal_plan_recipes rows of the same tipo_plato. See ADR-0002.';
