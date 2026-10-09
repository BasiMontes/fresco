-- FRESCO-861 — verification of the catalogue's titles and categories. Read-only:
--
--   supabase db query --linked -f scripts/queries/catalog-titles-and-categories-check.sql
--
-- Every row is a problem; no rows is the expected answer. The database already refuses
-- the first two kinds on write (recipes_nombre_sin_con_repetido,
-- recipes_categoria_en_contrato), so they are here to prove it, not to catch it. The
-- third kind is not enforced (a description may legitimately say "con ... con" in
-- different clauses) and is checked only in its first clause, where the generator
-- left the repetition.

select 'nombre con "con" repetido' as problema, id, nombre as detalle
from public.recipes
where nombre ~* '\mcon\M.*\mcon\M'
union all
select 'categoria fuera del contrato', id, nombre || ' -> ' || coalesce(clasificacion ->> 'categoria', '<null>')
from public.recipes
where clasificacion ->> 'categoria' is not null
  and clasificacion ->> 'categoria' not in (
    'arroz', 'batidos', 'bowls', 'carne', 'ensalada', 'guiso', 'huevos', 'lacteos', 'legumbres',
    'pasta', 'pescado', 'pizza', 'reposteria', 'sandwich', 'sopa', 'tostadas', 'verdura', 'wrap'
  )
union all
select 'descripcion con "con" repetido en su primera frase', id, descripcion_corta
from public.recipes
where split_part(split_part(descripcion_corta, ',', 1), '.', 1) ~* '\mcon\M.*\mcon\M'
order by 1, 3;
