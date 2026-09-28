-- FRESCO-736 (A5-H6): swap_meal_plan_slots and copy_meal_plan_to_week raised
-- a DIFFERENT exception for "row not found" vs "row found but not owned by
-- caller" (e.g. 'slot % not found' vs 'caller does not own meal plan %').
-- Doctrine (.agents/skills/sprint-development/references/rpc-authorization.md
-- §3): "It raises the SAME error as 'not found.' A distinct 'forbidden' code
-- turns the function into an oracle for which (actor, resource) pairs exist.
-- Non-disclosure is the point." Both functions violated this: a caller could
-- enumerate other users' meal_plans / meal_plan_recipes ids by diffing the
-- two error strings.
--
-- Fix: fold the ownership predicate into the existence SELECT itself (an
-- extra `and user_id = auth.uid()` / `and mp.user_id = auth.uid()` on the
-- JOIN), so a row that exists-but-isn't-yours and a row that doesn't exist
-- both fall through to the SAME 'not found' branch with the SAME message.
-- No other behavior changes — the standalone "caller does not own ..."
-- exception blocks are deleted, not repurposed.
--
-- swap_meal_plan_slots' body is based on the LATEST prior version
-- (20260928170000, audit-5 same-day) — NOT the older 20260902150000 — so it
-- keeps that migration's `app.mpr_trusted_write` GUC around the two UPDATEs.
-- Dropping that GUC would make every legitimate swap fail closed against
-- `protect_mpr_integrity` (caught locally via `bun run test:db` before this
-- migration shipped — the first draft regressed exactly this).

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

  -- FRESCO-736: ownership folded into the existence check — a slot that
  -- belongs to another user is indistinguishable from one that doesn't
  -- exist. Each slot is checked independently (not just slot_a's meal
  -- plan), which also closes the previous implicit trust that slot_b's
  -- ownership followed from sharing slot_a's meal_plan_id.
  select mpr.* into v_slot_a
  from public.meal_plan_recipes mpr
  join public.meal_plans mp on mp.id = mpr.meal_plan_id
  where mpr.id = p_slot_a_id and mp.user_id = auth.uid();
  if not found then
    raise exception 'swap_meal_plan_slots: slot % not found', p_slot_a_id;
  end if;

  select mpr.* into v_slot_b
  from public.meal_plan_recipes mpr
  join public.meal_plans mp on mp.id = mpr.meal_plan_id
  where mpr.id = p_slot_b_id and mp.user_id = auth.uid();
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
  perform set_config('app.mpr_trusted_write', 'on', true);

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
  perform set_config('app.mpr_trusted_write', 'off', true);
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.swap_meal_plan_slots(uuid, uuid) is
  'STORY-FRESCO-11 calendar reorder: learning-neutral position swap between two meal_plan_recipes rows of the same tipo_plato. See ADR-0002. FRESCO-383: rate-limited, skips learning via app.skip_recipe_learning GUC (no table lock). FRESCO-396: rejects slots in estado excluida (A4-L9). Audit-5: sets app.mpr_trusted_write so protect_meal_plan_recipes_integrity lets its own writes through. FRESCO-736: existence + ownership checked as one query per slot, single generic error either way (non-disclosure).';

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
  -- FRESCO-736: ownership folded into the existence check — a source plan
  -- owned by another user is indistinguishable from one that doesn't exist.
  select * into v_source
  from public.meal_plans
  where id = p_source_meal_plan_id and user_id = v_user_id;

  if not found then
    raise exception 'copy_meal_plan_to_week: source plan % not found', p_source_meal_plan_id;
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

comment on function public.copy_meal_plan_to_week(uuid, text, date) is
  'FRESCO-427: atomically copy an owned meal_plans row''s 21 slots onto the target ISO week, replacing any existing plan there. estado reset to pendiente. FRESCO-736: existence + ownership checked as one query, single generic error either way (non-disclosure).';
