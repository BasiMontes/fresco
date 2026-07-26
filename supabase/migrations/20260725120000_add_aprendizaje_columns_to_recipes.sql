-- Add the ADR-0001 "aprendizaje" (behavioral-learning moat) columns to the
-- live, already-seeded `recipes` table (schema_supabase.sql, ~35 rows).
--
-- ADDITIVE ONLY. This migration does not touch, rename, or drop any existing
-- column on `recipes` — its JSONB shape (meta / clasificacion / dieta /
-- alergenos / ingredientes_principales / ...) is confirmed live and
-- authoritative (architecture.md §4) and is out of scope for this change.
-- It only adds the four flat, top-level columns that recipe_learning_trigger
-- (see the 3rd migration in this batch) writes to on every cooked/discarded
-- state change.
--
-- Source: ADR-0001 (behavioral-learning-moat), fresco-schema-sql.md Block 2,
-- functional-requirements.md FR-5.3.

alter table public.recipes
  add column if not exists veces_cocinada     integer      not null default 0,
  add column if not exists veces_descartada   integer      not null default 0,
  add column if not exists rating_promedio    numeric(3,2) check (rating_promedio between 1 and 5),
  add column if not exists ultima_vez_en_menu date;

comment on column public.recipes.veces_cocinada is
  'Global count of times this recipe was marked cocinada, across all users. ADR-0001: MVP aggregation is deliberately global, not per-user. Updated by recipe_learning_trigger.';
comment on column public.recipes.veces_descartada is
  'Global count of times this recipe was marked descartada, across all users. Updated by recipe_learning_trigger.';
comment on column public.recipes.rating_promedio is
  'Running average of 1-5 ratings given on cocinada slots, global across all users. Updated by recipe_learning_trigger.';
comment on column public.recipes.ultima_vez_en_menu is
  'Date this recipe was last marked cocinada by any user. Updated by recipe_learning_trigger.';
