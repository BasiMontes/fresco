-- Supabase security advisor (2026-08-01, extension_in_public): pg_trgm was
-- installed in the public schema. Moved to the dedicated `extensions`
-- schema (Supabase's default search_path already includes it, so existing
-- usages of gin_trgm_ops — e.g. idx_recipes_nombre_trgm — keep resolving
-- without any code change).
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
