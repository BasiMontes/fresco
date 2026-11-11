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
select plan(9);

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

-- FRESCO-878: assign_recipe_to_slot sets the GUC only AFTER validating (open slot
-- of today or later, same tipo_plato, get_filtered_recipes), and as INVOKER so RLS
-- scopes the slot. It must never become DEFINER without an actor bind.
select isnt_definer(
  'public', 'assign_recipe_to_slot', array['uuid', 'uuid'],
  'assign_recipe_to_slot stays SECURITY INVOKER (RLS still scopes the slot)'
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
        'assign_recipe_to_slot',
        'protect_meal_plan_recipes_integrity',
        'retire_conflicting_slots'
      )),
  0,
  'only the five vetted functions mention app.mpr_trusted_write'
);

-- FRESCO-1151: retire_conflicting_slots is the fifth, and the only one with no client at all. It takes a
-- user id and writes slots around the protection trigger, so the property that makes it safe is that no
-- client role can execute it: only the two triggers that call it, with the id of the row that changed.
select ok(
  not has_function_privilege('authenticated', 'public.retire_conflicting_slots(uuid)', 'execute'),
  'FRESCO-1151: authenticated cannot execute retire_conflicting_slots'
);
select ok(
  not has_function_privilege('anon', 'public.retire_conflicting_slots(uuid)', 'execute'),
  'FRESCO-1151: anon cannot execute retire_conflicting_slots'
);
select ok(
  not has_function_privilege('service_role', 'public.retire_conflicting_slots(uuid)', 'execute'),
  'FRESCO-1151: service_role cannot execute retire_conflicting_slots'
);

select * from finish();
rollback;
