-- FRESCO-1059, piece 1 of 2: when the dish is wanted, not only when its ingredients are in season (ADR-0067 left
-- this open). This piece is ADDITIVE: it adds the data and the function and nothing reads them yet, so the
-- catalogue and the barrier trigger (20261027190000 / 20261027200000) behave exactly as before. Piece 2 swaps
-- the trigger over to `compute_recipe_season` and backfills the recipes it changes.
--
-- The rule, decided by the owner on 2026-10-28 after reviewing the list recipe by recipe:
--   * it only applies to a recipe whose ingredients give ['todo_el_ano'] (no seasonal ingredient). A recipe with a
--     season from its ingredients keeps it (gazpacho and the cold creams stay in summer);
--   * such a recipe whose `clasificacion.categoria` is `guiso` or `sopa`, or `legumbres` and not `es_ligero`, is
--     wanted in the cold months: ['otono', 'invierno'];
--   * a per-slug exception wins over the category: salmorejo is cold (summer), and a lentil burger and the miso
--     soups are eaten all year, so they stay ['todo_el_ano'].
-- The first attempt used the `es_comfort_food` / `es_contundente` flags and was dropped: of the 108 recipes it moved,
-- most were pastries, sandwiches, eggs and toasts. `contundente` means filling, not wanted when it is cold.
--
-- `compute_recipe_temporada` is untouched. A conflict between ingredients (it returns NULL) is still a person's
-- decision and `compute_recipe_season` passes the NULL through.

create table if not exists public.recipe_season_exceptions (
  slug text primary key,
  temporadas text[] not null,
  motivo text not null,
  constraint recipe_season_exceptions_shape check (public.recipe_temporada_shape_problem(to_jsonb(temporadas)) is null)
);

comment on table public.recipe_season_exceptions is
  'FRESCO-1059. Recipes whose season the category rule of compute_recipe_season must not decide. temporadas is the season to use (todo_el_ano keeps the recipe all-year); motivo says why.';

alter table public.recipe_season_exceptions enable row level security;
revoke all on public.recipe_season_exceptions from public, anon, authenticated;
grant select on public.recipe_season_exceptions to service_role;

insert into public.recipe_season_exceptions (slug, temporadas, motivo) values
  ('salmorejo-cordobes-b115', array['verano'], 'Cold soup: the category rule would send it to autumn and winter.'),
  ('hamburguesa-de-lentejas-y-zanahoria-b48', array['todo_el_ano'], 'A burger, not a stew: eaten all year.'),
  ('sopa-miso-con-edamame', array['todo_el_ano'], 'Light Japanese soup with no season.'),
  ('sopa-miso-con-tofu-b47', array['todo_el_ano'], 'Light Japanese soup with no season.'),
  ('sopa-miso-tofu-algas', array['todo_el_ano'], 'Light Japanese soup with no season.')
on conflict (slug) do update set temporadas = excluded.temporadas, motivo = excluded.motivo;

-- The season of a recipe: the ingredients first, then the dish. Returns NULL when the seasonal ingredients share
-- no season (a person decides), the ingredient season when there is one, and for a recipe with none the exception
-- for its slug, else the cold months for a stew, soup or non-light legume dish, else ['todo_el_ano'].
create or replace function public.compute_recipe_season(p_ingredientes jsonb, p_slug text, p_clasificacion jsonb)
returns text[]
language sql
stable
set search_path to 'public', 'pg_temp'
as $fn$
  with base as (select public.compute_recipe_temporada(p_ingredientes) as seasons)
  select case
    when (select seasons from base) is distinct from array['todo_el_ano'] then (select seasons from base)
    else coalesce(
      (select e.temporadas from public.recipe_season_exceptions e where e.slug = p_slug),
      case
        when p_clasificacion->>'categoria' in ('guiso', 'sopa')
          or (p_clasificacion->>'categoria' = 'legumbres' and p_clasificacion->'es_ligero' is distinct from 'true'::jsonb)
        then array['otono', 'invierno']
      end,
      array['todo_el_ano']
    )
  end;
$fn$;

comment on function public.compute_recipe_season(jsonb, text, jsonb) is
  'FRESCO-1059. Season of a recipe from its ingredients (compute_recipe_temporada) and, when none is seasonal, from the dish: a per-slug exception, else autumn and winter for guiso, sopa and non-light legumbres. NULL when the ingredients conflict.';

revoke execute on function public.compute_recipe_season(jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.compute_recipe_season(jsonb, text, jsonb) to service_role;
