-- FRESCO-525 — near-duplicate recipe review, read-only queries.
-- Run via: supabase db query --linked -f queries.sql

-- 1. Reproduce FRESCO-522's normalization and isolate the 11 near-duplicate
--    groups (literal nombre differs, normalized form matches). Excludes the
--    47 exact-name-duplicate groups (FRESCO-522/FRESCO-460 scope).
with normalized as (
  select id, nombre,
    regexp_replace(
      regexp_replace(
        translate(lower(nombre), 'áéíóúñ', 'aeioun'),
        '\y(de|con|a|al|y|en|la|el|los|las)\y', '', 'g'
      ),
    '\s+', ' ', 'g') as norm
  from recipes
  where activo
),
grouped as (
  select norm, count(*) as n, count(distinct nombre) as distinct_names,
         array_agg(nombre order by nombre) as nombres,
         array_agg(id::text order by nombre) as ids
  from normalized
  group by norm
  having count(*) > 1
)
select * from grouped where distinct_names > 1 order by norm;

-- 2. Foreign keys referencing recipes.id (used to scope the redirect step).
select
  tc.table_name as referencing_table,
  kcu.column_name as referencing_column,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_name = 'recipes'
  and tc.table_schema = 'public'
order by tc.table_name;

-- 3. Per-row ingredient + signal comparison for a given group (example: the
--    "Batido verde + miel" pair). Repeat with the relevant ids per group.
select id, nombre, ingredientes_principales, foto_url is not null as has_photo,
       veces_cocinada, veces_calificada, created_at
from recipes
where id in ('a8edf55f-21da-4269-a3d6-a248d6d4e50c', 'f87aa7ce-aa3e-45ff-b6a9-f152404e61a0')
order by nombre;
