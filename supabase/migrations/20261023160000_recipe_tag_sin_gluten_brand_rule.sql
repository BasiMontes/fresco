-- FRESCO-1051: the recipe tag barrier (FRESCO-1020, ADR-0064) also rejects an ACTIVE recipe that claims
-- `sin_gluten` while one of its ingredients is a product that very often carries wheat.
--
-- FRESCO-1050 withdrew `sin_gluten` from the 13 hosted rows that listed caldo, caldo de carne, caldo de
-- pollo, morcilla, callos or salsa verde. That was a one-off data migration: nothing stopped a new recipe,
-- or an edit, from claiming the flag again with the same ingredient. This adds the rule to
-- `recipe_tag_findings`, so the trigger `recipes_tag_coherence` rejects it (SQLSTATE 23514) with the key
-- `dieta:sin_gluten_marca`. The TypeScript oracle carries the same rule (`GLUTEN_BRAND_DEPENDENT` in
-- tests/db/recipe-allergen-diet-rules.ts) and the parity test keeps both equal.
--
-- Matching is the same as FRESCO-1050: the WHOLE ingredient name, lower case and accents stripped, in
-- `ingredientes_principales`. "caldo de verduras" and "su caldo" are not on the list. Only active recipes
-- are guarded (the trigger's own scope), so a draft can still be saved and an inactive one cannot be
-- reactivated with the claim. The function is replaced in full: nothing else in it changes, and
-- `create or replace` keeps its comment and its grants (service_role only).
--
-- Every ACTIVE recipe of the hosted catalogue and of the seed already passes: FRESCO-1050 left no active
-- row with the flag and one of these names.

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
  -- FRESCO-1051: whole ingredient names whose wheat content depends on the brand (the list FRESCO-1050 withdrew sin_gluten for)
  c_gluten_brand constant text[] := array['caldo', 'caldo de carne', 'caldo de pollo', 'morcilla', 'callos', 'salsa verde'];
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
    -- ingredient list only, as FRESCO-1050: a step that says "el caldo" refers to a listed one
    select i into v_found from unnest(v_ing) as i where i = any (c_gluten_brand) limit 1;
    if v_found is not null then
      rule := 'dieta:sin_gluten_marca';
      detail := 'sin_gluten es true con un ingrediente que suele llevar trigo según la marca (' || v_found || ')';
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
