-- FRESCO-1058, piece 4: the allowed values and the fixed order of `recipes.temporada` hold for EVERY row,
-- not only the active ones. 20261027190000 guarded the shape of the season only on active recipes; an
-- inactive draft could still store 'otoño', a repeat or the wrong order, and reactivating it would then be
-- rejected with a message about a value nobody typed on purpose.
--
-- The shape rule moves into `recipe_temporada_shape_problem` and the trigger applies it to every row that
-- carries a season. Still a TRIGGER and not a CHECK (same reason as the tag barrier, ADR-0064: `recipes` is
-- updated often and a CHECK is evaluated on every UPDATE whichever column changed). A draft may still have NO
-- season (NULL): that is the only thing a draft keeps that an active recipe cannot. The part that depends on the
-- ingredients (the season must be the computed one) stays active-only.

create or replace function public.recipe_temporada_shape_problem(p_temporada jsonb)
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_allowed constant text[] := array['primavera', 'verano', 'otono', 'invierno'];
  v_got text[];
begin
  if p_temporada is null or jsonb_typeof(p_temporada) <> 'array' or jsonb_array_length(p_temporada) = 0 then
    return 'temporada vacía: debe ser una lista con primavera, verano, otono, invierno o todo_el_ano';
  end if;

  if exists (select 1 from jsonb_array_elements(p_temporada) e where jsonb_typeof(e) <> 'string') then
    return 'temporada con valores que no son texto';
  end if;

  select array_agg(e.value order by e.ord) into v_got
  from jsonb_array_elements_text(p_temporada) with ordinality as e(value, ord);

  if v_got = array['todo_el_ano'] then
    return null;
  elsif exists (select 1 from unnest(v_got) as s where s <> all (v_allowed)) then
    return 'temporada con un valor no permitido (solo primavera, verano, otono, invierno; todo_el_ano va solo)';
  elsif cardinality(v_got) <> (select count(distinct s) from unnest(v_got) as s) then
    return 'temporada con valores repetidos';
  elsif v_got <> (select array_agg(a order by array_position(v_allowed, a)) from unnest(v_got) as a) then
    return 'temporada fuera del orden primavera, verano, otono, invierno';
  end if;

  return null;
end
$fn$;

comment on function public.recipe_temporada_shape_problem(jsonb) is
  'FRESCO-1058. First problem with the SHAPE of a recipe season (non-empty list of allowed values, no repeats, calendar order, todo_el_ano alone), NULL when fine. NULL input counts as a problem; the trigger only calls it for rows that carry a season.';

revoke execute on function public.recipe_temporada_shape_problem(jsonb) from public, anon, authenticated;
grant execute on function public.recipe_temporada_shape_problem(jsonb) to service_role;

create or replace function public.recipe_temporada_problem(p_temporada jsonb, p_ingredientes jsonb)
returns text
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_problem text;
  v_got text[];
  v_expected text[];
begin
  v_problem := public.recipe_temporada_shape_problem(p_temporada);
  if v_problem is not null then
    return v_problem;
  end if;

  select array_agg(e.value order by e.ord) into v_got
  from jsonb_array_elements_text(p_temporada) with ordinality as e(value, ord);

  v_expected := public.compute_recipe_temporada(p_ingredientes);
  if v_expected is not null and v_got <> v_expected then
    return format('temporada %s no cuadra con sus ingredientes, que dan %s', to_jsonb(v_got), to_jsonb(v_expected));
  end if;

  return null;
end
$fn$;

create or replace function public.enforce_recipe_season_coherence()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_problem text;
begin
  if new.activo is true then
    v_problem := public.recipe_temporada_problem(new.temporada, new.ingredientes_principales);
  elsif new.temporada is not null then
    v_problem := public.recipe_temporada_shape_problem(new.temporada);
  end if;

  if v_problem is not null then
    raise exception E'La receta "%" no puede guardarse%: %.', new.nombre, case when new.activo is true then ' activa' else '' end, v_problem
      using errcode = 'check_violation',
            hint = 'Usa la temporada que da compute_recipe_temporada(ingredientes_principales), o guárdala inactiva (activo = false) sin temporada o con una temporada bien formada.';
  end if;

  return new;
end
$fn$;

comment on function public.enforce_recipe_season_coherence() is
  'FRESCO-1058. Rejects a recipe whose season is malformed (any row) or, when the recipe is ACTIVE, does not fit its ingredients (check_violation).';

-- Refuse to widen the barrier over rows that already break it.
do $check$
declare
  v_broken text;
begin
  select string_agg('  - ' || r.nombre || ': ' || public.recipe_temporada_shape_problem(r.temporada), E'\n' order by r.nombre)
    into v_broken
  from public.recipes r
  where r.temporada is not null and public.recipe_temporada_shape_problem(r.temporada) is not null;

  if v_broken is not null then
    raise exception E'Hay recetas con una temporada mal formada; corrígelas antes de ampliar la barrera:\n%', v_broken;
  end if;
end
$check$;
