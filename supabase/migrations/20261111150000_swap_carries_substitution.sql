-- FRESCO-1155 (revisión integral, hallazgo FS-5): swapping two dishes of the calendar moved recipe_id, estado and
-- rating but not sustitucion_ingrediente. The substitution stayed in the slot and the recipe left: the dish the
-- person had adjusted brought its ORIGINAL ingredient back into the shopping list, and the other dish inherited a
-- substitution it never had. Production had no slot with a substitution in use (checked 2026-11-10), so nothing
-- needs repairing.
--
-- Same body as the latest definition (20260928180000, FRESCO-736), with the one added column on each UPDATE. The
-- shopping list is flagged stale by mark_shopping_list_stale (FRESCO-1010), which fires when sustitucion_ingrediente
-- changes, so the screen offers to rebuild it.
--
-- Authorization (rpc-authorization.md section 4) is unchanged: same signature, SECURITY DEFINER with search_path
-- pinned, EXECUTE as before (CREATE OR REPLACE keeps the grants), both slots still resolved through the caller's own
-- plans (a slot that is not yours is indistinguishable from one that does not exist), same rate limit, same
-- `excluida` rejection, same trusted-write and learning settings around the two UPDATEs. It still mentions the
-- trusted-write setting, so it stays in the pgTAP allowlist of supabase/tests/meal_plan_recipes_integrity.test.sql.

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

  -- FRESCO-1155: the ingredient substitution belongs to the recipe it was confirmed for, so it travels with it.
  -- Left behind, the recipe came back with its ORIGINAL ingredient in the shopping list and the other one
  -- inherited a substitution it never had.
  update public.meal_plan_recipes
  set recipe_id = v_slot_b.recipe_id,
      estado    = v_slot_b.estado,
      rating    = v_slot_b.rating,
      sustitucion_ingrediente = v_slot_b.sustitucion_ingrediente
  where id = p_slot_a_id;

  update public.meal_plan_recipes
  set recipe_id = v_slot_a.recipe_id,
      estado    = v_slot_a.estado,
      rating    = v_slot_a.rating,
      sustitucion_ingrediente = v_slot_a.sustitucion_ingrediente
  where id = p_slot_b_id;

  perform set_config('app.skip_recipe_learning', 'off', true);
  perform set_config('app.mpr_trusted_write', 'off', true);
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.swap_meal_plan_slots(uuid, uuid) is
  'STORY-FRESCO-11 calendar reorder: learning-neutral position swap between two meal_plan_recipes rows of the same tipo_plato. See ADR-0002. FRESCO-383: rate-limited, skips learning via app.skip_recipe_learning GUC (no table lock). FRESCO-396: rejects slots in estado excluida (A4-L9). Audit-5: sets app.mpr_trusted_write so protect_meal_plan_recipes_integrity lets its own writes through. FRESCO-736: existence + ownership checked as one query per slot, single generic error either way (non-disclosure). FRESCO-1155: the ingredient substitution of a slot (sustitucion_ingrediente) moves with its recipe.';
