-- FRESCO-881 — the category / dish-type combinations the catalogue holds, for a person to read.
-- Read-only:
--
--   supabase db query --linked -f scripts/queries/catalog-category-dish-type-fit.sql
--
-- Unlike catalog-titles-and-categories-check.sql, an empty answer is not expected: a category
-- can legitimately live in two dish types (a "verdura" side at lunch and dinner). The query
-- lists every combination with how many active recipes hold it and one example, so the rare
-- ones (a handful of recipes, or a combination that reads oddly) stand out. The families the
-- product owner reviewed on 2026-10-11 are pinned by tests/db/recipe-category-dish-type.test.ts.

select clasificacion ->> 'categoria' as categoria,
       clasificacion ->> 'tipo_plato' as tipo_plato,
       count(*) as recetas,
       min(nombre) as ejemplo
from public.recipes
where activo
group by 1, 2
order by recetas asc, 1, 2;
