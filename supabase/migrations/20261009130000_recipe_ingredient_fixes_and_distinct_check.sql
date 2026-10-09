-- FRESCO-876 (audit-6 follow-up of FRESCO-863): catalog ingredient lists that
-- contradict their own recipe, and a guard so the simplest kind cannot come back.
--
-- 1. Four recipes whose OWN description backs the correction (the review of the
--    601 active recipes found more candidates, but only these have evidence in the
--    recipe's text; the rest is a product decision, see FRESCO-876's closing comment):
--      * Panqueques integrales con miel: description says "Panqueques de harina
--        integral", the list had `pan integral`.
--      * Croissant con jamón y queso: description says "Croissant relleno", the list
--        had `pan`.
--      * Bacalao a la vizcaína (the merluza one): description says "Bacalao guisado
--        en salsa de pimiento choricero", the list had `merluza`.
--      * Tempeh a la plancha con ajo con limón: `limón` was listed twice.
--    Each update only fires while the row still holds the exact old list, so it is
--    idempotent and never overwrites a later edit. `ingredientes_cantidades` is
--    updated with it (recipes_ingredientes_cantidades_valid needs every `nombre` to
--    exist in `ingredientes_principales`); the quantities are the ones the recipe
--    already had, only the name changes.
--
-- 2. `recipes_ingredientes_principales_distinct`: a recipe cannot list the same
--    ingredient twice (case and surrounding spaces ignored). The check lives in an
--    IMMUTABLE function for the same reason as `recipe_ingredient_quantities_valid`:
--    a CHECK constraint cannot hold a subquery. It runs on every insert and update of
--    `recipes`, whatever wrote the row (admin tool, import script, generation).

update public.recipes
set ingredientes_principales = '["harina integral", "leche", "huevo", "miel"]'::jsonb,
    ingredientes_cantidades = '[{"nombre": "harina integral", "cantidad": 120, "unidad": "g"}, {"nombre": "leche", "cantidad": 250, "unidad": "ml"}, {"nombre": "huevo", "cantidad": 2, "unidad": "unidades"}, {"nombre": "miel", "cantidad": 2, "unidad": "cucharadas"}]'::jsonb
where id = 'f51574b7-f91c-496d-a8a2-00127f5a84fa'
  and ingredientes_principales = '["pan integral", "leche", "huevo", "miel"]'::jsonb;

update public.recipes
set ingredientes_principales = '["croissant", "jamón cocido", "queso"]'::jsonb,
    ingredientes_cantidades = '[{"nombre": "croissant", "cantidad": 1, "unidad": "unidades"}, {"nombre": "jamón cocido", "cantidad": 40, "unidad": "g"}, {"nombre": "queso", "cantidad": 30, "unidad": "g"}]'::jsonb
where id = 'ff5ef9a9-05ac-4732-8533-195e4030999b'
  and ingredientes_principales = '["pan", "jamón cocido", "queso"]'::jsonb;

update public.recipes
set ingredientes_principales = '["bacalao", "pimiento", "tomate", "cebolla"]'::jsonb,
    ingredientes_cantidades = '[{"nombre": "bacalao", "cantidad": 400, "unidad": "g"}, {"nombre": "pimiento", "cantidad": 2, "unidad": "unidades"}, {"nombre": "tomate", "cantidad": 300, "unidad": "g"}, {"nombre": "cebolla", "cantidad": 1, "unidad": "unidades"}]'::jsonb
where id = '4b299042-9790-4fae-925e-36f11fadba93'
  and ingredientes_principales = '["merluza", "pimiento", "tomate", "cebolla"]'::jsonb;

update public.recipes
set ingredientes_principales = '["tempeh", "limón", "ajo"]'::jsonb
where id = '5ae688be-5d8a-4a10-a41e-afc237ba8202'
  and ingredientes_principales = '["tempeh", "limón", "ajo", "limón"]'::jsonb;

create or replace function public.recipe_ingredient_names_distinct(p_nombres jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
    when p_nombres is null or jsonb_typeof(p_nombres) <> 'array' then true
    else (select count(*) = count(distinct lower(btrim(e))) from jsonb_array_elements_text(p_nombres) as e)
  end;
$$;

alter table public.recipes
  add constraint recipes_ingredientes_principales_distinct
  check (public.recipe_ingredient_names_distinct(ingredientes_principales));

comment on constraint recipes_ingredientes_principales_distinct on public.recipes is
  'FRESCO-876. A recipe cannot list the same ingredient twice in ingredientes_principales (case and surrounding spaces ignored).';
