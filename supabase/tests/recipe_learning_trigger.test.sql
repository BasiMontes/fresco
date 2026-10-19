-- pgTAP test for recipe_learning_trigger / update_recipe_learning().
-- Run by `supabase test db` (CI: the e2e job in .github/workflows/pr-check.yml, right after
-- `supabase db reset`). Added with FRESCO-381 (the rating-average bug); rewritten with FRESCO-1012
-- (audit 7b A7-AUTHZ-02, A7-LOGIC-10): the global counters move once per (user, recipe) and the rating is
-- no longer part of the learning (ADR-0063).

begin;
select plan(10);

-- ── Fixtures ────────────────────────────────────────────────────────────
-- Two recipes, two users, three plans. estado starts 'pendiente'; every assertion drives a real
-- 'pendiente' -> X transition so the AFTER UPDATE trigger fires exactly as it does in production.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'fresco-381@test.local'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fresco-1012@test.local');

insert into public.user_profiles (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.recipes (id, nombre, slug) values
  ('22222222-2222-2222-2222-222222222222', 'Test recipe 381', 'test-recipe-381'),
  ('77777777-7777-7777-7777-777777777777', 'Test recipe 1012', 'test-recipe-1012');

insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '2026-W01', '2026-01-05'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '2026-W02', '2026-01-12'),
  ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-W01', '2026-01-05');

insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'lunes', 'desayuno'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'lunes', 'comida'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'lunes', 'cena'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'martes', 'desayuno'),
  ('33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777', 'miercoles', 'desayuno'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'lunes', 'desayuno'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'lunes', 'comida'),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'lunes', 'desayuno'),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'lunes', 'comida'),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'martes', 'desayuno');

create temp table base as
select veces_cocinada, veces_descartada, veces_calificada, rating_promedio
from public.recipes where id = '22222222-2222-2222-2222-222222222222';

-- ── Case 1: one user cooks the same recipe in 4 slots across 2 plans: counted once ──
update public.meal_plan_recipes set estado = 'cocinada'
where meal_plan_id = '33333333-3333-3333-3333-333333333333' and dia = 'lunes';
update public.meal_plan_recipes set estado = 'cocinada'
where meal_plan_id = '44444444-4444-4444-4444-444444444444' and tipo_plato = 'desayuno';

select is(
  (select veces_cocinada from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  (select veces_cocinada + 1 from base), 'veces_cocinada moves once for one user, however many slots and plans'
);

-- ── Case 2: a second user adds their own 1 ──────────────────────────────
update public.meal_plan_recipes set estado = 'cocinada'
where meal_plan_id = '55555555-5555-5555-5555-555555555555' and tipo_plato = 'desayuno' and dia = 'lunes';

select is(
  (select veces_cocinada from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  (select veces_cocinada + 2 from base), 'a second user adds 1 more'
);

-- ── Case 3: discarding counts once per user as well, independently of cooking ──
update public.meal_plan_recipes set estado = 'descartada'
where meal_plan_id = '33333333-3333-3333-3333-333333333333' and dia = 'martes';
update public.meal_plan_recipes set estado = 'descartada'
where meal_plan_id = '44444444-4444-4444-4444-444444444444' and tipo_plato = 'comida';

select is(
  (select veces_descartada from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  (select veces_descartada + 1 from base), 'veces_descartada moves once for one user across plans'
);

-- ── Case 4: the feedback table keeps one row per (user, recipe) ─────────
select is(
  (select count(*)::int from public.recipe_user_feedback where recipe_id = '22222222-2222-2222-2222-222222222222'),
  2, 'one feedback row per user and recipe'
);
select ok(
  (select cocinada_at is not null and descartada_at is not null from public.recipe_user_feedback
   where user_id = '11111111-1111-1111-1111-111111111111' and recipe_id = '22222222-2222-2222-2222-222222222222'),
  'the user who cooked and discarded has both marks'
);

-- ── Case 5: a rating no longer feeds the average (ADR-0063) ─────────────
update public.meal_plan_recipes set estado = 'cocinada', rating = 5
where meal_plan_id = '55555555-5555-5555-5555-555555555555' and tipo_plato = 'comida';

select is(
  (select veces_calificada from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  (select veces_calificada from base), 'veces_calificada is not moved by a rating'
);
select is(
  (select rating_promedio from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  (select rating_promedio from base), 'rating_promedio is not moved by a rating'
);

-- ── Case 6: sustituida is a no-op (pendiente -> sustituida) ────────────
update public.meal_plan_recipes set estado = 'sustituida'
where meal_plan_id = '55555555-5555-5555-5555-555555555555' and dia = 'martes';

select is(
  (select count(*)::int from public.recipe_user_feedback where recipe_id = '22222222-2222-2222-2222-222222222222'),
  2, 'sustituida adds no feedback row'
);

-- ── Case 7: a swap that sets the skip flag records nothing ──────────────
set local app.skip_recipe_learning = 'on';
update public.meal_plan_recipes set estado = 'cocinada'
where meal_plan_id = '33333333-3333-3333-3333-333333333333' and dia = 'miercoles';
reset app.skip_recipe_learning;

select is(
  (select veces_cocinada from public.recipes where id = '77777777-7777-7777-7777-777777777777'),
  0, 'a learning-neutral swap does not move the counter'
);
select is(
  (select count(*)::int from public.recipe_user_feedback where recipe_id = '77777777-7777-7777-7777-777777777777'),
  0, 'a learning-neutral swap writes no feedback row'
);

select * from finish();
rollback;
