-- FRESCO-1130 (audit 8, A8-TEST-02): the allergen vocabulary learns the words a recipe uses without
-- ever writing the allergen. The TypeScript oracle (tests/db/recipe-allergen-diet-rules.ts) and this
-- SQL mirror change together; recipe-tag-findings-parity.test.ts proves they agree, word by word.
--
--   huevo              tortilla de patatas / espanola / francesa, clara(s), yema(s), omelette(s), revuelto(s)
--   gluten             wrap(s), penne, gyoza(s), bocadillo(s), sandwich(es), empanadilla(s), tempura,
--                      croqueta(s), udon, soba, tagliatelle(s)
--   lactosa            cheddar, emmental, manchego, gorgonzola, gouda, brie, helado(s)
--   frutos_de_cascara  pecana(s), macadamia(s)
--   mostaza            dijon
--   pescado            worcestershire, nuoc mam
--   sulfitos           albaricoque(s) seco(s), higo(s) seco(s)
--   apio               apionabo
--
-- Two phrases that contain a new word and are not the allergen join the exceptions: a lettuce or
-- cabbage wrap (gluten) and scrambled tofu (huevo).
--
-- Functions only, no data: recipe rows are not touched. The barrier trigger judges a row when it is
-- written, so a live recipe that names one of these words without the tag is refused the next time
-- it is edited, and shows in the nightly hosted audit until its tags are corrected.
-- `create or replace` keeps each function's comment and grants.

-- The words. Same function as 20261104100000 with the lists above extended.
create or replace function public.recipe_tag_keywords(p_allergen text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  select case p_allergen
    when 'lactosa' then '\m(?:leche|queso|yogur|nata|mantequilla|requeson|skyr|bechamel|mozzarella|parmesano|feta|burrata|mascarpone|ricotta|kefir|crema pastelera|cheddar|emmental|manchego|gorgonzola|gouda|brie|helados?)\M'
    when 'gluten' then '\m(?:trigo|pan|harina|pasta|espaguetis|macarrones|fideos|cuscus|seitan|avena|cebada|centeno|galleta|croissant|bagels?|granola|lasana|tortellini|picatostes|masa|cerveza|ramen|empanadas?|espelta|kamut|escanda|bulgur|semola|farro|gnocchi|noquis|pizza|rebozad[oa]s?|panko|salsa de soja|shoyu|bechamel|miso|kritharaki|orzo|crumpets?|muffins?|roscas?|pitas?|naan|couscous|cous cous|falafel|wraps?|penne|gyozas?|bocadillos?|sandwiches|sandwich|empanadillas?|tempura|croquetas?|udon|soba|tagliatelles?)\M'
    when 'huevo' then '\m(?:huevos?|mayonesa|crema pastelera|crema de limon|crepes?|croissant|bizcocho|merengue|brioche|magdalenas?|natillas|flan|cesar|pad thai|falafel|tortilla de patatas?|tortilla espanola|tortilla francesa|claras?|yemas?|omelettes?|revueltos?)\M'
    when 'pescado' then '\m(?:salmon|bacalao|merluza|atun|bonito|rape|anchoas?|sardinas?|boquerones|dorada|corvina|pescado|lubina|trucha|caballa|rodaballo|pez espada|emperador|lenguado|abadejo|mero|pargo|besugo|bacaladilla|jurel|pescadilla|surimi|fumet|dashi|cesar|pad thai|worcestershire|nuoc mam)\M'
    when 'crustaceos' then '\m(?:gambas?|langostinos?|cangrejo|langosta|cigalas?|camarones?|centollo|bogavante|carabineros?|necoras?|percebes?|buey de mar|krill)\M'
    when 'moluscos' then '\m(?:calamares|calamar|mejillones|almejas|pulpo|sepia|ostras?|chipirones?|vieiras?|berberechos?|navajas?|zamburinas?|coquinas?|caracoles)\M'
    when 'soja' then '\m(?:soja|tofu|tempeh|tamari|miso|edamame|teriyaki|shoyu|bebida vegetal)\M'
    when 'sesamo' then '\m(?:sesamo|tahini|tahina|hummus|humus|falafel)\M'
    when 'cacahuetes' then '\m(?:cacahuetes?)\M'
    when 'frutos_de_cascara' then '\m(?:nueces|nuez|almendras?|avellanas?|pistachos?|anacardos|pinones?|frutos secos|bebida vegetal|pecanas?|macadamias?)\M'
    when 'apio' then '\m(?:apio|apionabo|caldo)\M'
    when 'sulfitos' then '\m(?:vino|vinagre|pasas|orejones|vermut|cava|sidra|mayonesa|barbacoa|cerveza|arroz de sushi|albaricoques? secos?|higos? secos?)\M'
    when 'mostaza' then '\m(?:mostaza|dijon|curry|mayonesa|barbacoa)\M'
    when 'altramuces' then '\m(?:altramuz|altramuces|lupino|lupinos)\M'
  end
$fn$;

-- The exceptions. Same function as 20261021094055 with two phrases added (gluten: lettuce or cabbage
-- wrap; huevo: scrambled tofu).
create or replace function public.recipe_tag_cleaned(p_text text, p_allergen text)
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_text text := p_text;
  v_rule record;
begin
  for v_rule in
    select e.pattern
    from (values
      ('lactosa', '\mleche de coco\M'),
      ('lactosa', '\m(?:bebida|leche) de (?:almendras?|avena|soja|arroz)\M'),
      ('lactosa', '\mnata de coco\M'),
      ('lactosa', '\mqueso (?:vegano|de (?:anacardos|tofu))\M'),
      ('frutos_de_cascara', '\mnuez moscada\M'),
      ('frutos_de_cascara', '\m(?:bebida|leche) de almendras?\M'),
      ('gluten', '\mharina de (?:maiz|arroz|garbanzos?)\M'),
      ('gluten', '\mfideos de arroz\M'),
      ('gluten', '\mpapel de arroz\M'),
      ('gluten', '\mpan sin gluten\M'),
      ('gluten', '\mpasta sin gluten\M'),
      ('gluten', '\mpasta de (?:curry|tomate|miso|sesamo|guindilla|ajo|anchoas?|dientes|pimiento|pimenton)\M'),
      ('gluten', '\msalsa de soja sin gluten\M'),
      ('gluten', '\mmiso sin gluten\M'),
      ('gluten', '\mwraps? de (?:lechuga|col|hojas?)\M'),
      ('huevo', '\m(?:tofu revuelto|revuelto de tofu)\M'),
      ('apio', '\msu caldo\M'),
      ('soja', '\mbrotes de soja\M'),
      ('sulfitos', '\mvinagre de arroz\M')
    ) as e(allergen, pattern)
    where e.allergen = p_allergen
  loop
    v_text := regexp_replace(v_text, v_rule.pattern, ' ', 'g');
  end loop;
  return v_text;
end
$fn$;
