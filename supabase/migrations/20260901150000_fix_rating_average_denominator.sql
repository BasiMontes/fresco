-- FRESCO-381 (audit-4 A4-M2) — fix the rating running-average denominator.
--
-- update_recipe_learning() (20260725120200) computed rating_promedio as a
-- running average over `veces_cocinada`:
--
--   rating_promedio = (rating_promedio * veces_cocinada + new.rating) / (veces_cocinada + 1)
--
-- but `veces_cocinada` counts EVERY cocinada transition, and a rating is
-- optional (most toggles carry none — FR-5.4). Each unrated `cocinada` bumps
-- the denominator without adding to the numerator, so rating_promedio drifts
-- toward 0. Audit example: a recipe cooked 5x unrated + 1x rated 4 stores
-- 0.67 instead of 4.00.
--
-- Fix: track the number of *rated* cocinadas separately (veces_calificada)
-- and average over that. Then backfill both columns from the raw signal in
-- meal_plan_recipes so the historical drift is corrected too.
--
-- Out of scope (audit A4-M2 is only the rating denominator): veces_cocinada /
-- veces_descartada are left as-is.

-- 1. New counter: rated cocinadas only.
alter table public.recipes
  add column if not exists veces_calificada integer not null default 0;

comment on column public.recipes.veces_calificada is
  'Global count of cocinada slots that carried a 1-5 rating, across all users. '
  'Denominator for rating_promedio. Distinct from veces_cocinada (which counts '
  'every cocinada, rated or not). Updated by recipe_learning_trigger. FRESCO-381.';

-- 2. Rewrite the trigger function: average over veces_calificada, and only
--    bump it when a rating was actually given. Everything else (the
--    old.estado = new.estado guard, the descartada branch, the sustituida
--    no-op, security definer, search_path) is unchanged. `create or replace`
--    keeps the existing grants (revoked from public/anon/authenticated in
--    20260801010000_harden_security_definer_functions.sql).
create or replace function public.update_recipe_learning()
returns trigger as $$
begin
  -- Only act on an actual state transition
  if old.estado = new.estado then
    return new;
  end if;

  if new.estado = 'cocinada' then
    update public.recipes
    set
      veces_cocinada     = veces_cocinada + 1,
      ultima_vez_en_menu = current_date,
      veces_calificada   = case
        when new.rating is not null then veces_calificada + 1
        else veces_calificada
      end,
      rating_promedio    = case
        when new.rating is not null then
          round(
            (coalesce(rating_promedio, 0) * veces_calificada + new.rating)
            / (veces_calificada + 1), 2
          )
        else rating_promedio
      end
    where id = new.recipe_id;

  elsif new.estado = 'descartada' then
    update public.recipes
    set veces_descartada = veces_descartada + 1
    where id = new.recipe_id;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 3. Backfill from the raw signal. meal_plan_recipes holds every cooked slot
--    with its optional rating; cocinada is terminal so a recipe_id currently
--    at estado = 'cocinada' maps to exactly one cooked event. (A drag swap
--    via swap_meal_plan_slots moves an already-cooked slot without firing the
--    trigger — a rare undercount source that this snapshot-based recompute
--    also can't see; acceptable, and strictly better than the drifted value.)
update public.recipes r
set
  veces_calificada = c.n_rated,
  rating_promedio  = c.avg_rating
from (
  select
    recipe_id,
    count(*) filter (where rating is not null)              as n_rated,
    round(avg(rating) filter (where rating is not null), 2) as avg_rating
  from public.meal_plan_recipes
  where estado = 'cocinada' and recipe_id is not null
  group by recipe_id
) c
where r.id = c.recipe_id;

-- Recipes with cooked slots but zero ratings: clear any drifted average.
update public.recipes r
set rating_promedio = null
where r.veces_calificada = 0
  and r.rating_promedio is not null;
