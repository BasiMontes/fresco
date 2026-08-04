-- Companion to 20260804020000_create_favorites_table.sql -- RLS alone
-- doesn't substitute for table-level GRANT (same gap 20260729120000 fixed
-- for the other core tables).

grant select, insert, delete on public.favorites to authenticated;
