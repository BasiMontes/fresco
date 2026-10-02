-- FRESCO-777 (audit-6 A6-S4 + A6-S5): close the INSERT paths audit-5 left open.
--
-- Audit-5 (20260928170000) protected UPDATE on `meal_plan_recipes` and left
-- INSERT "as a follow-up". `authenticated` still holds `GRANT INSERT` on
-- `meal_plans` and `meal_plan_recipes`, with RLS that only checks ownership of
-- the parent plan. A signed-in caller (guests included) can therefore:
--
--   * insert slots with `estado = 'cocinada'`, a `rating`, any `recipe_id`
--     (allergen carriers included) or a forged `sustitucion_ingrediente`, which
--     `generate-shopping-list` consumes verbatim, skipping the allergen
--     re-check of `confirm_ingredient_substitution`;
--   * create whole plans without going through `generate-meal-plan`, i.e.
--     without its rate limit, entitlement checks and allergen filter.
--
-- Same cure as FRESCO-776: remove the door. The only legitimate writer of those
-- two tables for an ordinary user is the `generate-meal-plan` Edge Function,
-- which authenticates the JWT, rate-limits, checks entitlement and filters
-- allergens BEFORE it writes; it now writes with the service-role key. The
-- SECURITY DEFINER RPCs that also create rows (`copy_meal_plan_to_week`,
-- `reassign_guest_data`) run as the function owner and are unaffected.
--
-- `shopping_lists` keeps its authenticated INSERT (the Edge Function writes it
-- with the caller's own client) but now checks that `meal_plan_id` is a plan the
-- caller owns, on INSERT and on UPDATE. Without it, a caller who learned a
-- foreign plan id could occupy that plan's `unique_plan_lista` slot and use the
-- FK / unique error as an existence oracle.
--
-- Deploy order: ship the `generate-meal-plan` Edge Function BEFORE applying this
-- migration. The new function writes with the service-role key and works either
-- side of the REVOKE; the previous version fails once INSERT is revoked.

-- 1. The service-role client needs the base grants the Edge Function now relies
--    on (it has SELECT/UPDATE on meal_plan_recipes since 20260928170000, and
--    nothing on meal_plans). RLS bypass and base table grants are separate
--    mechanisms; see 20260908150000_grant_service_role_recipes_privileges.sql.
grant select, insert, delete on public.meal_plans to service_role;
grant insert on public.meal_plan_recipes to service_role;

-- 2. Remove the client write path.
revoke insert on public.meal_plans from authenticated;
revoke insert on public.meal_plan_recipes from authenticated;

-- With the grant gone these policies cannot be reached by `authenticated`; drop
-- them so a future accidental re-grant fails closed instead of reopening the hole.
drop policy if exists "meal_plans_insert_own" on public.meal_plans;
drop policy if exists "mpr_insert_own" on public.meal_plan_recipes;

-- 3. shopping_lists: the plan being referenced must belong to the caller.
alter policy "shopping_insert_own" on public.shopping_lists
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.meal_plans mp
      where mp.id = shopping_lists.meal_plan_id and mp.user_id = (select auth.uid())
    )
  );

alter policy "shopping_update_own" on public.shopping_lists
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.meal_plans mp
      where mp.id = shopping_lists.meal_plan_id and mp.user_id = (select auth.uid())
    )
  );
