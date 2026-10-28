-- FRESCO-1059, piece 2 of 2: the barrier trigger now checks the season against `compute_recipe_season` (the
-- ingredients first, then the dish: ADR-0068), and the recipes the dish rule moves are backfilled.
--
-- Piece 1 (20261028082818) added `recipe_season_exceptions` and `compute_recipe_season`. This one:
--   1. replaces `recipe_temporada_problem` with a version that also takes the slug and the classification
--      (both default to NULL, so a call with only the season and the ingredients still works and means
--      "ingredients only"). The old two-argument function is dropped;
--   2. makes the trigger function pass `new.slug` and `new.clasificacion`, and the trigger fire when either
--      changes, so editing the category of a stew cannot leave it with a season that no longer fits;
--   3. backfills every row where the new answer differs from the stored season. The rows are the ones the owner
--      approved on 2026-10-28: 21 stews, soups and legume dishes to autumn and winter, the cold salmorejo to
--      summer, and six inactive variants of stewed lentils. The exceptions in `recipe_season_exceptions` keep
--      the other four recipes of those categories all year;
--   4. refuses to install the new rule over an active recipe that would still be incoherent.
--
-- The function is replaced BEFORE the backfill on purpose: the barrier of 20261027200000 compares an active
-- recipe's season with the ingredient-only answer and would reject the very update this migration makes.

create or replace function public.recipe_temporada_problem(
  p_temporada jsonb,
  p_ingredientes jsonb,
  p_slug text default null,
  p_clasificacion jsonb default null
)
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

  v_expected := public.compute_recipe_season(p_ingredientes, p_slug, p_clasificacion);
  if v_expected is not null and v_got <> v_expected then
    return format('temporada %s no cuadra con sus ingredientes y su tipo de plato, que dan %s', to_jsonb(v_got), to_jsonb(v_expected));
  end if;

  return null;
end
$fn$;

comment on function public.recipe_temporada_problem(jsonb, jsonb, text, jsonb) is
  'FRESCO-1059. First problem with a recipe season (shape, or not matching compute_recipe_season), NULL when fine. A conflict between ingredients (compute returns NULL) accepts any valid value. slug and clasificacion are optional: without them only the ingredients decide.';

revoke execute on function public.recipe_temporada_problem(jsonb, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.recipe_temporada_problem(jsonb, jsonb, text, jsonb) to service_role;

drop function if exists public.recipe_temporada_problem(jsonb, jsonb);

create or replace function public.enforce_recipe_season_coherence()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_problem text;
begin
  if new.activo is true then
    v_problem := public.recipe_temporada_problem(new.temporada, new.ingredientes_principales, new.slug, new.clasificacion);
  elsif new.temporada is not null then
    v_problem := public.recipe_temporada_shape_problem(new.temporada);
  end if;

  if v_problem is not null then
    raise exception E'La receta "%" no puede guardarse%: %.', new.nombre, case when new.activo is true then ' activa' else '' end, v_problem
      using errcode = 'check_violation',
            hint = 'Usa la temporada que da compute_recipe_season(ingredientes_principales, slug, clasificacion), o guárdala inactiva (activo = false) sin temporada o con una temporada bien formada.';
  end if;

  return new;
end
$fn$;

comment on function public.enforce_recipe_season_coherence() is
  'FRESCO-1059. Rejects a recipe whose season is malformed (any row) or, when the recipe is ACTIVE, does not fit its ingredients and its dish type (check_violation).';

-- Backfill: every recipe whose answer differs from what is stored. A conflict (NULL) and a draft with no season
-- are left alone, as in 20261027170000.
update public.recipes r
set temporada = to_jsonb(public.compute_recipe_season(r.ingredientes_principales, r.slug, r.clasificacion))
where r.temporada is not null
  and public.compute_recipe_season(r.ingredientes_principales, r.slug, r.clasificacion) is not null
  and r.temporada is distinct from to_jsonb(public.compute_recipe_season(r.ingredientes_principales, r.slug, r.clasificacion));

-- Refuse to install the rule over active data that still breaks it.
do $check$
declare
  v_broken text;
begin
  select string_agg('  - ' || r.nombre || ': ' || public.recipe_temporada_problem(r.temporada, r.ingredientes_principales, r.slug, r.clasificacion), E'\n' order by r.nombre)
    into v_broken
  from public.recipes r
  where r.activo and public.recipe_temporada_problem(r.temporada, r.ingredientes_principales, r.slug, r.clasificacion) is not null;

  if v_broken is not null then
    raise exception E'Hay recetas activas con temporada incoherente; corrígelas antes de instalar la regla del plato:\n%', v_broken;
  end if;
end
$check$;

drop trigger if exists recipes_temporada_coherence on public.recipes;
create trigger recipes_temporada_coherence
  before insert or update of temporada, ingredientes_principales, activo, slug, clasificacion on public.recipes
  for each row execute function public.enforce_recipe_season_coherence();
