-- GIN indexes accelerating the `?|` (jsonb "any of these keys exist") checks
-- `public.get_filtered_recipes()` runs against `recipes.alergenos` and
-- `recipes.ingredientes_principales` (see
-- `20260801010000_harden_security_definer_functions.sql`). Neither column
-- had a GIN index before this migration — only `idx_recipes_nombre_trgm`
-- existed, for unrelated name search.
--
-- `recipes.dieta` is intentionally NOT indexed here: its filter conditions
-- use `(dieta->>'key')::boolean` key-extraction, which a plain GIN index on
-- the whole jsonb column does not accelerate (would need per-key expression
-- indexes) — not worth it at this table's current ~1000-row scale.
create index if not exists idx_recipes_alergenos_gin on public.recipes using gin (alergenos);
create index if not exists idx_recipes_ingredientes_principales_gin on public.recipes using gin (ingredientes_principales);
