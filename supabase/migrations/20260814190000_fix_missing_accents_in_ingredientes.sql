-- FRESCO-196: 18 ingredient terms existed in the recipe catalog in two
-- spellings — with and without their real Spanish accent/ñ (e.g. "brocoli"
-- vs "brócoli", "champinones" vs "champiñones") — depending on which
-- generation batch wrote a given recipe. Visible as real spelling mistakes
-- anywhere ingredients render (shopping list, recipe detail).
--
-- Safe against aisle-pricing.ts's classification/pricing: those lookup
-- dictionaries (INGREDIENT_AISLE, PRICE_OVERRIDE, BASE_QUANTITIES) are
-- already keyed by normalizeNombre()'s accent-stripped output, not the raw
-- display string — correcting the raw data here doesn't change what those
-- dictionaries match against.
--
-- Covers both ingredient fields on `recipes` (ingredientes_principales,
-- ingredientes_que_puede_desagradar) and already-persisted
-- `shopping_lists.items` snapshots, so existing lists render correctly
-- immediately instead of only new ones generated after this migration.
with corrections(wrong, correct) as (
  values
    ('aji amarillo', 'ají amarillo'),
    ('atun', 'atún'),
    ('azafran', 'azafrán'),
    ('brocoli', 'brócoli'),
    ('calabacin', 'calabacín'),
    ('champinones', 'champiñones'),
    ('esparragos', 'espárragos'),
    ('higado', 'hígado'),
    ('jamon serrano', 'jamón serrano'),
    ('judias verdes', 'judías verdes'),
    ('limon', 'limón'),
    ('maiz blanco', 'maíz blanco'),
    ('pimenton dulce', 'pimentón dulce'),
    ('pimenton picante', 'pimentón picante'),
    ('platano', 'plátano'),
    ('salmon', 'salmón'),
    ('secreto iberico', 'secreto ibérico'),
    ('sesamo', 'sésamo')
)
update recipes r
set ingredientes_principales = (
  select jsonb_agg(coalesce(c.correct, elem))
  from jsonb_array_elements_text(r.ingredientes_principales) as elem
  left join corrections c on c.wrong = elem
)
where ingredientes_principales is not null
  and exists (
    select 1 from jsonb_array_elements_text(r.ingredientes_principales) as elem2
    where elem2 in (select wrong from corrections)
  );

with corrections(wrong, correct) as (
  values
    ('aji amarillo', 'ají amarillo'),
    ('atun', 'atún'),
    ('azafran', 'azafrán'),
    ('brocoli', 'brócoli'),
    ('calabacin', 'calabacín'),
    ('champinones', 'champiñones'),
    ('esparragos', 'espárragos'),
    ('higado', 'hígado'),
    ('jamon serrano', 'jamón serrano'),
    ('judias verdes', 'judías verdes'),
    ('limon', 'limón'),
    ('maiz blanco', 'maíz blanco'),
    ('pimenton dulce', 'pimentón dulce'),
    ('pimenton picante', 'pimentón picante'),
    ('platano', 'plátano'),
    ('salmon', 'salmón'),
    ('secreto iberico', 'secreto ibérico'),
    ('sesamo', 'sésamo')
)
update recipes r
set ingredientes_que_puede_desagradar = (
  select jsonb_agg(coalesce(c.correct, elem))
  from jsonb_array_elements_text(r.ingredientes_que_puede_desagradar) as elem
  left join corrections c on c.wrong = elem
)
where ingredientes_que_puede_desagradar is not null
  and exists (
    select 1 from jsonb_array_elements_text(r.ingredientes_que_puede_desagradar) as elem2
    where elem2 in (select wrong from corrections)
  );

with corrections(wrong, correct) as (
  values
    ('aji amarillo', 'ají amarillo'),
    ('atun', 'atún'),
    ('azafran', 'azafrán'),
    ('brocoli', 'brócoli'),
    ('calabacin', 'calabacín'),
    ('champinones', 'champiñones'),
    ('esparragos', 'espárragos'),
    ('higado', 'hígado'),
    ('jamon serrano', 'jamón serrano'),
    ('judias verdes', 'judías verdes'),
    ('limon', 'limón'),
    ('maiz blanco', 'maíz blanco'),
    ('pimenton dulce', 'pimentón dulce'),
    ('pimenton picante', 'pimentón picante'),
    ('platano', 'plátano'),
    ('salmon', 'salmón'),
    ('secreto iberico', 'secreto ibérico'),
    ('sesamo', 'sésamo')
)
update shopping_lists sl
set items = (
  select jsonb_agg(
    jsonb_set(
      pasillo,
      '{items}',
      (
        select jsonb_agg(
          jsonb_set(item, '{nombre}', to_jsonb(coalesce(c.correct, item->>'nombre')))
        )
        from jsonb_array_elements(pasillo->'items') item
        left join corrections c on c.wrong = item->>'nombre'
      )
    )
  )
  from jsonb_array_elements(sl.items) pasillo
)
where exists (
  select 1
  from jsonb_array_elements(sl.items) p2, jsonb_array_elements(p2->'items') i2
  where i2->>'nombre' in (select wrong from corrections)
);
