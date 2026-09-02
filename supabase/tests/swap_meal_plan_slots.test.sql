-- pgTAP test for swap_meal_plan_slots() — FRESCO-396 (audit-4 A4-L9):
-- the RPC must reject a swap that touches a slot in estado 'excluida'
-- (a franja the user removed from planning_selection), while a normal
-- pendiente<->pendiente position swap of the same tipo_plato still works.
--
-- Run by `supabase test db` (CI: the e2e job in .github/workflows/pr-check.yml).

begin;
select plan(5);

-- ── Auth context ───────────────────────────────────────────────────────
-- swap_meal_plan_slots() calls auth.uid() for its ownership + rate-limit
-- checks. Impersonate the fixture user for the whole transaction.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ── Fixtures ───────────────────────────────────────────────────────────
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'fresco-396@test.local');

insert into public.user_profiles (id) values ('11111111-1111-1111-1111-111111111111');

insert into public.recipes (id, nombre, slug) values
  ('22222222-2222-2222-2222-222222222222', 'Test recipe 396 A', 'test-recipe-396-a'),
  ('33333333-3333-3333-3333-333333333333', 'Test recipe 396 B', 'test-recipe-396-b');

insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio)
values ('44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111', '2026-W01', '2026-01-05');

-- lunes/comida = real pendiente recipe A
-- martes/comida = real pendiente recipe B   (valid swap target)
-- miercoles/comida = excluida, recipe_id null (the franja the user removed)
insert into public.meal_plan_recipes (id, meal_plan_id, recipe_id, dia, tipo_plato, estado) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444',
     '22222222-2222-2222-2222-222222222222', 'lunes', 'comida', 'pendiente'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444',
     '33333333-3333-3333-3333-333333333333', 'martes', 'comida', 'pendiente'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444',
     null, 'miercoles', 'comida', 'excluida');

-- ── Case 1: excluida slot as argument A → rejected ─────────────────────
select throws_ok(
  $$ select public.swap_meal_plan_slots(
       'aaaaaaaa-0000-0000-0000-000000000003',
       'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'swap_meal_plan_slots: no se puede intercambiar una franja excluida',
  'A4-L9: rejects a swap whose first slot is excluida'
);

-- ── Case 2: excluida slot as argument B → rejected ────────────────────
select throws_ok(
  $$ select public.swap_meal_plan_slots(
       'aaaaaaaa-0000-0000-0000-000000000001',
       'aaaaaaaa-0000-0000-0000-000000000003') $$,
  'swap_meal_plan_slots: no se puede intercambiar una franja excluida',
  'A4-L9: rejects a swap whose second slot is excluida'
);

-- ── Case 3: the excluida slot is untouched by the rejected calls ──────
select is(
  (select estado::text from public.meal_plan_recipes where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'excluida', 'excluida slot still excluida after the rejected swaps'
);

-- ── Case 4: a normal pendiente<->pendiente swap still succeeds ────────
select lives_ok(
  $$ select public.swap_meal_plan_slots(
       'aaaaaaaa-0000-0000-0000-000000000001',
       'aaaaaaaa-0000-0000-0000-000000000002') $$,
  'a same-tipo_plato pendiente<->pendiente swap is allowed'
);

-- ── Case 5: the recipes actually exchanged positions ─────────────────
select is(
  (select recipe_id from public.meal_plan_recipes where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'lunes/comida now holds recipe B after the swap'
);

select * from finish();
rollback;
