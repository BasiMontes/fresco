-- FRESCO-1152 (revisión integral, hallazgo FS-4): the substitution catalogue seed tagged "leche de avena"
-- and "harina de avena sin gluten" as gluten free (20260925120000_ingredient_substitution_catalog.sql),
-- so get_safe_ingredient_substitutes offered them to a profile with a gluten allergy or a gluten-free diet.
-- Oats are a cereal with gluten under Annex II of Regulation (EU) 1169/2011, and the recipe oracle's own
-- gluten rule lists `avena`.
--
-- Fail closed, like the recipes: both rows now declare `gluten` and no longer claim `sin_gluten`, so the
-- function's two existing filters (the allergen overlap and the diet flag) exclude them for those
-- profiles. The rows stay: they are still a valid substitute for everyone else, and a certified
-- gluten-free oat product exists but the catalogue cannot tell it apart, so it errs on the safe side.
-- The names are kept as they are because a confirmed substitution is stored by name.
--
-- No confirmed substitution uses them in production (checked 2026-11-10), so no slot needs touching.
-- tests/db/ingredient-substitution-tags.test.ts now runs the recipe keyword rule over this table, so a
-- row that names an oat and loses its tag fails there.

update public.ingredient_substitutions
set alergenos = case
      when 'gluten' = any (alergenos) then alergenos
      else array_append(alergenos, 'gluten')
    end,
    dieta = dieta || '{"sin_gluten": false}'::jsonb
where ingrediente_sustituto in ('leche de avena', 'harina de avena sin gluten');
