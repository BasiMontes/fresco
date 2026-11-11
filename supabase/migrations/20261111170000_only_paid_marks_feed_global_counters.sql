-- FRESCO-1186 (integral review C5): the marks of Free users and guests no longer feed the global recipe counters.
--
-- Every `cocinada` / `descartada` mark of ANY user, Free and anonymous guests included, added 1 (once per user and
-- recipe, ADR-0063) to `recipes.veces_cocinada` / `veces_descartada`, and `scoreRecipe` reads those counters for
-- EVERYONE'S menu, Free included (more than 2 discards cost a recipe 4 points). Three accounts, even guest ones, were
-- enough to sink a dish for every user, and the learning card tells Free users "tus marcas se guardan igual, pero no
-- se aplican a tus menús", which was not true.
--
-- Decision (owner, 2026-11-11): only the marks of paying users (`pro`, `family`) count. A Free or guest mark is still
-- stored on the slot (the person sees it, and a later upgrade can use it for their own menus through the personal
-- signal), but it moves no global counter and writes no `recipe_user_feedback` row. Manipulating a dish now takes
-- paid accounts, and the card's sentence is true. The counters already in the database include earlier Free marks
-- and cannot be told apart, so they are left as they are.
--
-- Everything else in the trigger is the FRESCO-1012 version (counted once per user and recipe, the learning-neutral
-- swap guard, no rating).

create or replace function public.update_recipe_learning()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user uuid;
  v_plan public.plan_usuario;
  v_first integer;
begin
  -- FRESCO-383: swap_meal_plan_slots sets this for its transaction so a learning-neutral position swap
  -- does not record phantom cocinada/descartada events.
  if current_setting('app.skip_recipe_learning', true) is not distinct from 'on' then
    return new;
  end if;

  -- Only act on an actual state transition
  if old.estado = new.estado then
    return new;
  end if;

  if new.recipe_id is null or new.estado not in ('cocinada', 'descartada') then
    return new;
  end if;

  select user_id into v_user from public.meal_plans where id = new.meal_plan_id;
  if v_user is null then
    return new;
  end if;

  -- FRESCO-1186: a Free or guest mark is stored on the slot but feeds no global counter.
  select plan into v_plan from public.user_profiles where id = v_user;
  if v_plan is null or v_plan not in ('pro', 'family') then
    return new;
  end if;

  if new.estado = 'cocinada' then
    insert into public.recipe_user_feedback as f (user_id, recipe_id, cocinada_at)
    values (v_user, new.recipe_id, now())
    on conflict (user_id, recipe_id) do update set cocinada_at = excluded.cocinada_at
    where f.cocinada_at is null;
    get diagnostics v_first = row_count;

    update public.recipes
    set veces_cocinada     = veces_cocinada + v_first,
        ultima_vez_en_menu = current_date
    where id = new.recipe_id;

  else
    insert into public.recipe_user_feedback as f (user_id, recipe_id, descartada_at)
    values (v_user, new.recipe_id, now())
    on conflict (user_id, recipe_id) do update set descartada_at = excluded.descartada_at
    where f.descartada_at is null;
    get diagnostics v_first = row_count;

    update public.recipes
    set veces_descartada = veces_descartada + v_first
    where id = new.recipe_id;
  end if;

  return new;
end;
$$;

comment on function public.update_recipe_learning() is
  'FRESCO-1012/1186: trigger function of recipe_learning_trigger. Moves the global cocinada/descartada counters once per (user, recipe), only for paying users (pro, family). Never callable by a client.';
