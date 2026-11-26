-- FRESCO-1319 (owner decision, 2026-11-26): in meat, the EU authorises sulphites (E 220-228) as an
-- additive only in fresh meat preparations (Regulation 1333/2008, category 08.2): fresh salchicha,
-- longaniza and butifarra, breakfast sausages and burger meat. A recipe that names one needs the
-- `sulfitos` tag. Cured and cooked meat products have no such authorisation and require nothing on
-- their own; carry-over from another ingredient depends on the product label.
--
-- Functions only, no data: no recipe named any of these when this was written. The TypeScript
-- oracle (tests/db/recipe-allergen-diet-rules.ts) changes with it; the parity test proves they agree.
-- `create or replace` keeps the comment and grants.

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
    when 'sulfitos' then '\m(?:vino|vinagre|pasas|orejones|vermut|cava|sidra|mayonesa|barbacoa|cerveza|arroz de sushi|albaricoques? secos?|higos? secos?|salchichas? frescas?|longanizas? frescas?|butifarras? frescas?|burger meat|breakfast sausages?)\M'
    when 'mostaza' then '\m(?:mostaza|dijon|curry|mayonesa|barbacoa)\M'
    when 'altramuces' then '\m(?:altramuz|altramuces|lupino|lupinos)\M'
  end
$fn$;
