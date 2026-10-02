-- FRESCO-776 (audit-6 A6-S1, BLOCKER): the RPC audit-5 added to fix the
-- `meal_plan_recipes` bypass reopened it.
--
-- `apply_recipe_status_update` (20260928170000) is SECURITY INVOKER with
-- EXECUTE for `authenticated`, and it sets `app.mpr_trusted_write = 'on'` itself
-- before an unvalidated UPDATE of estado / rating / recipe_id. The trigger
-- `protect_meal_plan_recipes_integrity` trusts that GUC, so any signed-in caller
-- (guests included) could call `/rest/v1/rpc/apply_recipe_status_update` and
-- skip the rate limit, the terminal-state guard and the allergen re-filter that
-- live in the `update-recipe-status` Edge Function — poisoning the shared
-- `recipes.veces_cocinada` / `rating_promedio` aggregates and defeating the
-- allergen safety net (ADR-0001).
--
-- A GUC is only a safe trust signal when it is set by code that has already
-- validated the caller. Guarding this function would mean copying the Edge
-- Function's policy into SQL; deleting it removes the whole class
-- (rpc-authorization.md §2). The Edge Function now validates and then writes
-- with the service-role key, which the trigger has trusted since 20260928170000
-- (and which already holds the table grant).
--
-- The two remaining GUC setters are safe by construction:
--   * `swap_meal_plan_slots` is SECURITY DEFINER, binds ownership and validates
--     the slots before setting the GUC.
--   * `confirm_ingredient_substitution` is SECURITY INVOKER (RLS still applies),
--     only writes `sustitucion_ingrediente`, and only after checking the
--     candidate is a currently safe substitute for an ingredient of the slot's
--     recipe.
--
-- Deploy order: ship the `update-recipe-status` Edge Function BEFORE applying
-- this migration. The new function does not call the RPC, so it works either
-- side of the drop; the previous version fails once the RPC is gone.

drop function if exists public.apply_recipe_status_update(
  uuid,
  public.estado_receta_menu,
  integer,
  uuid
);

-- Same trigger, same trusted paths; only the error message changes so it stops
-- pointing callers at the function that no longer exists.
create or replace function public.protect_meal_plan_recipes_integrity()
returns trigger as $$
begin
  if auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or current_setting('app.mpr_trusted_write', true) is not distinct from 'on'
  then
    return new;
  end if;

  if new.estado is distinct from old.estado
    or new.rating is distinct from old.rating
    or new.recipe_id is distinct from old.recipe_id
    or new.sustitucion_ingrediente is distinct from old.sustitucion_ingrediente
  then
    raise exception 'meal_plan_recipes: estado/rating/recipe_id/sustitucion_ingrediente can only change through swap_meal_plan_slots, confirm_ingredient_substitution or the update-recipe-status Edge Function'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
