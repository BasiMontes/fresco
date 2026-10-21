-- FRESCO-1040: wheat products without the word "trigo" (kritharaki, orzo, crumpets, English muffins,
-- roscas, pita, naan, couscous, bagels) now count as gluten in the barrier, as in the TypeScript
-- oracle (tests/db/recipe-allergen-diet-rules.ts). Only recipe_tag_keywords changes; probed on the
-- hosted catalogue: 2 of 538 active recipes use these words and both already carry the gluten tag.

create or replace function public.recipe_tag_keywords(p_allergen text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  select case p_allergen
    when 'lactosa' then '\m(?:leche|queso|yogur|nata|mantequilla|requeson|skyr|bechamel|mozzarella|parmesano|feta|burrata|mascarpone|ricotta|kefir|crema pastelera)\M'
    when 'gluten' then '\m(?:trigo|pan|harina|pasta|espaguetis|macarrones|fideos|cuscus|seitan|avena|cebada|centeno|galleta|croissant|bagels?|granola|lasana|tortellini|picatostes|masa|cerveza|ramen|empanadas?|espelta|kamut|escanda|bulgur|semola|farro|gnocchi|noquis|pizza|rebozad[oa]s?|panko|salsa de soja|shoyu|bechamel|miso|kritharaki|orzo|crumpets?|muffins?|roscas?|pitas?|naan|couscous|cous cous)\M'
    when 'huevo' then '\m(?:huevos?|mayonesa|crema pastelera|crema de limon|crepes?|croissant|bizcocho|merengue|brioche|magdalenas?|natillas|flan)\M'
    when 'pescado' then '\m(?:salmon|bacalao|merluza|atun|bonito|rape|anchoas?|sardinas?|boquerones|dorada|corvina|pescado|lubina|trucha|caballa|rodaballo|pez espada|emperador|lenguado|abadejo|mero|pargo|besugo|bacaladilla|jurel|pescadilla|surimi|fumet|dashi)\M'
    when 'crustaceos' then '\m(?:gambas?|langostinos?|cangrejo|langosta|cigalas?|camarones?|centollo|bogavante|carabineros?|necoras?|percebes?|buey de mar|krill)\M'
    when 'moluscos' then '\m(?:calamares|calamar|mejillones|almejas|pulpo|sepia|ostras?|chipirones?|vieiras?|berberechos?|navajas?|zamburinas?|coquinas?|caracoles)\M'
    when 'soja' then '\m(?:soja|tofu|tempeh|tamari|miso|edamame|teriyaki|shoyu)\M'
    when 'sesamo' then '\m(?:sesamo|tahini|tahina|hummus|humus)\M'
    when 'cacahuetes' then '\m(?:cacahuetes?)\M'
    when 'frutos_de_cascara' then '\m(?:nueces|nuez|almendras?|avellanas?|pistachos?|anacardos|pinones?|frutos secos)\M'
    when 'apio' then '\m(?:apio|caldo)\M'
    when 'sulfitos' then '\m(?:vino|vinagre|pasas|orejones|vermut|cava|sidra|mayonesa|barbacoa|cerveza|arroz de sushi)\M'
    when 'mostaza' then '\m(?:mostaza|curry|mayonesa|barbacoa)\M'
    when 'altramuces' then '\m(?:altramuz|altramuces|lupino|lupinos)\M'
  end
$fn$;
