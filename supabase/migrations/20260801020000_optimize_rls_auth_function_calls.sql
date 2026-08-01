-- Supabase performance advisor (2026-08-01, auth_rls_initplan): RLS policies
-- calling auth.uid() directly get it re-evaluated once per row. Wrapping it
-- in a scalar subquery ((select auth.uid())) lets Postgres evaluate it once
-- per query instead. Same semantics, cheaper at scale. Applied to all 14
-- ownership policies for consistency (advisor sampled a subset).

alter policy "profiles_select_own" on public.user_profiles
  using ((select auth.uid()) = id);
alter policy "profiles_insert_own" on public.user_profiles
  with check ((select auth.uid()) = id);
alter policy "profiles_update_own" on public.user_profiles
  using ((select auth.uid()) = id);

alter policy "meal_plans_select_own" on public.meal_plans
  using ((select auth.uid()) = user_id);
alter policy "meal_plans_insert_own" on public.meal_plans
  with check ((select auth.uid()) = user_id);
alter policy "meal_plans_update_own" on public.meal_plans
  using ((select auth.uid()) = user_id);
alter policy "meal_plans_delete_own" on public.meal_plans
  using ((select auth.uid()) = user_id);

alter policy "mpr_select_own" on public.meal_plan_recipes
  using (
    exists (select 1 from public.meal_plans mp
            where mp.id = meal_plan_recipes.meal_plan_id and mp.user_id = (select auth.uid()))
  );
alter policy "mpr_insert_own" on public.meal_plan_recipes
  with check (
    exists (select 1 from public.meal_plans mp
            where mp.id = meal_plan_recipes.meal_plan_id and mp.user_id = (select auth.uid()))
  );
alter policy "mpr_update_own" on public.meal_plan_recipes
  using (
    exists (select 1 from public.meal_plans mp
            where mp.id = meal_plan_recipes.meal_plan_id and mp.user_id = (select auth.uid()))
  );

alter policy "shopping_select_own" on public.shopping_lists
  using ((select auth.uid()) = user_id);
alter policy "shopping_insert_own" on public.shopping_lists
  with check ((select auth.uid()) = user_id);
alter policy "shopping_update_own" on public.shopping_lists
  using ((select auth.uid()) = user_id);
alter policy "shopping_delete_own" on public.shopping_lists
  using ((select auth.uid()) = user_id);
