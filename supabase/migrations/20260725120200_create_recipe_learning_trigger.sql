-- ADR-0001's behavioral-learning moat, made operable: recipe_learning_trigger
-- fires after every meal_plan_recipes.estado transition and updates the
-- global (not per-user — see ADR-0001 Consequences) aggregate stats on
-- `recipes`. Recording is universal across every tier (FR-5.1, FR-5.3); the
-- Free/Pro boundary is enforced later, at generation time, by whether
-- get_recent_recipe_ids() output is fed into the prompt — not here.
--
-- Requires: the aprendizaje columns added to `recipes` by the first migration
-- in this batch, and the `meal_plan_recipes` table created by the second.
--
-- Source: fresco-schema-sql.md Block 5, copied verbatim — this trigger only
-- ever writes to `recipes`' flat top-level aprendizaje columns, which now
-- exist regardless of the rest of `recipes` being jsonb, so no shape
-- adaptation was needed here (unlike get_filtered_recipes in the previous
-- migration).

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
      rating_promedio    = case
        when new.rating is not null then
          round(
            (coalesce(rating_promedio, 0) * veces_cocinada + new.rating)
            / (veces_cocinada + 1), 2
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

create trigger recipe_learning_trigger
  after update on public.meal_plan_recipes
  for each row execute function public.update_recipe_learning();
