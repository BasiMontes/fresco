-- FRESCO-948 — "Quitar" for an item that was added from "Sugerencias para ti".
-- The item carries `origen: 'sugerencia'` (set by the client when it calls
-- jsonb_add_item); undoing the add removes exactly that item and puts the card
-- back in the carousel, so this function only ever removes a suggestion-origin
-- item. An item that came from the meal plan has no `origen` and is never
-- touched, even if a caller names it.
--
-- SECURITY INVOKER, no identity parameter (ADR-0032, rpc-authorization.md §4):
-- the `shopping_update_own` / `shopping_select_own` policies already confine the
-- caller to their own list, so there is no DEFINER bypass to guard. A list that
-- belongs to someone else is invisible to the SELECT below and raises the same
-- "not found or not owned by caller" message jsonb_add_item uses.
--
-- Items are addressed by pasillo + item name, not by position, so a concurrent
-- toggle or add cannot shift the target (same reason jsonb_clear_comprados
-- filters by value). `for update` locks the row for the read-modify-write.
create or replace function public.jsonb_remove_item(
  p_list_id uuid,
  p_pasillo_nombre text,
  p_item_nombre text
)
returns void
language plpgsql
security invoker
set search_path = 'public', 'pg_temp'
as $$
declare
  v_items jsonb;
  v_result jsonb := '[]'::jsonb;
  v_pasillo jsonb;
  v_filtered_items jsonb;
begin
  select items into v_items
  from public.shopping_lists
  where id = p_list_id
  for update;

  if v_items is null then
    raise exception 'jsonb_remove_item: list % not found or not owned by caller', p_list_id;
  end if;

  for v_pasillo in select * from jsonb_array_elements(v_items)
  loop
    if v_pasillo->>'nombre' = p_pasillo_nombre then
      select coalesce(jsonb_agg(item), '[]'::jsonb) into v_filtered_items
      from jsonb_array_elements(v_pasillo->'items') item
      -- coalesce: an item with no `origen` yields NULL, and `not (... and NULL)`
      -- is NULL, which `where` would read as "drop the row" — the opposite of
      -- keeping a meal-plan item.
      where not (
        coalesce(item->>'nombre', '') = p_item_nombre
        and coalesce(item->>'origen', '') = 'sugerencia'
      );

      if jsonb_array_length(v_filtered_items) > 0 then
        v_result := v_result || jsonb_build_array(jsonb_set(v_pasillo, array['items'], v_filtered_items));
      end if;
    else
      v_result := v_result || jsonb_build_array(v_pasillo);
    end if;
  end loop;

  update public.shopping_lists
  set items = v_result
  where id = p_list_id;
end;
$$;

-- Least-privilege grant, same pattern as the other shopping-list RPCs: new
-- functions get EXECUTE granted to PUBLIC by default in Postgres.
revoke execute on function public.jsonb_remove_item(uuid, text, text) from public, anon;
grant execute on function public.jsonb_remove_item(uuid, text, text) to authenticated;
