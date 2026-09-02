-- pgTAP test for get_catalog() — FRESCO-384 (audit-4 A4-M7).
-- Server-side pagination + facet counts for the /recipes catalog.
-- Run by `supabase test db` (CI e2e job, right after `supabase db reset`).

begin;
select plan(12);

-- ── Fixture: one authenticated user with a default (unrestrictive) profile.
--    The catalog rows come from supabase/seed.sql (1000 recipes).
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'fresco-384@test.local');
insert into public.user_profiles (id) values ('11111111-1111-1111-1111-111111111111');

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  false
);
set local role authenticated;

-- ── Helpers: the manual equivalents, straight off get_filtered_recipes().
create temp view base as
  select * from public.get_filtered_recipes('11111111-1111-1111-1111-111111111111');

-- ── Case 1: no filters — page size honoured, total = whole safe catalog.
select is(
  jsonb_array_length(
    public.get_catalog('11111111-1111-1111-1111-111111111111', null, '{}', '{}', '{}', '{}', 30, 0) -> 'recipes'
  ),
  30, 'page returns exactly p_limit rows'
);
select is(
  (public.get_catalog('11111111-1111-1111-1111-111111111111', null, '{}', '{}', '{}', '{}', 30, 0) ->> 'total')::int,
  (select count(*)::int from base),
  'total equals the full safety-filtered catalog when no filter is applied'
);

-- ── Case 2: facets — all four sections present, mealTypes counts sum to total.
select is(
  (select count(*)::int from jsonb_object_keys(
    public.get_catalog('11111111-1111-1111-1111-111111111111', null, '{}', '{}', '{}', '{}', 30, 0) -> 'facets'
  )),
  4, 'facets has all four sections'
);
select is(
  (select sum(value::int)::int
   from jsonb_each_text(
     public.get_catalog('11111111-1111-1111-1111-111111111111', null, '{}', '{}', '{}', '{}', 30, 0) -> 'facets' -> 'mealTypes'
   )),
  (select count(*)::int from base where clasificacion->>'tipo_plato' is not null),
  'mealTypes facet counts sum to the total classifiable rows'
);

-- ── Case 3: free-text search narrows the total.
select cmp_ok(
  (public.get_catalog('11111111-1111-1111-1111-111111111111', 'pollo', '{}', '{}', '{}', '{}', 30, 0) ->> 'total')::int,
  '<',
  (select count(*)::int from base),
  'search "pollo" returns fewer than the full catalog'
);
select cmp_ok(
  (public.get_catalog('11111111-1111-1111-1111-111111111111', 'pollo', '{}', '{}', '{}', '{}', 30, 0) ->> 'total')::int,
  '>', 0,
  'search "pollo" returns something'
);

-- ── Case 4: mealTypes filter matches a hand-written count.
select is(
  (public.get_catalog('11111111-1111-1111-1111-111111111111', null, array['desayuno'], '{}', '{}', '{}', 30, 0) ->> 'total')::int,
  (select count(*)::int from base where clasificacion->>'tipo_plato' = 'desayuno'),
  'mealTypes=[desayuno] total matches a manual count'
);

-- ── Case 5: dietas filter (OR within section) matches a manual count.
select is(
  (public.get_catalog('11111111-1111-1111-1111-111111111111', null, '{}', '{}', array['vegetariano'], '{}', 30, 0) ->> 'total')::int,
  (select count(*)::int from base where coalesce((dieta->>'vegetariano')::boolean, false)),
  'dietas=[vegetariano] total matches a manual count'
);

-- ── Case 6: alergenos filter is exclusion, not inclusion.
select is(
  (public.get_catalog('11111111-1111-1111-1111-111111111111', null, '{}', '{}', '{}', array['gluten'], 30, 0) ->> 'total')::int,
  (select count(*)::int from base where not exists (
    select 1 from jsonb_array_elements_text(coalesce(alergenos, '[]'::jsonb)) e(v)
    where lower(e.v) = 'gluten'
  )),
  'alergenos=[gluten] removes every gluten recipe (exclusion semantics)'
);

-- ── Case 7: pagination — offset 30 does not overlap offset 0.
select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      public.get_catalog('11111111-1111-1111-1111-111111111111', null, '{}', '{}', '{}', '{}', 30, 0) -> 'recipes'
    ) a
    where a->>'id' in (
      select b->>'id'
      from jsonb_array_elements(
        public.get_catalog('11111111-1111-1111-1111-111111111111', null, '{}', '{}', '{}', '{}', 30, 30) -> 'recipes'
      ) b
    )
  ),
  0, 'page 1 and page 2 share no recipe ids'
);

-- ── Case 8: initial page payload stays small (AC: < 150 KB).
select cmp_ok(
  octet_length(
    (public.get_catalog('11111111-1111-1111-1111-111111111111', null, '{}', '{}', '{}', '{}', 30, 0))::text
  ),
  '<', 150000,
  'a 30-row page response serializes to under 150 KB'
);

-- ── Case 9: ownership guard.
select throws_ok(
  $$ select public.get_catalog('22222222-2222-2222-2222-222222222222', null, '{}', '{}', '{}', '{}', 30, 0) $$,
  null,
  null,
  'get_catalog rejects a call for another user''s profile'
);

select * from finish();
rollback;
