-- "Compra realizada" (receipt-ticket feature) previously only had
-- `jsonb_set_comprado` to reuse — no RPC existed to actually remove items,
-- so the button un-checked them instead of removing them, which read as a
-- no-op to the user ("los elementos no se borran... se supone que ya los
-- he comprado"). This RPC drops every item already marked `comprado = true`
-- from the list (and any pasillo bucket left empty as a result), mirroring
-- `jsonb_add_item`'s plpgsql/ownership-check/for-update shape rather than
-- `jsonb_set_comprado`'s single-statement one, since this needs to rebuild
-- the whole `items` array (filter + re-aggregate), not patch one path.
--
-- Filters by the already-persisted `comprado` flag rather than taking a
-- list of coordinates from the caller — every checkbox toggle already
-- writes `comprado = true` to the DB immediately on click (`jsonb_set_
-- comprado`, called from `handleToggle`), so by the time "Compra realizada"
-- is clicked the server already knows exactly which items qualify. No
-- index-shifting-on-multi-remove hazard either, since nothing is addressed
-- by position.
create or replace function public.jsonb_clear_comprados(
  p_list_id uuid
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_items jsonb;
  v_result jsonb := '[]'::jsonb;
  v_pasillo jsonb;
  v_filtered_items jsonb;
begin
  select items into v_items
  from public.shopping_lists
  where id = p_list_id and user_id = auth.uid()
  for update;

  if v_items is null then
    raise exception 'jsonb_clear_comprados: list % not found or not owned by caller', p_list_id;
  end if;

  for v_pasillo in select * from jsonb_array_elements(v_items)
  loop
    select coalesce(jsonb_agg(item), '[]'::jsonb) into v_filtered_items
    from jsonb_array_elements(v_pasillo->'items') item
    where coalesce((item->>'comprado')::boolean, false) = false;

    if jsonb_array_length(v_filtered_items) > 0 then
      v_result := v_result || jsonb_build_array(jsonb_set(v_pasillo, array['items'], v_filtered_items));
    end if;
  end loop;

  update public.shopping_lists
  set items = v_result
  where id = p_list_id and user_id = auth.uid();
end;
$$;

-- Least-privilege grant, same pattern as jsonb_add_item / jsonb_set_comprado
-- (20260801010000_harden_security_definer_functions.sql) — new functions
-- get EXECUTE granted to PUBLIC by default in Postgres, close that hole.
revoke execute on function public.jsonb_clear_comprados(uuid) from public, anon;
grant execute on function public.jsonb_clear_comprados(uuid) to authenticated;
