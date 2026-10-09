-- FRESCO-876 — review of the active catalog's ingredient lists. Read-only; run it after
-- each batch of recipes:
--
--   supabase db query --linked -f scripts/queries/catalog-ingredient-review.sql
--
-- One result set (the CLI prints only the last statement), three sections:
--
--   duplicados   MUST be empty: the database refuses duplicated names in
--                ingredientes_principales (recipes_ingredientes_principales_distinct).
--                It is here so "0 duplicates" is one query away, not a remembered fact.
--   descripcion  the recipe's DESCRIPTION names an ingredient its list does not have.
--   nombre       the recipe's NAME names an ingredient its list does not have.
--
-- descripcion and nombre are a REVIEW, not a gate: they match against every ingredient
-- name used by any recipe, and skip near matches ("arroz" vs "arroz redondo", "fresa" vs
-- "fresas"), so a person reads what is left. Fix the data only when the recipe's
-- own text (description, steps) backs the change; otherwise the decision is rename,
-- rewrite or deactivate.
--
-- FRESCO-880: `no_es_ingrediente` lists words that name a DISH ("pisto", "lasaña") or a
-- CLASS / SYNONYM of something the list already holds ("carne" for ternera, "setas" for
-- champiñones). They appear as an ingredient in a handful of recipes, which made them part
-- of the vocabulary and flagged every title that says "Risotto de setas". Each one carries
-- the reason it is not a missing ingredient; add a term only with its reason.

with no_es_ingrediente(termino, motivo) as (
  values
    ('caldo',        'preparation, not a shopping item: the broth is made from the listed ingredients'),
    ('pisto',        'dish name: its components (calabacín, pimiento, tomate) are the list'),
    ('hummus',       'dish name: its components (garbanzos, tahini) are the list'),
    ('lasaña',       'dish name: pasta and the filling are the list'),
    ('tortitas',     'dish name: the batter (avena, huevo, plátano) is the list'),
    ('salsa verde',  'dish name: parsley, garlic and oil are the sauce'),
    ('carne',        'class: the list names the cut (ternera, cerdo…)'),
    ('pescado blanco','class: the list names the fish (rape, merluza…)'),
    ('setas',        'class: champiñones and portobello are setas'),
    ('champiñones',  'class: portobello is a champiñón'),
    ('ajetes',       'synonym: tender garlic shoots, ajo is listed'),
    ('frutos secos', 'class: the list names the nut (nueces, almendras…)'),
    ('carne picada', 'class: the list names the meat (ternera, cerdo…)'),
    ('bechamel',     'preparation: made from the listed leche and queso'),
    ('alubias',      'synonym: fabes are alubias')
),
vocab as (
  select distinct lower(btrim(e)) as ing
  from public.recipes r, jsonb_array_elements_text(r.ingredientes_principales) e
  where length(btrim(e)) >= 4
    and lower(btrim(e)) not in (select termino from no_es_ingrediente)
),
named_but_absent as (
  select 'descripcion' as seccion, r.id, r.nombre, v.ing
  from public.recipes r
  join vocab v
    on lower(r.descripcion_corta) ~ ('(^|[^a-záéíóúñ])' || regexp_replace(v.ing, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '([^a-záéíóúñ]|$)')
  where r.activo
    and not exists (select 1 from jsonb_array_elements_text(r.ingredientes_principales) e where position(v.ing in lower(e)) > 0 or position(lower(btrim(e)) in v.ing) > 0)
  union all
  select 'nombre', r.id, r.nombre, v.ing
  from public.recipes r
  join vocab v
    on lower(r.nombre) ~ ('(^|[^a-záéíóúñ])' || regexp_replace(v.ing, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '([^a-záéíóúñ]|$)')
  where r.activo
    and not exists (select 1 from jsonb_array_elements_text(r.ingredientes_principales) e where position(v.ing in lower(e)) > 0 or position(lower(btrim(e)) in v.ing) > 0)
)
select 'duplicados' as seccion, r.id, r.nombre, r.ingredientes_principales::text as detalle
from public.recipes r
where (select count(*) from jsonb_array_elements_text(r.ingredientes_principales) e)
   <> (select count(distinct lower(btrim(e))) from jsonb_array_elements_text(r.ingredientes_principales) e)
union all
select seccion, id, nombre, string_agg(ing, ', ' order by ing)
from named_but_absent
group by seccion, id, nombre
order by 1, 3;
