-- swap_meal_plan_slots(p_slot_a_id uuid, p_slot_b_id uuid): atomically swaps
-- (recipe_id, estado, rating) between two sibling meal_plan_recipes rows of
-- the same meal_plan_id — the persistence write path for STORY-FRESCO-11's
-- drag-and-drop calendar reorder.
--
-- Follows ADR-0002's procedure exactly, do not improvise a different bypass
-- mechanism (.context/ADR/ADR-0002-position-swaps-bypass-learning-trigger.md):
-- a naive swap (recipe_id only, or the full bundle with the trigger left on)
-- corrupts recipes.veces_cocinada/veces_descartada/rating_promedio, the exact
-- aggregate ADR-0001's learning moat (and Pro-tier pricing) depends on.
--
-- security definer bypasses RLS entirely, so this function explicitly
-- replicates the mpr_update_own policy's own ownership check (join back to
-- meal_plans.user_id = auth.uid(), supabase/migrations/20260725120100_create_
-- fresco_core_tables.sql:223-227) rather than relying on RLS to protect it.
--
-- Raises (never silently no-ops) when: a slot id doesn't exist, the two slots
-- belong to different meal_plan_id's, or the caller doesn't own the plan.
-- No-ops only for the trivial p_slot_a_id = p_slot_b_id case (same slot).

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
  'STORY-FRESCO-11 calendar reorder: learning-neutral position swap between two meal_plan_recipes rows. See ADR-0002.';
