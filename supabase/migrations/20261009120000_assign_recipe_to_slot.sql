-- FRESCO-878: put a catalog recipe into a meal-plan slot from the Biblioteca.
--
-- `meal_plan_recipes.recipe_id` cannot be written from the client since
-- 20260928170000 (protect_meal_plan_recipes_integrity), and `swap_meal_plan_slots`
-- only exchanges two slots of the same plan. This function is the one write path
-- for "this recipe, in that slot".
--
-- Authorization (rpc-authorization.md §4, answered in the FRESCO-878 plan):
--   * SECURITY INVOKER, like `apply_recipe_status_update`: RLS (`mpr_update_own`,
--     and the select policies) scope every read and the UPDATE to the caller's own
--     rows. There is no identity parameter, so there is no actor to spoof.
--   * A slot that is not the caller's and a slot that does not exist raise the
--     SAME error, so the function is not an oracle for which slot ids exist.
--   * Food safety is re-checked here, in the server, through `get_filtered_recipes`
--     (which itself rejects `p_user_id <> auth.uid()`): allergens, diet and
--     disliked ingredients. Nothing the client shows is trusted.
--   * Only `pendiente` / `sustituida` slots of today or later (Europe/Madrid) of
--     the same `tipo_plato` as the recipe. History is never rewritten.
--
-- `sustitucion_ingrediente` is cleared: it is a substitution for the OLD recipe's
-- ingredient and means nothing for the new one. `estado` and `rating` are left as
-- they are, so the learning trigger sees no transition; the GUC is set anyway, like
-- `swap_meal_plan_slots`, so a future change to the trigger cannot count this as a
-- cook or a discard.

insert into public.rate_limit_endpoints (endpoint, max_per_hour) values
  ('assign_recipe_to_slot', 60);

create function public.assign_recipe_to_slot(
  p_slot_id uuid,
  p_recipe_id uuid
)
returns void
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_slot         public.meal_plan_recipes;
  v_fecha_inicio date;
  v_recipe       record;
  v_updated      integer;
begin
  if auth.uid() is null then
    raise exception 'assign_recipe_to_slot: slot not found' using errcode = 'P0001';
  end if;

  if not public.check_and_increment_rate_limit(auth.uid(), 'assign_recipe_to_slot', 60, 3600) then
    raise exception 'assign_recipe_to_slot: rate limit exceeded' using errcode = 'P0001';
  end if;

  -- RLS: a slot of another user is invisible here, exactly like a missing one.
  select * into v_slot from public.meal_plan_recipes where id = p_slot_id;
  if not found then
    raise exception 'assign_recipe_to_slot: slot not found' using errcode = 'P0001';
  end if;

  select mp.fecha_inicio into v_fecha_inicio
  from public.meal_plans mp
  where mp.id = v_slot.meal_plan_id;
  if not found then
    raise exception 'assign_recipe_to_slot: slot not found' using errcode = 'P0001';
  end if;

  if v_slot.estado not in ('pendiente', 'sustituida') then
    raise exception 'assign_recipe_to_slot: slot is not open (estado %)', v_slot.estado
      using errcode = 'P0001';
  end if;

  -- `dia_semana` is declared monday first, so its position is the day offset.
  if v_fecha_inicio + (array_position(enum_range(null::public.dia_semana), v_slot.dia) - 1)
       < (now() at time zone 'Europe/Madrid')::date then
    raise exception 'assign_recipe_to_slot: slot is in a past day' using errcode = 'P0001';
  end if;

  -- Food safety, server side. No row = the profile filters rule the recipe out
  -- (or it does not exist, or it is inactive).
  select r.id, r.clasificacion into v_recipe
  from public.get_filtered_recipes(auth.uid(), p_recipe_id) r
  where r.id = p_recipe_id
    and r.activo;
  if not found then
    raise exception 'assign_recipe_to_slot: recipe is not available for this profile'
      using errcode = 'P0001';
  end if;

  if v_recipe.clasificacion ->> 'tipo_plato' is distinct from v_slot.tipo_plato::text then
    raise exception 'assign_recipe_to_slot: recipe tipo_plato does not match the slot'
      using errcode = 'P0001';
  end if;

  perform set_config('app.skip_recipe_learning', 'on', true);
  perform set_config('app.mpr_trusted_write', 'on', true);

  update public.meal_plan_recipes
  set recipe_id = p_recipe_id,
      sustitucion_ingrediente = null
  where id = p_slot_id;

  get diagnostics v_updated = row_count;

  perform set_config('app.skip_recipe_learning', 'off', true);
  perform set_config('app.mpr_trusted_write', 'off', true);

  if v_updated = 0 then
    raise exception 'assign_recipe_to_slot: slot not found' using errcode = 'P0001';
  end if;
end;
$function$;

revoke execute on function public.assign_recipe_to_slot(uuid, uuid) from public, anon;
grant execute on function public.assign_recipe_to_slot(uuid, uuid) to authenticated;

comment on function public.assign_recipe_to_slot(uuid, uuid) is
  'FRESCO-878: puts a catalog recipe into one of the caller''s open meal-plan slots (same tipo_plato, today or later, passes get_filtered_recipes). SECURITY INVOKER, no identity parameter. Clears sustitucion_ingrediente. Rate limited (rate_limit_endpoints).';
