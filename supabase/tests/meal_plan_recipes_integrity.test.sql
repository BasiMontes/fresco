-- pgTAP structural guard for FRESCO-776 (audit-6 A6-S1, BLOCKER).
--
-- Audit-5 protected estado / rating / recipe_id / sustitucion_ingrediente on
-- `meal_plan_recipes` with a trigger that trusts the GUC
-- `app.mpr_trusted_write`, and then added a client-callable RPC that set that
-- GUC itself — which reopened the hole. These assertions pin the shape that
-- makes the GUC a safe signal: the protection trigger exists, nothing
-- client-callable can open it on an unvalidated write, and the functions that
-- legitimately do are the ones that validate first.
--
-- The behavioural half (owner PATCH → P0001, RPC → 404) runs against real
-- PostgREST in tests/db/meal-plan-recipes-integrity.test.ts: this session's
-- `session_user` is on the trigger's admin allowlist, so the denial cannot be
-- observed from inside pgTAP.
--
-- Run by `supabase test db` (CI: the e2e job in .github/workflows/pr-check.yml).

begin;
select plan(5);

select hasnt_function(
  'public', 'apply_recipe_status_update',
  'A6-S1: the client-callable RPC that set the trusted-write GUC no longer exists'
);

select has_trigger(
  'public', 'meal_plan_recipes', 'protect_mpr_integrity',
  'the protection trigger is still installed on meal_plan_recipes'
);

select is_definer(
  'public', 'swap_meal_plan_slots', array['uuid', 'uuid'],
  'swap_meal_plan_slots sets the GUC from a SECURITY DEFINER body that binds ownership first'
);

select isnt_definer(
  'public', 'confirm_ingredient_substitution', array['uuid', 'text', 'text'],
  'confirm_ingredient_substitution stays SECURITY INVOKER (RLS still scopes the slot)'
);

-- No remaining function may hand a client the means to set the GUC around an
-- unvalidated write: every definer function that sets it must also own-check.
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%app.mpr_trusted_write%'
      and p.proname not in (
        'swap_meal_plan_slots',
        'confirm_ingredient_substitution',
        'protect_meal_plan_recipes_integrity'
      )),
  0,
  'only the three vetted functions mention app.mpr_trusted_write'
);

select * from finish();
rollback;
