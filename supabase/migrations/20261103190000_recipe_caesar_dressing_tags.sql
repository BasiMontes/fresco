-- FRESCO-1086 (audit 8 A8-SAFEA-01, open since A7-SAFEA-22): a Caesar salad carries egg and anchovy
-- in its dressing, and the catalogue contradicted itself. "Ensalada César con pollo" (#15) tags
-- `huevo` and `pescado`; the other Caesar recipes listed neither and two of them claimed
-- `sin_huevo`. The allergen filter (get_filtered_recipes) is a plain tag comparison, so an
-- egg-allergic or fish-allergic person with the filter on received them.
--
-- Two parts, both idempotent:
--   1. Data. Every recipe whose name says César (active or not, so a reactivated one is already
--      right) gets `huevo` and `pescado` appended when missing and `sin_huevo` set to false. The
--      hosted catalogue has 16 such rows: 3 active (`Ensalada César con pollo` #15, already right;
--      `Ensalada cesar`, which the audit named; and a second `Ensalada César con pollo` it did not
--      name, with only `lactosa`, `sin_huevo` and `sin_gluten`) and 13 inactive duplicates, 15 of
--      them wrong.
--      Ingredients and quantities are not touched: the tags are what the filter reads, and the
--      barrier only demands a tag for a word in the text. supabase/seed.sql carries the same change.
--   2. The word. `cesar` joins the `huevo` and `pescado` keyword lists (accents are stripped before
--      matching), so a recipe that writes "aliño César" in an ingredient or a step needs both tags
--      from now on (trigger `recipes_tag_coherence`, ADR-0064). The TypeScript oracle carries the
--      same words and the parity test keeps both equal. A recipe that only has César in its NAME is
--      held by the catalogue test in tests/db/recipe-composite-products.test.ts.
--
-- Slots already generated (meal_plan_recipes) are not touched. `create or replace` keeps the
-- function's comment and grants.

update public.recipes
set alergenos = (
      select coalesce(jsonb_agg(distinct a), '[]'::jsonb)
      from jsonb_array_elements_text(alergenos || '["huevo", "pescado"]'::jsonb) as a
    ),
    dieta = jsonb_set(dieta, '{sin_huevo}', 'false'::jsonb)
where public.recipe_tag_norm(nombre) like '%cesar%'
  and (not (alergenos ? 'huevo') or not (alergenos ? 'pescado') or (dieta ->> 'sin_huevo') is distinct from 'false');

create or replace function public.recipe_tag_keywords(p_allergen text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  select case p_allergen
    when 'lactosa' then '\m(?:leche|queso|yogur|nata|mantequilla|requeson|skyr|bechamel|mozzarella|parmesano|feta|burrata|mascarpone|ricotta|kefir|crema pastelera)\M'
    when 'gluten' then '\m(?:trigo|pan|harina|pasta|espaguetis|macarrones|fideos|cuscus|seitan|avena|cebada|centeno|galleta|croissant|bagels?|granola|lasana|tortellini|picatostes|masa|cerveza|ramen|empanadas?|espelta|kamut|escanda|bulgur|semola|farro|gnocchi|noquis|pizza|rebozad[oa]s?|panko|salsa de soja|shoyu|bechamel|miso|kritharaki|orzo|crumpets?|muffins?|roscas?|pitas?|naan|couscous|cous cous)\M'
    when 'huevo' then '\m(?:huevos?|mayonesa|crema pastelera|crema de limon|crepes?|croissant|bizcocho|merengue|brioche|magdalenas?|natillas|flan|cesar)\M'
    when 'pescado' then '\m(?:salmon|bacalao|merluza|atun|bonito|rape|anchoas?|sardinas?|boquerones|dorada|corvina|pescado|lubina|trucha|caballa|rodaballo|pez espada|emperador|lenguado|abadejo|mero|pargo|besugo|bacaladilla|jurel|pescadilla|surimi|fumet|dashi|cesar)\M'
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
