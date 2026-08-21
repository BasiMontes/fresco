-- FRESCO-236. RLS policies restrict rows, but never substitute for the base
-- table-level GRANT Postgres still requires -- the same gap
-- `20260803010000_grant_authenticated_recetas_propias.sql` closed for
-- select/insert. Without this, the new update/delete policies added in
-- `20260821120000_add_update_delete_policies_recetas_propias.sql` would still
-- fail with "permission denied for table recetas_propias".

grant update, delete on public.recetas_propias to authenticated;
