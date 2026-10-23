-- FRESCO-1050 (review of FRESCO-908, 2026-10-23): a recipe must not claim `sin_gluten` while it uses
-- an ingredient that, bought as a product, very often carries wheat.
--
-- The catalogue review found no allergen missing from any recipe, but 48 diet claims depend on the
-- brand of the product the person buys. The most delicate is `sin_gluten`: someone with coeliac
-- disease who filters by it trusts that no recipe carries wheat. The owner chose the narrow option
-- (2026-10-23): withdraw the claim only where the ingredient is the likeliest to carry wheat.
--
--   caldo, caldo de carne, caldo de pollo   stock cubes often list wheat flour
--   morcilla                                some add breadcrumbs or flour
--   callos, salsa verde                     the sauce can be bound with flour
--
-- NOT touched, on purpose: curry en polvo, carne picada, tortilla de maíz and queso rallado (low
-- risk), `sin_lactosa` with chorizo and `sin_huevo` with pasta. The "check the label" notice the app
-- already shows covers those.
--
-- Effect: someone who filters by the DIET `sin_gluten` no longer sees these recipes. The ALLERGEN
-- `gluten` is not declared, so someone who filters by allergens sees no change.
--
-- By rule, over the whole catalogue (inactive rows too, so a reactivated recipe does not bring the
-- claim back), not by id: it holds on the hosted database and on the seeded one. On the hosted
-- database it changed 13 active rows (12 recipes, `Fabada asturiana` exists twice) and 0 inactive
-- ones. A flag only goes from true to false, and the guard on the old value makes a rerun update
-- 0 rows. supabase/seed.sql carries the same change on the same 13 rows.
--
-- The list comes from an AI's judgement of which products usually carry wheat, not from a rule or
-- a lab. Review it when real coeliac users exist.

-- The ingredient names are read from `ingredientes_principales` (a list of names, present on every
-- recipe, seeded ones included) OR from `ingredientes_cantidades` (names with amounts, only on the
-- hosted database). On the hosted database either one alone gives the same 13 rows; the seed has no
-- `ingredientes_cantidades` at all, so reading only that column would match nothing there.
update public.recipes r
set dieta = jsonb_set(r.dieta, '{sin_gluten}', 'false')
where r.dieta->>'sin_gluten' = 'true'
  and (
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(r.ingredientes_principales, '[]'::jsonb)) as i
      where lower(i) in ('caldo', 'caldo de carne', 'caldo de pollo', 'morcilla', 'callos', 'salsa verde')
    )
    or exists (
      select 1
      from jsonb_array_elements(coalesce(r.ingredientes_cantidades, '[]'::jsonb)) as i
      where lower(i->>'nombre') in ('caldo', 'caldo de carne', 'caldo de pollo', 'morcilla', 'callos', 'salsa verde')
    )
  );
