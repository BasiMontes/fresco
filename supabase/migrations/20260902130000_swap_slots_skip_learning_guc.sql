-- FRESCO-383 (audit-4 A4-M6): swap_meal_plan_slots took a table-wide lock on
-- every calendar reorder.
--
-- The function needs the position swap (a raw recipe_id/estado/rating exchange
-- between two rows) to NOT fire recipe_learning_trigger — swapping an already-
-- cooked slot with a pending one would otherwise record a phantom cocinada.
-- Its previous approach, `ALTER TABLE meal_plan_recipes DISABLE TRIGGER
-- recipe_learning_trigger`, takes an ACCESS EXCLUSIVE lock on the whole
-- meal_plan_recipes table for the duration of the transaction, so every
-- drag-and-drop reorder serialized against every other write to that table,
-- across all users.
--
-- Replace it with a transaction-local GUC (`app.skip_recipe_learning`) that
-- the trigger function checks and honours. `set_config(..., is_local => true)`
-- is scoped to the current transaction and auto-resets when the RPC returns —
-- no DDL, no table lock, only the two RowExclusiveLock row updates the swap
-- actually needs.
--
-- Also add a rate limit to the RPC (it had none), reusing
-- check_and_increment_rate_limit from 20260827210808 (ADR-0010) — the same
-- Postgres-native mechanism the Edge Functions use. 120/hour is generous for
-- rearranging a week's menu and still caps abuse.

-- 1. Trigger function: honour the skip GUC. Body is otherwise verbatim from
--    20260901150000_fix_rating_average_denominator.sql (average over
--    veces_calificada). `create or replace` keeps the existing grants.
create or replace function public.update_recipe_learning()
returns trigger as $$
begin
  -- FRESCO-383: swap_meal_plan_slots sets this for its transaction so a
  -- learning-neutral position swap does not record phantom cocinada/descartada
  -- events. current_setting(_, true) returns NULL when unset (normal path).
  if current_setting('app.skip_recipe_learning', true) is not distinct from 'on' then
    return new;
  end if;

  -- Only act on an actual state transition
  if old.estado = new.estado then
    return new;
  end if;

  if new.estado = 'cocinada' then
    update public.recipes
    set
      veces_cocinada     = veces_cocinada + 1,
      ultima_vez_en_menu = current_date,
      veces_calificada   = case
        when new.rating is not null then veces_calificada + 1
        else veces_calificada
      end,
      rating_promedio    = case
        when new.rating is not null then
          round(
            (coalesce(rating_promedio, 0) * veces_calificada + new.rating)
            / (veces_calificada + 1), 2
          )
        else rating_promedio
      end
    where id = new.recipe_id;

  elsif new.estado = 'descartada' then
    update public.recipes
    set veces_descartada = veces_descartada + 1
    where id = new.recipe_id;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 2. swap_meal_plan_slots: rate-limit + GUC skip instead of DISABLE TRIGGER.
--    Body is otherwise verbatim from
--    20260801000000_restrict_slot_swap_to_same_tipo_plato.sql.
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
  'STORY-FRESCO-11 calendar reorder: learning-neutral position swap between two meal_plan_recipes rows of the same tipo_plato. See ADR-0002. FRESCO-383: rate-limited, skips learning via app.skip_recipe_learning GUC (no table lock).';
