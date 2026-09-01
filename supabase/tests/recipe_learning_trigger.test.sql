-- pgTAP test for recipe_learning_trigger / update_recipe_learning().
-- Run by `supabase test db` (CI: the e2e job in .github/workflows/pr-check.yml,
-- right after `supabase db reset`). First SQL test in the repo — added with
-- FRESCO-381 (audit-4 A4-M2), the rating-average-denominator bug.

begin;
select plan(9);

-- ── Fixtures ────────────────────────────────────────────────────────────
-- One recipe, one user, one plan, and enough slots to cook. estado starts
-- 'pendiente'; every assertion below drives a real 'pendiente' -> X transition
-- so the AFTER UPDATE trigger fires exactly as it does in production.

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'fresco-381@test.local');

insert into public.user_profiles (id) values ('11111111-1111-1111-1111-111111111111');

insert into public.recipes (id, nombre, slug)
values ('22222222-2222-2222-2222-222222222222', 'Test recipe 381', 'test-recipe-381');

insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '2026-W01', '2026-01-05'
);

-- 8 slots on the one recipe (7 days have 3 tipos; we only need distinct
-- (dia, tipo_plato) pairs to satisfy unique_slot).
insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato)
select
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  d::dia_semana,
  t::tipo_plato
from (values
  ('lunes','desayuno'), ('lunes','comida'), ('lunes','cena'),
  ('martes','desayuno'), ('martes','comida'), ('martes','cena'),
  ('miercoles','desayuno'), ('miercoles','comida'),
  ('jueves','desayuno')
) as s(d, t);

-- ── Case 1: audit regression — 5 unrated cocinadas + 1 rated 4 ───────────
-- The exact scenario A4-M2 flagged: old code stored 0.67, correct is 4.00.

update public.meal_plan_recipes set estado = 'cocinada'
where meal_plan_id = '33333333-3333-3333-3333-333333333333'
  and (dia, tipo_plato) in (
    ('lunes','desayuno'), ('lunes','comida'), ('lunes','cena'),
    ('martes','desayuno'), ('martes','comida')
  );

update public.meal_plan_recipes set estado = 'cocinada', rating = 4
where meal_plan_id = '33333333-3333-3333-3333-333333333333'
  and dia = 'martes' and tipo_plato = 'cena';

select is(
  (select veces_cocinada from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  6, 'veces_cocinada counts every cocinada (rated or not)'
);
select is(
  (select veces_calificada from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  1, 'veces_calificada counts only rated cocinadas'
);
select is(
  (select rating_promedio from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  4.00::numeric(3,2), 'rating_promedio = 4.00, not 0.67 (denominator is veces_calificada)'
);

-- ── Case 2: a second rated cocinada averages correctly ──────────────────
update public.meal_plan_recipes set estado = 'cocinada', rating = 2
where meal_plan_id = '33333333-3333-3333-3333-333333333333'
  and dia = 'miercoles' and tipo_plato = 'desayuno';

select is(
  (select veces_calificada from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  2, 'veces_calificada bumped to 2'
);
select is(
  (select rating_promedio from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  3.00::numeric(3,2), 'rating_promedio = mean(4, 2) = 3.00'
);

-- ── Case 3: descartada branch untouched ────────────────────────────────
update public.meal_plan_recipes set estado = 'descartada'
where meal_plan_id = '33333333-3333-3333-3333-333333333333'
  and dia = 'miercoles' and tipo_plato = 'comida';

select is(
  (select veces_descartada from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  1, 'descartada still increments veces_descartada'
);
select is(
  (select rating_promedio from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  3.00::numeric(3,2), 'descartada does not touch rating_promedio'
);

-- ── Case 4: sustituida is a no-op (pendiente -> sustituida) ────────────
update public.meal_plan_recipes set estado = 'sustituida'
where meal_plan_id = '33333333-3333-3333-3333-333333333333'
  and dia = 'jueves' and tipo_plato = 'desayuno';

-- veces_cocinada is 7 by now: 6 from Case 1 + 1 from Case 2's rated cocinada.
select is(
  (select veces_cocinada from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  7, 'sustituida transition does not change veces_cocinada'
);
select is(
  (select rating_promedio from public.recipes where id = '22222222-2222-2222-2222-222222222222'),
  3.00::numeric(3,2), 'sustituida transition does not change rating_promedio'
);

select * from finish();
rollback;
