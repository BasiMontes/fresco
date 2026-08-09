-- Add source column to recipes (FRESCO-139, part of the Food.com dataset
-- migration, FRESCO-138). Nullable, no default -- the existing ~1000
-- AI-generated recipes have no external source to record and are left as
-- null; only recipes inserted by the Food.com ingestion pipeline (Stage 2,
-- FRESCO-144) populate this field.
--
-- Shape (documented in api/schemas/recipe.types.ts, not DB-enforced beyond
-- being jsonb):
--   { provider, dataset, dataset_publisher, source_recipe_id, declared_license }

alter table public.recipes
  add column source jsonb;

comment on column public.recipes.source is
  'Provenance for recipes ingested from an external dataset (FRESCO-138/139). Null for the original AI-generated catalog.';
