-- FRESCO-1058, piece 5: an ACTIVE recipe cannot be saved with a season that does not fit its ingredients.
-- Same shape as the tag barrier (20261021095149, ADR-0064): a TRIGGER, not a CHECK constraint, because
-- `recipes` is updated often (learning counters, photos, last-in-menu date) and a CHECK is evaluated on every
-- UPDATE whichever column changed. This one fires only when a column the rule reads is written:
-- BEFORE INSERT OR UPDATE OF temporada, ingredientes_principales, activo.
--
-- The rule (`recipe_temporada_problem` returns the first problem, NULL when the season is fine):
--   * the season is a non-empty array of the five allowed values, in calendar order
--     (primavera, verano, otono, invierno), no repeats, and `todo_el_ano` only on its own;
--   * when `compute_recipe_temporada` gives an answer, the stored season IS that answer;
--   * when the ingredients share no season (it gives NULL) a person chose the season, so any valid value is
--     accepted: the five recipes pinned by 20261027180000 are exactly that case.
--
-- Only ACTIVE rows are guarded: an inactive recipe is a draft and can be saved half-finished, the barrier acts
-- when it is published. It rejects with SQLSTATE 23514 (check_violation) naming the recipe, the expected value
-- and the stored one. The trigger is named so that it fires AFTER `recipes_tag_coherence` (alphabetical order):
-- when both rules are broken the allergen / diet message is the one the person sees first.

create or replace function public.recipe_temporada_problem(p_temporada jsonb, p_ingredientes jsonb)
returns text
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_allowed constant text[] := array['primavera', 'verano', 'otono', 'invierno'];
  v_got text[];
  v_expected text[];
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
    null;
  elsif exists (select 1 from unnest(v_got) as s where s <> all (v_allowed)) then
    return 'temporada con un valor no permitido (solo primavera, verano, otono, invierno; todo_el_ano va solo)';
  elsif cardinality(v_got) <> (select count(distinct s) from unnest(v_got) as s) then
    return 'temporada con valores repetidos';
  elsif v_got <> (select array_agg(a order by array_position(v_allowed, a)) from unnest(v_got) as a) then
    return 'temporada fuera del orden primavera, verano, otono, invierno';
  end if;

  v_expected := public.compute_recipe_temporada(p_ingredientes);
  if v_expected is not null and v_got <> v_expected then
    return format('temporada %s no cuadra con sus ingredientes, que dan %s', to_jsonb(v_got), to_jsonb(v_expected));
  end if;

  return null;
end
$fn$;

comment on function public.recipe_temporada_problem(jsonb, jsonb) is
  'FRESCO-1058. First problem with a recipe season (shape, order, or not matching compute_recipe_temporada), NULL when fine. A conflict (compute returns NULL) accepts any valid value.';

revoke execute on function public.recipe_temporada_problem(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.recipe_temporada_problem(jsonb, jsonb) to service_role;

create or replace function public.enforce_recipe_season_coherence()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_problem text;
begin
  if new.activo is not true then
    return new;
  end if;

  v_problem := public.recipe_temporada_problem(new.temporada, new.ingredientes_principales);

  if v_problem is not null then
    raise exception E'La receta "%" no puede guardarse activa: %.', new.nombre, v_problem
      using errcode = 'check_violation',
            hint = 'Usa la temporada que da compute_recipe_temporada(ingredientes_principales), o guárdala inactiva (activo = false).';
  end if;

  return new;
end
$fn$;

comment on function public.enforce_recipe_season_coherence() is
  'FRESCO-1058. Rejects an ACTIVE recipe whose season does not fit its ingredients (check_violation).';

revoke execute on function public.enforce_recipe_season_coherence() from public, anon, authenticated;

-- Refuse to install the barrier over data that already breaks it: the backfill and the pinned overrides
-- (20261027170000, 20261027180000) must have left every active recipe coherent.
do $check$
declare
  v_broken text;
begin
  select string_agg('  - ' || r.nombre || ': ' || public.recipe_temporada_problem(r.temporada, r.ingredientes_principales), E'\n' order by r.nombre)
    into v_broken
  from public.recipes r
  where r.activo and public.recipe_temporada_problem(r.temporada, r.ingredientes_principales) is not null;

  if v_broken is not null then
    raise exception E'Hay recetas activas con temporada incoherente; corrígelas antes de instalar la barrera:\n%', v_broken;
  end if;
end
$check$;

drop trigger if exists recipes_temporada_coherence on public.recipes;
create trigger recipes_temporada_coherence
  before insert or update of temporada, ingredientes_principales, activo on public.recipes
  for each row execute function public.enforce_recipe_season_coherence();
