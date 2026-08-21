-- FRESCO-236 (Recetas propias: permitir editar y borrar receta propia). The
-- original `create_recetas_propias_table.sql` migration deliberately left
-- update/delete out of scope ("editing/deleting an already-created personal
-- recipe is explicitly out of scope"). That scope has now changed: a user
-- may edit or delete their own personal recipe from the detail page.

create policy "recetas_propias_update_own" on public.recetas_propias for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "recetas_propias_delete_own" on public.recetas_propias for delete
  to authenticated using ((select auth.uid()) = user_id);
