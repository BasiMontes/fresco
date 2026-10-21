-- FRESCO-1020, slice 1 of 2: the rules that say whether a recipe's allergen and diet tags contradict its
-- own text, as one SQL function. Slice 2 puts a trigger on `recipes` that calls it; this slice only adds
-- the function (nothing calls it yet), so it cannot change a single row.
--
-- The rules were TypeScript only: `tests/db/recipe-allergen-diet-rules.ts` ran in CI over the seed and in a
-- nightly audit of the hosted catalogue. A recipe inserted straight into the hosted database, or
-- reactivated, reached users with wrong tags until the next night. This is the SQL twin of that oracle,
-- kept equal to it by `tests/db/recipe-tag-findings-parity.test.ts` (same rule keys over the whole
-- catalogue, and one synthetic recipe per keyword).
--
-- `recipe_tag_findings(alergenos, dieta, ingredientes_principales, pasos_resumen)` returns one row per
-- broken rule: `rule` is the oracle's key without the recipe id (`falta:gluten`, `dieta:keto`) and `detail`
-- says why, in Spanish, naming the ingredient or step. Zero rows means the tags agree with the text.
--
-- Text is matched the way the oracle does: lower case with accents stripped, whole words only (`\m ... \M`
-- is PostgreSQL's `\b`: a plain `\b` here is a backspace), over the ingredient list and the steps together.
-- The helpers are pure and IMMUTABLE and are not meant to be called by clients: execute is revoked from
-- public, anon and authenticated and granted to service_role only, and the trigger of slice 2 runs for the
-- roles that write to `recipes`.

-- Lower case, accents stripped, trimmed: the oracle's `normalize`.
create or replace function public.recipe_tag_norm(p_text text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  select btrim(translate(lower(coalesce(p_text, '')), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'))
$fn$;

-- allergen tag -> the words (in an ingredient or a step) that require it: ALLERGEN_KEYWORDS.
create or replace function public.recipe_tag_keywords(p_allergen text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  select case p_allergen
    when 'lactosa' then '\m(?:leche|queso|yogur|nata|mantequilla|requeson|skyr|bechamel|mozzarella|parmesano|feta|burrata|mascarpone|ricotta|kefir|crema pastelera)\M'
    when 'gluten' then '\m(?:trigo|pan|harina|pasta|espaguetis|macarrones|fideos|cuscus|seitan|avena|cebada|centeno|galleta|croissant|bagel|granola|lasana|tortellini|picatostes|masa|cerveza|ramen|empanadas?|espelta|kamut|escanda|bulgur|semola|farro|gnocchi|noquis|pizza|rebozad[oa]s?|panko|salsa de soja|shoyu|bechamel|miso)\M'
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

-- The text with the phrases that contain a keyword but are NOT the allergen removed (ALLERGEN_EXCEPTIONS).
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

-- Every whole-word keyword match of `p_allergen` in `p_text`, in order (a group-free pattern returns the match itself).
create or replace function public.recipe_tag_matched_words(p_allergen text, p_text text)
returns text[]
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  select coalesce(array_agg(m[1]), '{}'::text[])
  from regexp_matches(p_text, public.recipe_tag_keywords(p_allergen), 'g') as m
$fn$;

-- Does this ingredient (or this step, ignoring the variant cleared by the list) require `p_allergen`?
create or replace function public.recipe_tag_text_has(p_text text, p_allergen text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  select public.recipe_tag_cleaned(p_text, p_allergen) ~ public.recipe_tag_keywords(p_allergen)
$fn$;

-- Keyword words the recipe's own ingredient list already clears: "fideos de arroz" and "leche de coco" are
-- listed, so a step that says just "los fideos" or "la leche" refers to them. Only those exact words.
create or replace function public.recipe_tag_cleared(p_ingredientes text[], p_allergen text)
returns text[]
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  select coalesce(array_agg(distinct w), '{}'::text[])
  from unnest(p_ingredientes) as i(txt),
       unnest(public.recipe_tag_matched_words(p_allergen, i.txt)) as w
  where not public.recipe_tag_text_has(i.txt, p_allergen)
$fn$;

-- A step requires `p_allergen` when a keyword it names is not one the ingredient list already cleared.
-- Two words are noise only inside a step: "dorada" is an adjective and "masa" is the dough of whatever flour is listed.
create or replace function public.recipe_tag_step_has(p_step text, p_allergen text, p_cleared text[])
returns boolean
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_text text := public.recipe_tag_cleaned(p_step, p_allergen);
begin
  if p_allergen = 'pescado' then
    v_text := regexp_replace(v_text, '\mdorad[ao]s?\M', ' ', 'g');
  elsif p_allergen = 'gluten' then
    v_text := regexp_replace(v_text, '\mmasa\M', ' ', 'g');
  end if;
  return exists (
    select 1
    from unnest(public.recipe_tag_matched_words(p_allergen, v_text)) as w
    where not (w = any (p_cleared))
  );
end
$fn$;

-- First source (ingredient or step) that requires any of `p_allergens`, or null. `p_kind` is 'ingrediente' or 'paso'.
create or replace function public.recipe_tag_any_source_has(p_kind text[], p_txt text[], p_ingredientes text[], p_allergens text[])
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_allergen text;
  v_cleared text[];
  v_index int;
  v_hit boolean;
begin
  foreach v_allergen in array p_allergens loop
    v_cleared := public.recipe_tag_cleared(p_ingredientes, v_allergen);
    for v_index in 1 .. coalesce(array_length(p_txt, 1), 0) loop
      if p_kind[v_index] = 'paso' then
        v_hit := public.recipe_tag_step_has(p_txt[v_index], v_allergen, v_cleared);
      else
        v_hit := public.recipe_tag_text_has(p_txt[v_index], v_allergen);
      end if;
      if v_hit then
        return p_txt[v_index];
      end if;
    end loop;
  end loop;
  return null;
end
$fn$;

-- First text that matches `p_match` once every `p_not` phrase is removed from it, or null (the oracle's `breaks`).
create or replace function public.recipe_tag_first_break(p_txt text[], p_match text, p_not text[] default '{}')
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_text text;
  v_clean text;
  v_not text;
begin
  foreach v_text in array p_txt loop
    v_clean := v_text;
    foreach v_not in array p_not loop
      v_clean := regexp_replace(v_clean, v_not, ' ', 'g');
    end loop;
    if v_clean ~ p_match then
      return v_text;
    end if;
  end loop;
  return null;
end
$fn$;

-- The rules: one row per way the tags contradict the ingredient list and the steps (auditRecipeFindings).
create or replace function public.recipe_tag_findings(
  p_alergenos jsonb,
  p_dieta jsonb,
  p_ingredientes jsonb,
  p_pasos jsonb
)
returns table (rule text, detail text)
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_alergenos text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_alergenos, '[]'::jsonb))), '{}'::text[]);
  v_dieta jsonb := coalesce(p_dieta, '{}'::jsonb);
  v_ing text[];
  v_kind text[];
  v_txt text[];
  v_allergen text;
  v_flag text;
  v_found text;
  v_flags text[][] := array[['sin_gluten', 'gluten'], ['sin_lactosa', 'lactosa'], ['sin_huevo', 'huevo']];
  v_pair int;
  v_tag text;

  -- the phrases that look like a diet breaker and are not (plant drinks, nut flours, pastes)
  c_plant_drinks constant text := '(?:leche|bebida) de (?:coco|almendras?)|nata de coco';
  c_nut_flours constant text := 'harina de (?:almendras?|coco|tapioca|castanas?)';
  c_pastes constant text := 'pasta de (?:curry|tomate|miso|sesamo|guindilla|ajo|anchoas?|dientes|pimiento|pimenton)';
  c_keto_not constant text := '\m(?:' || c_plant_drinks || '|' || c_nut_flours || '|' || c_pastes || ')\M';
  c_paleo_not constant text := '\m(?:judias verdes|' || c_plant_drinks || '|' || c_nut_flours || '|' || c_pastes || '|queso (?:vegano|de anacardos))\M';

  c_not_halal constant text := '\m(?:cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico|vino|cerveza|ron|brandy|licor|cava|bacon|beicon)\M';
  c_not_kosher constant text := '\m(?:conejo|cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico|bacon|beicon)\M';
  c_meat constant text := '\m(?:ternera|pollo|pavo|cordero|carne|pato|codornices|higado|rabo de toro|morcillo|solomillo)\M';
  c_not_vegetarian constant text := '\m(?:ternera|pollo|pavo|cordero|carne|pato|codornices|higado|rabo de toro|morcillo|solomillo|cerdo|jamon|chorizo|panceta|tocino|morcilla|secreto iberico|conejo|bacon|beicon|salchichas?|lomo|pechuga|costillas?|gelatina)\M';
  c_not_meat_phrases constant text := '\m(?:sin carne|carne vegetal|carne de soja|vegetal de carne)\M';
  c_gluten_suspect constant text := '\m(?:tamari|teriyaki|salsa de soja|shoyu|cerveza|nachos)\M';
  c_gluten_free_phrases constant text := '\m(?:tamari|teriyaki|salsa de soja|shoyu|cerveza|nachos) sin gluten\M';
  c_vegetable_stock constant text := '\mcaldo de (?:verduras?|vegetal(?:es)?|hortalizas)\M';
  c_stock constant text := '\mcaldo\M';
  c_own_broth constant text := '\msu caldo\M';
  c_keto constant text := '\m(?:patatas?|platanos?|bananas?|quinoa|tortillas? de trigo|seitan|arroz|pasta|pan|harina|miel|azucar|avena|cuscus|boniato|garbanzos?|lentejas?|alubias?|maiz|leche|yogur|manzanas?|peras?|uvas|mango|naranjas?|pina|sandia|melon|kiwi|cerezas?|higos?|datiles|mandarinas?)\M';
  c_paleo constant text := '\m(?:trigo|pan|harina|pasta|espaguetis|macarrones|fideos|cuscus|seitan|avena|cebada|centeno|arroz|maiz|quinoa|bulgur|semola|galleta|leche|queso|yogur|nata|mantequilla|requeson|kefir|mozzarella|parmesano|feta|burrata|mascarpone|ricotta|garbanzos?|lentejas?|alubias?|judias|guisantes|habas|soja|tofu|tempeh|edamame|hummus|humus|cacahuetes?|azucar)\M';
  c_fodmap constant text := '\m(?:ajo|cebolla|cebolletas?|puerros?|esparragos?|coliflor|setas?|champinones|garbanzos?|lentejas?|alubias?|judias blancas|guisantes|habas|manzanas?|peras?|mango|sandia|miel)\M';
  c_unnamed_mince constant text := '\mcarne picada\M(?! de (?:ternera|pollo|pavo|cordero|vacuno))|\mcarne mixta\M|\mmezcla de carnes?\M';
  c_wine constant text := '\m(?:vino|vermut|cava|brandy)\M';
  c_certified_wine constant text := '\mvino (?:kosher|certificado)\M';
  c_rennet_cheese constant text := '\m(?:parmesano|gruyere)\M';
  c_vegetarian_cheese constant text := '\m(?:parmesano|gruyere)(?: dop)? vegetariano\M|\mqueso vegetariano\M';
begin
  select coalesce(array_agg(s.txt order by s.ord1, s.ord2) filter (where s.ord1 = 1), '{}'::text[]),
         coalesce(array_agg(s.kind order by s.ord1, s.ord2), '{}'::text[]),
         coalesce(array_agg(s.txt order by s.ord1, s.ord2), '{}'::text[])
    into v_ing, v_kind, v_txt
  from (
    select 'ingrediente'::text as kind, public.recipe_tag_norm(x.value) as txt, 1 as ord1, x.ordinality as ord2
    from jsonb_array_elements_text(coalesce(p_ingredientes, '[]'::jsonb)) with ordinality as x(value, ordinality)
    union all
    select 'paso'::text, public.recipe_tag_norm(x.value), 2, x.ordinality
    from jsonb_array_elements_text(coalesce(p_pasos, '[]'::jsonb)) with ordinality as x(value, ordinality)
  ) as s;

  -- 1. a keyword in the text with no allergen tag
  foreach v_allergen in array array['lactosa', 'gluten', 'huevo', 'pescado', 'crustaceos', 'moluscos', 'soja', 'sesamo',
                                    'cacahuetes', 'frutos_de_cascara', 'apio', 'sulfitos', 'mostaza', 'altramuces'] loop
    if v_allergen = any (v_alergenos) then
      continue;
    end if;
    v_found := public.recipe_tag_any_source_has(v_kind, v_txt, v_ing, array[v_allergen]);
    if v_found is not null then
      rule := 'falta:' || v_allergen;
      detail := 'falta ' || v_allergen || ' (' || v_found || ')';
      return next;
    end if;
  end loop;

  -- 2. the free-of flags against the allergen tags, and against the text when the tag is missing too
  for v_pair in 1 .. array_length(v_flags, 1) loop
    v_flag := v_flags[v_pair][1];
    v_allergen := v_flags[v_pair][2];
    if (v_dieta ->> v_flag) is distinct from 'true' then
      continue;
    end if;
    if v_allergen = any (v_alergenos) then
      rule := 'dieta:' || v_flag;
      detail := 'lleva ' || v_allergen || ' pero ' || v_flag || ' es true';
      return next;
    else
      v_found := public.recipe_tag_any_source_has(v_kind, v_txt, v_ing, array[v_allergen]);
      if v_found is not null then
        rule := 'dieta:' || v_flag;
        detail := v_flag || ' es true con ' || v_allergen || ' en el texto (' || v_found || ')';
        return next;
      end if;
    end if;
  end loop;

  if (v_dieta ->> 'sin_gluten') = 'true' then
    v_found := public.recipe_tag_first_break(v_txt, c_gluten_suspect, array[c_gluten_free_phrases]);
    if v_found is not null and not ('gluten' = any (v_alergenos))
       and public.recipe_tag_any_source_has(v_kind, v_txt, v_ing, array['gluten']) is null then
      rule := 'dieta:sin_gluten';
      detail := 'sin_gluten es true con un producto que suele llevar trigo o cebada (' || v_found || ')';
      return next;
    end if;
  end if;

  -- 3. halal, kosher, vegetarian by keyword
  v_found := public.recipe_tag_first_break(v_txt, c_not_halal);
  if v_found is not null and (v_dieta ->> 'halal') = 'true' then
    rule := 'dieta:halal';
    detail := 'halal es true con cerdo o alcohol (texto: ' || v_found || ')';
    return next;
  end if;
  v_found := public.recipe_tag_first_break(v_txt, c_unnamed_mince);
  if v_found is not null and (v_dieta ->> 'halal') = 'true' then
    rule := 'dieta:halal';
    detail := 'halal es true con carne picada sin especificar o mezclada (' || v_found || ')';
    return next;
  end if;

  v_found := public.recipe_tag_first_break(v_txt, c_wine, array[c_certified_wine]);
  if v_found is not null and (v_dieta ->> 'kosher') = 'true' then
    rule := 'dieta:kosher';
    detail := 'kosher es true con vino sin certificar (' || v_found || ')';
    return next;
  end if;

  v_found := public.recipe_tag_first_break(v_txt, c_rennet_cheese, array[c_vegetarian_cheese]);
  if v_found is not null and (v_dieta ->> 'vegetariano') = 'true' then
    rule := 'dieta:vegetariano';
    detail := 'vegetariano es true con un queso de cuajo animal; hay que nombrar el queso vegetariano (' || v_found || ')';
    return next;
  end if;

  -- 4. keto, paleo, bajo_fodmap
  if (v_dieta ->> 'keto') = 'true' then
    v_found := public.recipe_tag_first_break(v_txt, c_keto, array[c_keto_not]);
    if v_found is not null then
      rule := 'dieta:keto';
      detail := 'keto es true con almidón, azúcar, legumbre, fruta o leche (' || v_found || ')';
      return next;
    end if;
  end if;
  if (v_dieta ->> 'paleo') = 'true' then
    select t into v_tag from unnest(array['gluten', 'lactosa', 'soja', 'cacahuetes']) as t where t = any (v_alergenos) limit 1;
    v_found := public.recipe_tag_first_break(v_txt, c_paleo, array[c_paleo_not]);
    if v_tag is not null or v_found is not null then
      rule := 'dieta:paleo';
      detail := 'paleo es true con cereal, lácteo o legumbre (' || coalesce('alérgeno ' || v_tag, v_found) || ')';
      return next;
    end if;
  end if;
  if (v_dieta ->> 'bajo_fodmap') = 'true' then
    select t into v_tag from unnest(array['gluten', 'lactosa']) as t where t = any (v_alergenos) limit 1;
    v_found := public.recipe_tag_first_break(v_txt, c_fodmap);
    if v_tag is not null or v_found is not null then
      rule := 'dieta:bajo_fodmap';
      detail := 'bajo_fodmap es true con un desencadenante (' || coalesce('alérgeno ' || v_tag, v_found) || ')';
      return next;
    end if;
  end if;

  -- 5. kosher: rabbit, pork or shellfish, and meat with dairy
  if (v_dieta ->> 'kosher') = 'true' then
    v_found := coalesce(
      public.recipe_tag_first_break(v_txt, c_not_kosher),
      public.recipe_tag_any_source_has(v_kind, v_txt, v_ing, array['crustaceos', 'moluscos'])
    );
    if v_found is not null then
      rule := 'dieta:kosher';
      detail := 'kosher es true con conejo, marisco o cerdo (texto: ' || v_found || ')';
      return next;
    elsif public.recipe_tag_first_break(v_txt, c_meat) is not null
          and public.recipe_tag_any_source_has(v_kind, v_txt, v_ing, array['lactosa']) is not null then
      rule := 'dieta:kosher';
      detail := 'kosher es true con carne y lácteo';
      return next;
    end if;
  end if;

  -- 6. vegetarian and vegan
  if (v_dieta ->> 'vegetariano') = 'true' or (v_dieta ->> 'vegano') = 'true' then
    -- a bare "caldo" can be chicken or beef, so the flag cannot rest on it unless a vegetable stock is listed
    v_found := null;
    for v_pair in 1 .. coalesce(array_length(v_txt, 1), 0) loop
      if regexp_replace(regexp_replace(v_txt[v_pair], c_own_broth, ' ', 'g'), c_vegetable_stock, ' ', 'g') ~ c_stock then
        v_found := v_txt[v_pair];
        exit;
      end if;
    end loop;
    if v_found is not null and not exists (select 1 from unnest(v_ing) as i where i ~ c_vegetable_stock) then
      rule := 'dieta:caldo';
      detail := case when (v_dieta ->> 'vegano') = 'true' then 'vegano' else 'vegetariano' end
        || ' es true con un caldo sin especificar; hay que escribir "caldo de verduras" (' || v_found || ')';
      return next;
    end if;
  end if;

  if (v_dieta ->> 'vegetariano') = 'true' or (v_dieta ->> 'vegano') = 'true' then
    v_found := coalesce(
      public.recipe_tag_first_break(v_txt, c_not_vegetarian, array[c_not_meat_phrases]),
      public.recipe_tag_any_source_has(v_kind, v_txt, v_ing, array['pescado', 'crustaceos', 'moluscos'])
    );
    if v_found is not null then
      rule := case when (v_dieta ->> 'vegano') = 'true' then 'dieta:vegano' else 'dieta:vegetariano' end;
      detail := case when (v_dieta ->> 'vegano') = 'true' then 'vegano' else 'vegetariano' end
        || ' es true con carne o pescado (' || v_found || ')';
      return next;
    elsif (v_dieta ->> 'vegano') = 'true' then
      v_found := coalesce(
        public.recipe_tag_any_source_has(v_kind, v_txt, v_ing, array['lactosa', 'huevo']),
        public.recipe_tag_first_break(v_txt, '\mmiel\M')
      );
      if v_found is not null then
        rule := 'dieta:vegano';
        detail := 'vegano es true con lácteo, huevo o miel (' || v_found || ')';
        return next;
      end if;
    end if;
  end if;
end
$fn$;

comment on function public.recipe_tag_findings(jsonb, jsonb, jsonb, jsonb) is
  'FRESCO-1020. One row per way the allergen and diet tags contradict the ingredient list and the steps. SQL twin of auditRecipeFindings in tests/db/recipe-allergen-diet-rules.ts; kept equal by tests/db/recipe-tag-findings-parity.test.ts.';

-- Pure helpers, not an API: only service_role (and the roles the slice-2 trigger runs as) may call them.
revoke execute on function public.recipe_tag_norm(text) from public, anon, authenticated;
revoke execute on function public.recipe_tag_keywords(text) from public, anon, authenticated;
revoke execute on function public.recipe_tag_cleaned(text, text) from public, anon, authenticated;
revoke execute on function public.recipe_tag_matched_words(text, text) from public, anon, authenticated;
revoke execute on function public.recipe_tag_text_has(text, text) from public, anon, authenticated;
revoke execute on function public.recipe_tag_cleared(text[], text) from public, anon, authenticated;
revoke execute on function public.recipe_tag_step_has(text, text, text[]) from public, anon, authenticated;
revoke execute on function public.recipe_tag_any_source_has(text[], text[], text[], text[]) from public, anon, authenticated;
revoke execute on function public.recipe_tag_first_break(text[], text, text[]) from public, anon, authenticated;
revoke execute on function public.recipe_tag_findings(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.recipe_tag_norm(text) to service_role;
grant execute on function public.recipe_tag_keywords(text) to service_role;
grant execute on function public.recipe_tag_cleaned(text, text) to service_role;
grant execute on function public.recipe_tag_matched_words(text, text) to service_role;
grant execute on function public.recipe_tag_text_has(text, text) to service_role;
grant execute on function public.recipe_tag_cleared(text[], text) to service_role;
grant execute on function public.recipe_tag_step_has(text, text, text[]) to service_role;
grant execute on function public.recipe_tag_any_source_has(text[], text[], text[], text[]) to service_role;
grant execute on function public.recipe_tag_first_break(text[], text, text[]) to service_role;
grant execute on function public.recipe_tag_findings(jsonb, jsonb, jsonb, jsonb) to service_role;
