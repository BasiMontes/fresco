-- FRESCO-863 (audit-6 A6-L8) — ADR-0042: quantities per catalog recipe.
--
-- `ingredientes_principales` stays a jsonb string[] (substitution, allergen and
-- cost code match on those names). This adds a parallel nullable column holding
-- [{ nombre, cantidad, unidad }], quantity for `meta.raciones` servings. It is
-- filled by the FRESCO-863 backfill script, so the column is nullable and the
-- check only constrains rows that carry a value.
--
-- The check lives in an IMMUTABLE function because a CHECK constraint cannot hold
-- a subquery: every element needs the right keys and types, `cantidad` > 0 (or
-- `unidad = 'al gusto'`, which has no number), `unidad` from a closed list, and
-- `nombre` must be one of the names in `ingredientes_principales`.
--
-- `get_filtered_recipes()` returns `r.*`, so recipe detail picks the column up with
-- no function change. Table-level grants already cover it.

create or replace function public.recipe_ingredient_quantities_valid(p_cantidades jsonb, p_nombres jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select p_cantidades is null
    or (
      jsonb_typeof(p_cantidades) = 'array'
      and jsonb_typeof(coalesce(p_nombres, '[]'::jsonb)) = 'array'
      and not exists (
        select 1
        from jsonb_array_elements(p_cantidades) as e(item)
        where jsonb_typeof(e.item) <> 'object'
          or jsonb_typeof(e.item -> 'nombre') <> 'string'
          or jsonb_typeof(e.item -> 'cantidad') <> 'number'
          or jsonb_typeof(e.item -> 'unidad') <> 'string'
          or (e.item ->> 'unidad') not in ('g', 'ml', 'unidades', 'dientes', 'cucharadas', 'cucharaditas', 'pizca', 'al gusto')
          or ((e.item ->> 'cantidad')::numeric <= 0 and (e.item ->> 'unidad') <> 'al gusto')
          or not (coalesce(p_nombres, '[]'::jsonb) ? (e.item ->> 'nombre'))
      )
    );
$$;

alter table public.recipes
  add column ingredientes_cantidades jsonb;

alter table public.recipes
  add constraint recipes_ingredientes_cantidades_valid
  check (public.recipe_ingredient_quantities_valid(ingredientes_cantidades, ingredientes_principales));

comment on column public.recipes.ingredientes_cantidades is
  'FRESCO-863 / ADR-0042. [{nombre, cantidad, unidad}] quantity per recipe for meta.raciones servings; nombre repeats an entry of ingredientes_principales verbatim. Null until backfilled. Shape enforced by recipes_ingredientes_cantidades_valid.';
