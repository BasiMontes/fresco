-- FRESCO-1015 (audit 7b: A7-AUTHZ-03, A7-AUTHZ-04, A7-AUTHZ-05, A7-API-03): privileges and input
-- checks that were wider than anything the app uses.
--
--   1. `authenticated` could UPDATE meal_plan_recipes.tipo_plato and meal_plans.fecha_inicio through
--      PostgREST with a normal session. No client write to either exists (the only client update of
--      meal_plans sets coste_estimado; the slot columns change inside RPCs). A column cannot be
--      revoked while the table-level grant stands, so the table grant goes and the columns the app
--      writes come back one by one. id, created_at and updated_at are not granted: updated_at is
--      set by a trigger, which needs no privilege.
--   2. `anon` could EXECUTE confirm_ingredient_substitution: Postgres grants EXECUTE to PUBLIC on
--      every new function and the migration only added `authenticated`. The function is SECURITY
--      INVOKER and RLS stops an anonymous caller, but the entry point should not exist.
--   3. user_profiles.alergenos took any text. Same 14 slugs as recipes_alergenos_vocab
--      (20261013120000); a profile with `Soja` would never match a recipe tag, so the person
--      would be served the allergen.
--   4. jsonb_add_item appended whatever jsonb it was given. An item that is not an object is
--      rejected with 22023, so a malformed element can never reach the stored list.
--
-- Hosted data was read before writing this (2026-10-19): 4 profiles, none with a value outside the
-- vocabulary, so the CHECK validates on add. supabase/functions/get-shopping-list-suggestions skips
-- malformed saved items, for the lists written before this guard existed.

-- 1. column-level UPDATE
revoke update on public.meal_plan_recipes from authenticated;
grant update (meal_plan_id, recipe_id, dia, estado, rating, sustitucion_ingrediente) on public.meal_plan_recipes to authenticated;

revoke update on public.meal_plans from authenticated;
grant update (user_id, semana_iso, advertencias, explicacion_aprendizaje, coste_estimado) on public.meal_plans to authenticated;

-- 2. no anonymous entry point
revoke execute on function public.confirm_ingredient_substitution(uuid, text, text) from public, anon;
grant execute on function public.confirm_ingredient_substitution(uuid, text, text) to authenticated;

-- 3. allergen vocabulary on the profile
alter table public.user_profiles
  add constraint user_profiles_alergenos_vocab
  check (
    alergenos <@ array['altramuces','apio','cacahuetes','crustaceos','frutos_de_cascara','gluten','huevo','lactosa','mostaza','moluscos','pescado','sesamo','soja','sulfitos']::text[]
  );

-- 4. jsonb_add_item: the item must be an object (body otherwise verbatim from 20260814170000)
create or replace function public.jsonb_add_item(
  p_list_id uuid,
  p_pasillo_nombre text,
  p_item jsonb
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_items jsonb;
  v_idx int;
begin
  if p_item is null or jsonb_typeof(p_item) is distinct from 'object' then
    raise exception 'jsonb_add_item: the item must be a JSON object'
      using errcode = '22023';
  end if;

  select items into v_items
  from public.shopping_lists
  where id = p_list_id and user_id = auth.uid()
  for update;

  if v_items is null then
    raise exception 'jsonb_add_item: list % not found or not owned by caller', p_list_id;
  end if;

  select ord - 1 into v_idx
  from jsonb_array_elements(v_items) with ordinality as t(pasillo, ord)
  where pasillo->>'nombre' = p_pasillo_nombre
  limit 1;

  if v_idx is null then
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'nombre', p_pasillo_nombre,
        'orden', (select coalesce(max((p->>'orden')::int), 0) + 1 from jsonb_array_elements(v_items) p),
        'items', jsonb_build_array(p_item)
      )
    );
  else
    v_items := jsonb_set(
      v_items,
      array[v_idx::text, 'items'],
      (v_items->v_idx->'items') || jsonb_build_array(p_item)
    );
  end if;

  update public.shopping_lists
  set items = v_items
  where id = p_list_id and user_id = auth.uid();
end;
$$;

revoke execute on function public.jsonb_add_item(uuid, text, jsonb) from public, anon;
grant execute on function public.jsonb_add_item(uuid, text, jsonb) to authenticated;
