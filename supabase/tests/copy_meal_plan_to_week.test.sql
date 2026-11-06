-- pgTAP test for copy_meal_plan_to_week() — FRESCO-427 "Usar este menú en
-- la semana actual" from the "Histórico de menús" read-only view.
--
-- Run by `supabase test db` (CI: the e2e job in .github/workflows/pr-check.yml).

begin;
select plan(13);

-- ── Auth context ───────────────────────────────────────────────────────
-- copy_meal_plan_to_week() calls auth.uid() for its ownership check.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ── The weeks the function accepts (FRESCO-1012) ───────────────────────
-- It only targets the current or the next ISO week in Madrid, so the fixtures are built from "today".
create temp table wk as
select to_char((now() at time zone 'Europe/Madrid')::date, 'IYYY-"W"IW') as cur,
       to_date(to_char((now() at time zone 'Europe/Madrid')::date, 'IYYY-"W"IW'), 'IYYY-"W"IW') as cur_monday,
       to_char((now() at time zone 'Europe/Madrid')::date + 7, 'IYYY-"W"IW') as nxt,
       to_date(to_char((now() at time zone 'Europe/Madrid')::date + 7, 'IYYY-"W"IW'), 'IYYY-"W"IW') as nxt_monday;

-- ── Fixtures ───────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'fresco-427@test.local'),
  ('99999999-9999-9999-9999-999999999999', 'fresco-427-other@test.local');

insert into public.user_profiles (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('99999999-9999-9999-9999-999999999999');

insert into public.recipes (id, nombre, slug, temporada) values
  ('22222222-2222-2222-2222-222222222222', 'Test recipe 427 A', 'test-recipe-427-a', '["todo_el_ano"]'),
  ('33333333-3333-3333-3333-333333333333', 'Test recipe 427 B', 'test-recipe-427-b', '["todo_el_ano"]');

-- Source plan: NEXT week, owned by the fixture user (the self-copy case needs it inside the window). Two
-- real slots + one null-recipe slot; the rest of the 21 are irrelevant to the copy mechanics.
insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio)
select '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', nxt, nxt_monday from wk;

insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato, estado) values
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'lunes',  'comida', 'cocinada'),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'martes', 'cena',   'descartada'),
  ('44444444-4444-4444-4444-444444444444', null,                                   'lunes',  'desayuno', 'excluida');

-- An OLD plan already sitting on the target (current) week — must be replaced.
insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio)
select '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', cur, cur_monday from wk;
insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato, estado) values
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'lunes', 'comida', 'pendiente');

-- A plan owned by the OTHER user, for the not-owned rejection case.
insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio)
select '66666666-6666-6666-6666-666666666666', '99999999-9999-9999-9999-999999999999', nxt, nxt_monday from wk;

-- ── Case 1: copy onto the target week succeeds ─────────────────────────
select lives_ok(
  format($f$ select public.copy_meal_plan_to_week('44444444-4444-4444-4444-444444444444', %L, %L::date) $f$,
         (select cur from wk), (select cur_monday from wk)),
  'copy onto the current week is allowed'
);

-- ── Case 2: the old target-week plan is gone (replaced, not duplicated) ─
select is(
  (select count(*)::int from public.meal_plans
   where user_id = '11111111-1111-1111-1111-111111111111' and semana_iso = (select cur from wk)),
  1, 'exactly one plan for the target week after the copy'
);

-- ── Case 3: all 3 source slots were copied ────────────────────────────
select is(
  (select count(*)::int from public.meal_plan_recipes mpr
   join public.meal_plans mp on mp.id = mpr.meal_plan_id
   where mp.user_id = '11111111-1111-1111-1111-111111111111' and mp.semana_iso = (select cur from wk)),
  3, 'the 3 source slots landed on the target week'
);

-- ── Case 4: no copied slot keeps the source week's cocinada/descartada estado ─
-- FRESCO-1127: only `excluida` survives the copy (see Case 4b); everything else resets to pendiente.
select is(
  (select count(*)::int from public.meal_plan_recipes mpr
   join public.meal_plans mp on mp.id = mpr.meal_plan_id
   where mp.user_id = '11111111-1111-1111-1111-111111111111'
     and mp.semana_iso = (select cur from wk) and mpr.estado not in ('pendiente', 'excluida')),
  0, 'no copied slot carries the source week''s cocinada/descartada estado'
);

-- ── Case 4b: an excluida source slot stays excluida (FRESCO-1127) ─────
select is(
  (select count(*)::int from public.meal_plan_recipes mpr
   join public.meal_plans mp on mp.id = mpr.meal_plan_id
   where mp.user_id = '11111111-1111-1111-1111-111111111111'
     and mp.semana_iso = (select cur from wk) and mpr.estado = 'excluida'),
  1, 'the excluida source slot is copied as excluida, not reset to pendiente'
);

-- ── Case 5: copying a plan onto its own week is rejected ──────────────
select throws_ok(
  format($f$ select public.copy_meal_plan_to_week('44444444-4444-4444-4444-444444444444', %L, %L::date) $f$,
         (select nxt from wk), (select nxt_monday from wk)),
  format('copy_meal_plan_to_week: source plan is already the target week %s', (select nxt from wk)),
  'rejects a self-copy'
);

-- ── Case 6: copying a plan the caller does not own is rejected ────────
select throws_ok(
  format($f$ select public.copy_meal_plan_to_week('66666666-6666-6666-6666-666666666666', %L, %L::date) $f$,
         (select cur from wk), (select cur_monday from wk)),
  NULL,
  'rejects copying a plan owned by someone else'
);

-- ── Case 7: a week outside the current/next window is rejected (FRESCO-1012) ──
select throws_ok(
  $$ select public.copy_meal_plan_to_week('44444444-4444-4444-4444-444444444444', '2099-W10', '2099-03-02'::date) $$,
  '22023', NULL,
  'rejects a target week that is neither the current nor the next one'
);

-- ── Case 8: a date that is not the Monday of the week is rejected ─────
select throws_ok(
  format($f$ select public.copy_meal_plan_to_week('44444444-4444-4444-4444-444444444444', %L, %L::date) $f$,
         (select cur from wk), (select cur_monday + 1 from wk)),
  '22023', NULL,
  'rejects a fecha_inicio that is not the Monday of the target week'
);

-- ── FRESCO-1133: past-day exclusions are not carried over ───────────────
-- A plan generated on a Friday of last week: the generator (FRESCO-1129) marked Monday to Thursday as
-- `excluida` because those days were already over. Friday and Saturday were excluded by the user.
-- created_at is the Friday at midday Madrid; fecha_inicio is last week's Monday. Appended after Case 8
-- because copying onto the next week replaces the plan Cases 5 to 8 use as their source.
insert into public.meal_plans (id, user_id, semana_iso, fecha_inicio, created_at)
select '77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111',
       to_char(cur_monday - 7, 'IYYY-"W"IW'), cur_monday - 7,
       ((cur_monday - 7 + 4) + time '12:00') at time zone 'Europe/Madrid'
from wk;

insert into public.meal_plan_recipes (meal_plan_id, recipe_id, dia, tipo_plato, estado) values
  ('77777777-7777-7777-7777-777777777777', null, 'lunes',     'comida',    'excluida'),
  ('77777777-7777-7777-7777-777777777777', null, 'martes',    'comida',    'excluida'),
  ('77777777-7777-7777-7777-777777777777', null, 'miercoles', 'comida',    'excluida'),
  ('77777777-7777-7777-7777-777777777777', null, 'jueves',    'comida',    'excluida'),
  ('77777777-7777-7777-7777-777777777777', null, 'viernes',   'cena',      'excluida'),
  ('77777777-7777-7777-7777-777777777777', null, 'sabado',    'desayuno',  'excluida');

-- ── Case 9: the copy of that plan onto the next week succeeds ──────────
select lives_ok(
  format($f$ select public.copy_meal_plan_to_week('77777777-7777-7777-7777-777777777777', %L, %L::date) $f$,
         (select nxt from wk), (select nxt_monday from wk)),
  'copying a plan with past-day exclusions onto the next week is allowed'
);

-- ── Case 10: the days that were already over come back fillable ────────
select is(
  (select count(*)::int from public.meal_plan_recipes mpr
   join public.meal_plans mp on mp.id = mpr.meal_plan_id
   where mp.user_id = '11111111-1111-1111-1111-111111111111' and mp.semana_iso = (select nxt from wk)
     and mpr.dia in ('lunes', 'martes', 'miercoles', 'jueves') and mpr.estado = 'pendiente'),
  4, 'Monday to Thursday, excluded only because they were over, are copied as pendiente'
);

-- ── Case 11: the exclusions the user chose are kept ────────────────────
-- Friday is the day the plan was made (today itself still counts), Saturday is after it.
select is(
  (select count(*)::int from public.meal_plan_recipes mpr
   join public.meal_plans mp on mp.id = mpr.meal_plan_id
   where mp.user_id = '11111111-1111-1111-1111-111111111111' and mp.semana_iso = (select nxt from wk)
     and mpr.dia in ('viernes', 'sabado') and mpr.estado = 'excluida'),
  2, 'the Friday and Saturday exclusions stay excluida'
);

-- ── Case 12: every source slot was copied ──────────────────────────────
select is(
  (select count(*)::int from public.meal_plan_recipes mpr
   join public.meal_plans mp on mp.id = mpr.meal_plan_id
   where mp.user_id = '11111111-1111-1111-1111-111111111111' and mp.semana_iso = (select nxt from wk)),
  6, 'the 6 source slots landed on the target week'
);

select * from finish();
rollback;
