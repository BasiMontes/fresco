-- Same gap `20260729120000_grant_authenticated_table_privileges.sql` fixed for
-- the other 4 typed-relational tables: RLS policies restrict rows, but never
-- substitute for the base table-level GRANT Postgres still requires. Found
-- live testing FRESCO-68 (permission denied for table recetas_propias).
-- select+insert only, matching the two RLS policies that exist (no update/
-- delete policy -- editing/deleting a personal recipe is out of scope).

grant select, insert on public.recetas_propias to authenticated;
