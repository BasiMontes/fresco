-- FRESCO-1107 (audit 8: A8-AUTHZ-02, A8-AUTHZ-03): the rest of what FRESCO-1015 left wider than the app uses.
--
--   1. 20261019120000 took the table-level UPDATE away from `authenticated` but granted back
--      meal_plan_recipes.dia / meal_plan_id and meal_plans.user_id / semana_iso / advertencias /
--      explicacion_aprendizaje. No client write to any of them exists: the only client update of
--      meal_plans sets coste_estimado (lib/menu/snapshot-weekly-cost.ts), and the slot columns change inside
--      RPCs. A direct PostgREST PATCH of `dia` defeats the past-day guard of assign_recipe_to_slot, and
--      `semana_iso` makes an old plan count as the current week. What stays:
--        * meal_plans.coste_estimado, the one column the client writes;
--        * meal_plan_recipes.recipe_id / estado / rating / sustitucion_ingrediente, which the SECURITY INVOKER
--          functions (assign_recipe_to_slot, confirm_ingredient_substitution) write as the caller. The
--          protect_meal_plan_recipes_integrity trigger still blocks a direct PATCH of those four.
--      SECURITY DEFINER functions (swap, copy, reassign) run as the owner and need no grant.
--   2. get_safe_ingredient_substitutes was executable by `anon`: Postgres grants EXECUTE to PUBLIC on every
--      new function. It is SECURITY INVOKER and returns nothing without auth.uid(), but the entry point
--      should not exist.

-- 1. column-level UPDATE
revoke update on public.meal_plan_recipes from authenticated;
grant update (recipe_id, estado, rating, sustitucion_ingrediente) on public.meal_plan_recipes to authenticated;

revoke update on public.meal_plans from authenticated;
grant update (coste_estimado) on public.meal_plans to authenticated;

-- 2. no anonymous entry point
revoke execute on function public.get_safe_ingredient_substitutes(text) from public, anon;
grant execute on function public.get_safe_ingredient_substitutes(text) to authenticated;
