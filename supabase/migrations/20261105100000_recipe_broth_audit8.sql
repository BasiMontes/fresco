-- Audit 8, FRESCO-1123 (A8-SAFEB-05): `ingredientes_cantidades` omits "caldo de verduras" in recipes
-- whose `ingredientes_principales` lists it. The A7 `apio` fix added the stock to the ingredient
-- list only, so a consumer of the quantities (scaling, shopping list) lost the stock, which is the
-- allergen source (`apio`). The tags are right; the quantities column is incomplete.
--
-- Criterion, the same one FRESCO-1050 and FRESCO-1051 applied: no quantity is invented. The row is
-- added with the unit `al gusto` and quantity 0, the form the closed unit list and the
-- database check on the column already accept for an ingredient whose amount the recipe
-- does not state. A real amount per recipe is the owner's call and can replace the row later.
--
-- By rule and not by id, so inactive duplicates and rows added since the audit are covered. The audit
-- counted 10 rows in half of the catalogue; the whole catalogue has 20 (19 active). Idempotent: a
-- recipe that already has a "caldo" row is skipped, so a second run changes nothing.

update public.recipes
set ingredientes_cantidades = coalesce(ingredientes_cantidades, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('nombre', 'caldo de verduras', 'unidad', 'al gusto', 'cantidad', 0))
where ingredientes_cantidades is not null
  and jsonb_typeof(ingredientes_cantidades) = 'array'
  and ingredientes_principales ? 'caldo de verduras'
  and not exists (
    select 1
    from jsonb_array_elements(ingredientes_cantidades) as q
    where public.recipe_tag_norm(q ->> 'nombre') ~ '\mcaldo\M'
  );
