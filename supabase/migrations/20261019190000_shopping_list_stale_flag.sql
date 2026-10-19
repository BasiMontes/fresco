-- FRESCO-1010 (audit 7b A7-LOGIC-07): the shopping list was frozen the moment it was generated. A later
-- substitution, a replaced recipe, a discarded slot or a recipe added to the week never reached it, and
-- nothing told the person. The list now carries a stale flag and "Actualizar lista" rebuilds it.
--
-- `desactualizada_desde` is the moment the plan first changed after the list was last built; null means the
-- list matches its plan. A trigger on the slots sets it, so EVERY path that changes a slot is covered
-- (the ingredient substitution RPC, update-recipe-status, assign_recipe_to_slot, adding to the menu, a
-- swap) without each one having to remember. It is set only by changes that alter what is bought:
--   * a recipe appearing, disappearing or being replaced in a slot;
--   * a confirmed ingredient substitution being set or cleared;
--   * a slot entering or leaving the states that buy nothing (descartada, excluida).
-- Marking a slot cocinada or rating it does not: the ingredients were bought for it.
--
-- The edge function `generate-shopping-list` (refresh mode) clears the flag after rebuilding, with the
-- person's own session, so the column gets a column-level UPDATE grant like the other list columns. Setting
-- or clearing it by hand only affects the person's own list: it can at worst show or hide the banner.

alter table public.shopping_lists
  add column desactualizada_desde timestamptz;

comment on column public.shopping_lists.desactualizada_desde is
  'FRESCO-1010. When the plan first changed after this list was built; null = the list matches its plan. Set by mark_shopping_list_stale(), cleared by generate-shopping-list in refresh mode.';

grant select (desactualizada_desde) on public.shopping_lists to authenticated;
grant update (desactualizada_desde) on public.shopping_lists to authenticated;

create or replace function public.mark_shopping_list_stale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan uuid;
begin
  if tg_op = 'UPDATE' then
    -- Only the changes that alter what is bought.
    if new.recipe_id is not distinct from old.recipe_id
       and new.sustitucion_ingrediente is not distinct from old.sustitucion_ingrediente
       and (new.estado in ('descartada', 'excluida')) is not distinct from (old.estado in ('descartada', 'excluida'))
    then
      return null;
    end if;
  end if;

  v_plan := case when tg_op = 'DELETE' then old.meal_plan_id else new.meal_plan_id end;

  update public.shopping_lists
     set desactualizada_desde = coalesce(desactualizada_desde, now())
   where meal_plan_id = v_plan;

  return null;
end;
$$;

revoke execute on function public.mark_shopping_list_stale() from public, anon, authenticated;

create trigger meal_plan_recipes_mark_shopping_list_stale
  after insert or delete or update of recipe_id, estado, sustitucion_ingrediente
  on public.meal_plan_recipes
  for each row
  execute function public.mark_shopping_list_stale();
