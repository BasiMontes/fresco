-- FRESCO-998 (audit 7b: A7-SAFEA-01 to -05, -10, -12 to -16, -20, -28, -29, -37 to -39, -44, -45;
-- A7-SAFEB-14 to -17): diet flags that do not meet their own definition. Someone who filters by
-- `keto`, `halal`, `kosher`, `vegetariano`, `paleo` or `bajo_fodmap` is served a recipe that breaks
-- the diet they asked for.
--
-- Rules over the whole catalogue (inactive rows too, so a reactivated recipe is already right),
-- each one the SQL twin of a list in tests/db/recipe-allergen-diet-rules.ts. The coherence test
-- runs that oracle against the database, so the two cannot drift apart. Flags only go from true to
-- false; nothing is ever turned on. The owner chose to keep `paleo` and `bajo_fodmap` and correct
-- them by rule (2026-10-19) rather than retire them from the filter.
--
--   keto         patata, plátano, quinoa, tortilla de trigo, seitán, cereal, azúcar, miel, legumbre,
--                fruta, leche or yogur. Cream, cheese and butter stay: they are keto.
--   halal        carne picada nobody names ("carne picada") or mixed ("carne mixta").
--   kosher       vino, vermut, cava or brandy, unless the text says "vino kosher" / "vino certificado".
--   vegetariano  Parmesano or Gruyère, unless the text names the vegetarian version.
--   paleo        cereal, dairy or legume, by keyword or by the gluten, lactosa, soja, cacahuetes tag.
--   bajo_fodmap  cereal or dairy by tag, plus ajo, cebolla, puerro, espárrago, coliflor, setas,
--                champiñones, legumes, apple, pear, mango, watermelon and honey.
--
-- Every UPDATE carries a guard on the old value, so a rerun updates 0 rows. Slots already generated
-- (meal_plan_recipes) are not touched. supabase/seed.sql carries the same changes on the same rows.

-- Accent-free lower-case text of the ingredients and the steps, like the oracle's `normalize`.
create or replace function pg_temp.recipe_text(ingredients jsonb, steps jsonb)
returns text
language sql
immutable
as $$
  select translate(lower(coalesce(ingredients::text, '') || ' ' || coalesce(steps::text, '')), 'áéíóúüñ', 'aeiouun')
$$;

-- keto
update public.recipes
set dieta = jsonb_set(dieta, '{keto}', 'false')
where dieta->>'keto' = 'true'
  and regexp_replace(
        pg_temp.recipe_text(ingredientes_principales, pasos_resumen),
        '\m(?:(?:leche|bebida) de (?:coco|almendras?)|nata de coco|harina de (?:almendras?|coco|tapioca|castanas?)|pasta de (?:curry|tomate|miso|sesamo|guindilla|ajo|anchoas?|dientes|pimiento|pimenton))\M',
        ' ', 'g')
      ~ '\m(?:patatas?|platanos?|bananas?|quinoa|tortillas? de trigo|seitan|arroz|pasta|pan|harina|miel|azucar|avena|cuscus|boniato|garbanzos?|lentejas?|alubias?|maiz|leche|yogur|manzanas?|peras?|uvas|mango|naranjas?|pina|sandia|melon|kiwi|cerezas?|higos?|datiles|mandarinas?)\M';

-- halal
update public.recipes
set dieta = jsonb_set(dieta, '{halal}', 'false')
where dieta->>'halal' = 'true'
  and pg_temp.recipe_text(ingredientes_principales, pasos_resumen)
      ~ '\mcarne picada\M(?! de (?:ternera|pollo|pavo|cordero|vacuno))|\mcarne mixta\M|\mmezcla de carnes?\M';

-- kosher
update public.recipes
set dieta = jsonb_set(dieta, '{kosher}', 'false')
where dieta->>'kosher' = 'true'
  and regexp_replace(pg_temp.recipe_text(ingredientes_principales, pasos_resumen), '\mvino (?:kosher|certificado)\M', ' ', 'g')
      ~ '\m(?:vino|vermut|cava|brandy)\M';

-- vegetariano
update public.recipes
set dieta = jsonb_set(dieta, '{vegetariano}', 'false')
where dieta->>'vegetariano' = 'true'
  and regexp_replace(
        pg_temp.recipe_text(ingredientes_principales, pasos_resumen),
        '\m(?:parmesano|gruyere)(?: dop)? vegetariano\M|\mqueso vegetariano\M',
        ' ', 'g')
      ~ '\m(?:parmesano|gruyere)\M';

-- paleo
update public.recipes
set dieta = jsonb_set(dieta, '{paleo}', 'false')
where dieta->>'paleo' = 'true'
  and (
    alergenos ?| array['gluten', 'lactosa', 'soja', 'cacahuetes']
    or regexp_replace(
         pg_temp.recipe_text(ingredientes_principales, pasos_resumen),
         '\m(?:judias verdes|(?:leche|bebida) de (?:coco|almendras?)|nata de coco|harina de (?:almendras?|coco|tapioca|castanas?)|pasta de (?:curry|tomate|miso|sesamo|guindilla|ajo|anchoas?|dientes|pimiento|pimenton)|queso (?:vegano|de anacardos))\M',
         ' ', 'g')
       ~ '\m(?:trigo|pan|harina|pasta|espaguetis|macarrones|fideos|cuscus|seitan|avena|cebada|centeno|arroz|maiz|quinoa|bulgur|semola|galleta|leche|queso|yogur|nata|mantequilla|requeson|kefir|mozzarella|parmesano|feta|burrata|mascarpone|ricotta|garbanzos?|lentejas?|alubias?|judias|guisantes|habas|soja|tofu|tempeh|edamame|hummus|humus|cacahuetes?|azucar)\M'
  );

-- bajo_fodmap
update public.recipes
set dieta = jsonb_set(dieta, '{bajo_fodmap}', 'false')
where dieta->>'bajo_fodmap' = 'true'
  and (
    alergenos ?| array['gluten', 'lactosa']
    or pg_temp.recipe_text(ingredientes_principales, pasos_resumen)
       ~ '\m(?:ajo|cebolla|cebolletas?|puerros?|esparragos?|coliflor|setas?|champinones|garbanzos?|lentejas?|alubias?|judias blancas|guisantes|habas|manzanas?|peras?|mango|sandia|miel)\M'
  );

-- Inactive recipes break the older halal and kosher rules too (pork, alcohol, shellfish, meat with
-- dairy). The test and the nightly audit only look at ACTIVE rows, so nobody would notice until a
-- recipe is switched back on. Only inactive rows are touched: a finding on an active recipe
-- belongs to a person, not to a bulk rule.

-- halal: pork and alcohol
update public.recipes
set dieta = jsonb_set(dieta, '{halal}', 'false')
where not activo
  and dieta->>'halal' = 'true'
  and pg_temp.recipe_text(ingredientes_principales, pasos_resumen)
      ~ '\m(?:cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico|vino|cerveza|ron|brandy|licor|cava|bacon|beicon)\M';

-- kosher: rabbit, pork, shellfish, and meat with dairy
update public.recipes
set dieta = jsonb_set(dieta, '{kosher}', 'false')
where not activo
  and dieta->>'kosher' = 'true'
  and (
    pg_temp.recipe_text(ingredientes_principales, pasos_resumen)
      ~ '\m(?:conejo|cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico|bacon|beicon|gambas?|langostinos?|cangrejo|langosta|cigalas?|camarones?|centollo|bogavante|carabineros?|necoras?|percebes?|buey de mar|krill|calamares|calamar|mejillones|almejas|pulpo|sepia|ostras?|chipirones?|vieiras?|berberechos?|navajas?|zamburinas?|coquinas?|caracoles)\M'
    or (
      pg_temp.recipe_text(ingredientes_principales, pasos_resumen)
        ~ '\m(?:ternera|pollo|pavo|cordero|carne|pato|codornices|higado|rabo de toro|morcillo|solomillo)\M'
      and regexp_replace(
            pg_temp.recipe_text(ingredientes_principales, pasos_resumen),
            '\m(?:leche de coco|(?:bebida|leche) de (?:almendras?|avena|soja|arroz)|nata de coco|queso (?:vegano|de anacardos|de tofu))\M',
            ' ', 'g')
          ~ '\m(?:leche|queso|yogur|nata|mantequilla|requeson|skyr|bechamel|mozzarella|parmesano|feta|burrata|mascarpone|ricotta|kefir|crema pastelera)\M'
    )
  );
