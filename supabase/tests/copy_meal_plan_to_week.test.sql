-- pgTAP test for copy_meal_plan_to_week() — FRESCO-427 "Usar este menú en
-- la semana actual" from the "Histórico de menús" read-only view.
--
-- Run by `supabase test db` (CI: the e2e job in .github/workflows/pr-check.yml).

begin;
select plan(6);

-- ── Auth context ───────────────────────────────────────────────────────
-- copy_meal_plan_to_week() calls auth.uid() for its ownership check.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ── Fixtures ───────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'fresco-427@test.local'),
  ('99999999-9999-9999-9999-999999999999', 'fresco-427-other@test.local');

insert into public.user_profiles (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('99999999-9999-9999-9999-999999999999');

insert into public.recipes (id, nombre, slug) values
  ('22222222-2222-2222-2222-222222222222', 'Test recipe 427 A', 'test-recipe-427-a'),
  ('33333333-3333-3333-3333-333333333333', 'Test recipe 427 B', 'test-recipe-427-b');

-- Source plan: a PAST week, owned by the fixture user. Two real slots + one
-- null-recipe slot; the rest of the 21 are irrelevant to the copy mechanics.
insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio)
values ('44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111', '2026-W01', '2026-01-05');

insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato, estado) values
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'lunes',  'comida', 'cocinada'),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'martes', 'cena',   'descartada'),
  ('44444444-4444-4444-4444-444444444444', null,                                   'lunes',  'desayuno', 'excluida');

-- An OLD plan already sitting on the target week — must be replaced.
insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio)
values ('55555555-5555-5555-5555-555555555555',
        '11111111-1111-1111-1111-111111111111', '2026-W20', '2026-05-11');
insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato, estado) values
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'lunes', 'comida', 'pendiente');

-- A plan owned by the OTHER user, for the not-owned rejection case.
insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio)
values ('66666666-6666-6666-6666-666666666666',
        '99999999-9999-9999-9999-999999999999', '2026-W02', '2026-01-12');

-- ── Case 1: copy onto the target week succeeds ─────────────────────────
select lives_ok(
  $$ select public.copy_meal_plan_to_week(
       '44444444-4444-4444-4444-444444444444', '2026-W20', '2026-05-11'::date) $$,
  'copy onto an owned target week is allowed'
);

-- ── Case 2: the old target-week plan is gone (replaced, not duplicated) ─
select is(
  (select count(*)::int from public.meal_plans
   where user_id = '11111111-1111-1111-1111-111111111111' and semana_iso = '2026-W20'),
  1, 'exactly one plan for the target week after the copy'
);

-- ── Case 3: all 3 source slots were copied ────────────────────────────
select is(
  (select count(*)::int from public.meal_plan_recipes mpr
   join public.meal_plans mp on mp.id = mpr.meal_plan_id
   where mp.user_id = '11111111-1111-1111-1111-111111111111' and mp.semana_iso = '2026-W20'),
  3, 'the 3 source slots landed on the target week'
);

-- ── Case 4: every copied slot's estado is reset to pendiente ──────────
select is(
  (select count(*)::int from public.meal_plan_recipes mpr
   join public.meal_plans mp on mp.id = mpr.meal_plan_id
   where mp.user_id = '11111111-1111-1111-1111-111111111111'
     and mp.semana_iso = '2026-W20' and mpr.estado <> 'pendiente'),
  0, 'no copied slot carries the source week''s cocinada/descartada estado'
);

-- ── Case 5: copying a plan onto its own week is rejected ──────────────
select throws_ok(
  $$ select public.copy_meal_plan_to_week(
       '44444444-4444-4444-4444-444444444444', '2026-W01', '2026-01-05'::date) $$,
  'copy_meal_plan_to_week: source plan is already the target week 2026-W01',
  'rejects a self-copy'
);

-- ── Case 6: copying a plan the caller does not own is rejected ────────
select throws_ok(
  $$ select public.copy_meal_plan_to_week(
       '66666666-6666-6666-6666-666666666666', '2026-W20', '2026-05-11'::date) $$,
  NULL,
  'rejects copying a plan owned by someone else'
);

select * from finish();
rollback;
