-- FRESCO-194 — "+ Añadir" for a suggested item (favorites-based suggestions
-- carousel). Mirrors jsonb_set_comprado's ownership check and the least-
-- privilege grant pattern from 20260801010000_harden_security_definer_functions.sql
-- (new functions get EXECUTE granted to PUBLIC by default in Postgres — that
-- migration's whole point was closing that hole for every SECURITY DEFINER
-- function in this app, so the same explicit revoke/grant applies here).
--
-- Needs plpgsql (not a single jsonb_set like jsonb_set_comprado) because the
-- target pasillo may not exist yet in this list's `items` array — it must
-- find the pasillo by name and append into it, or append a whole new
-- pasillo bucket at the end if this is the first item of that aisle. `for
-- update` locks the row for the read-modify-write, same correctness
-- guarantee jsonb_set_comprado gets for free from being a single atomic
-- UPDATE statement.
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
