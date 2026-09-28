-- Audit-5 (2026-09-28) BLOCKER: `meal_plan_recipes` has had a table-wide
-- `grant ... update on public.meal_plan_recipes to authenticated`
-- (20260729120000) since before ADR-0032/33's RPCs existed. `mpr_update_own`
-- (20260725120100) is row-scoped only (`USING`, no column restriction), so
-- any authenticated caller (including anonymous guests, ADR-0003) can write
-- `estado`, `rating`, `recipe_id` or `sustitucion_ingrediente` directly via
-- PostgREST, skipping every RPC-level guard entirely:
--
--   * `estado`/`rating` loop -> `update_recipe_learning()`
--     (20260902130000) inflates the SHARED `recipes.veces_cocinada` /
--     `rating_promedio` aggregates with no rate limit and no terminal-state
--     guard (those live in the RPCs `swap_meal_plan_slots` /
--     `update-recipe-status`, not the table) — poisons menu generation for
--     every user, not just the caller.
--   * `sustitucion_ingrediente` direct-write bypasses
--     `confirm_ingredient_substitution`'s allergen re-check entirely;
--     `generate-shopping-list` trusts the column verbatim.
--
-- Same bug shape as FRESCO-360 (`user_profiles`, audit-4 BLOCKER
-- A4-B1), fixed there with `prevent_client_subscription_writes()` — never
-- generalized to this sibling table. This migration applies the identical
-- pattern: a `BEFORE UPDATE` trigger rejects any change to the four
-- safety-critical columns unless the writer is one of three already-trusted
-- paths:
--
--   1. `session_user` is a superuser/admin login (seed scripts, admin
--      tooling) — same allowlist `prevent_client_subscription_writes` uses.
--   2. `auth.role() = 'service_role'` — the Supabase service-role key, never
--      exposed to a client. Covers `reassign_guest_data()` (already
--      `security definer`, already service_role-only per ADR-0004 — SECURITY
--      DEFINER runs as the function owner regardless of the caller's own
--      table grants, so this one never needed the grant below) and, as of
--      this migration, `scripts/merge-near-duplicate-recipes.ts`'s admin
--      `recipe_id` redirect too: that script's own header already documented
--      "service_role currently lacks a table-level SELECT grant on ...
--      meal_plan_recipes via PostgREST ... genuine infra gap ... grant the
--      privilege via a migration" — this is that migration (see the GRANT
--      below). Verified while building this fix: the e2e fixture helper
--      `tests/steps/calendario-reordenar.steps.ts` hit the identical 403
--      when switched to `serviceRoleHeaders()` to route around the new
--      trigger, which is what surfaced the gap concretely.
--   3. The transaction-local GUC `app.mpr_trusted_write = 'on'` — set
--      explicitly, only around the single UPDATE statement that needs it, by
--      the three RPCs that legitimately mutate these columns for an ordinary
--      authenticated caller: `swap_meal_plan_slots`,
--      `confirm_ingredient_substitution`, and the new
--      `apply_recipe_status_update` below. Mirrors the
--      `app.skip_recipe_learning` GUC already proven in
--      20260902130000 — explicit opt-in per statement, not a blanket
--      role-based exception.
--
-- Scope: UPDATE only. INSERT is intentionally left alone — `estado` only
-- reacts to a *transition* (`update_recipe_learning` compares `old.estado`,
-- which does not exist on INSERT), so a forged INSERT cannot manipulate the
-- shared learning aggregates the way Attack 1 does. A forged INSERT setting
-- `sustitucion_ingrediente` on a self-owned row is self-inflicted only (same
-- blast radius the audit already scored below BLOCKER for the equivalent
-- UPDATE case) — tracked as a follow-up, not blocking this fix.

-- 0. Close the documented service_role grant gap (see comment block above,
--    and scripts/merge-near-duplicate-recipes.ts's own header). RLS bypass
--    and base table GRANTs are separate mechanisms in Postgres — service_role
--    has always bypassed RLS here, but was never given the base SELECT/UPDATE
--    grant this table needs for a direct (non-SECURITY-DEFINER) PostgREST
--    call. Same pattern as 20260908150000_grant_service_role_recipes_privileges.sql.
grant select, update on public.meal_plan_recipes to service_role;

-- 1. New RPC: the one direct-table write `update-recipe-status` (Edge
--    Function) still needs to make, now routed through a function that sets
--    the trusted-write GUC. Generic "patch these columns, null means don't
--    touch" primitive — the actual "which estado permits which field" policy
--    stays in `validation.ts#buildUpdatePayload`, not duplicated here.
--    SECURITY INVOKER: RLS (`mpr_update_own`) still enforces ownership
--    exactly as the raw `.update()` call did.
create function public.apply_recipe_status_update(
  p_slot_id uuid,
  p_estado public.estado_receta_menu,
  p_rating integer default null,
  p_recipe_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  perform set_config('app.mpr_trusted_write', 'on', true);

  update public.meal_plan_recipes
  set estado    = coalesce(p_estado, estado),
      rating    = coalesce(p_rating, rating),
      recipe_id = coalesce(p_recipe_id, recipe_id)
  where id = p_slot_id;

  perform set_config('app.mpr_trusted_write', 'off', true);
end;
$function$;

grant execute on function public.apply_recipe_status_update(uuid, public.estado_receta_menu, integer, uuid) to authenticated;

-- 2. swap_meal_plan_slots: add the trusted-write GUC around its two updates
--    (body otherwise verbatim from 20260902150000, the latest prior version —
--    including the A4-L9 excluida-rejection guard this migration must not
--    regress).
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

  -- FRESCO-396 (A4-L9): an 'excluida' slot is a franja the user removed from
  -- planning_selection. Swapping it would put a real recipe on an excluded
  -- day/meal (or blank a real slot). Reject either side being 'excluida'.
  if v_slot_a.estado = 'excluida' or v_slot_b.estado = 'excluida' then
    raise exception 'swap_meal_plan_slots: no se puede intercambiar una franja excluida';
  end if;

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
  'STORY-FRESCO-11 calendar reorder: learning-neutral position swap between two meal_plan_recipes rows of the same tipo_plato. See ADR-0002. FRESCO-383: rate-limited, skips learning via app.skip_recipe_learning GUC (no table lock). FRESCO-396: rejects slots in estado excluida (A4-L9). Audit-5: sets app.mpr_trusted_write so protect_meal_plan_recipes_integrity lets its own writes through.';

-- 3. confirm_ingredient_substitution: add the trusted-write GUC around its
--    update (body otherwise verbatim from 20260925130000).
create or replace function public.confirm_ingredient_substitution(
  p_slot_id uuid,
  p_ingrediente_original text,
  p_ingrediente_sustituto text
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_updated integer;
begin
  if not exists (
    select 1
    from public.get_safe_ingredient_substitutes(p_ingrediente_original) s
    where s.ingrediente_sustituto = p_ingrediente_sustituto
  ) then
    raise exception 'confirm_ingredient_substitution: candidate is not a currently safe substitute'
      using errcode = 'P0001';
  end if;

  perform set_config('app.mpr_trusted_write', 'on', true);

  update public.meal_plan_recipes mpr
  set sustitucion_ingrediente = jsonb_build_object(
    'original', p_ingrediente_original,
    'sustituto', p_ingrediente_sustituto
  )
  from public.recipes r
  where mpr.id = p_slot_id
    and mpr.recipe_id = r.id
    and mpr.estado not in ('cocinada', 'descartada', 'excluida')
    and exists (
      select 1
      from jsonb_array_elements_text(coalesce(r.ingredientes_principales, '[]'::jsonb)) as ri(val)
      where lower(ri.val) = lower(p_ingrediente_original)
    );

  get diagnostics v_updated = row_count;

  perform set_config('app.mpr_trusted_write', 'off', true);

  if v_updated = 0 then
    raise exception 'confirm_ingredient_substitution: slot not found or not eligible for substitution'
      using errcode = 'P0001';
  end if;
end;
$function$;

-- 4. The protective trigger itself.
create function public.protect_meal_plan_recipes_integrity()
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
    raise exception 'meal_plan_recipes: estado/rating/recipe_id/sustitucion_ingrediente can only change through swap_meal_plan_slots, confirm_ingredient_substitution or apply_recipe_status_update (audit-5 BLOCKER)'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger protect_mpr_integrity
  before update on public.meal_plan_recipes
  for each row
  execute function public.protect_meal_plan_recipes_integrity();
