-- FRESCO-880 (family 1 of 4): recipe titles that name a condiment their recipe never uses.
--
-- 42 active recipes end in "con canela", "con miel", "y frutos rojos"... but neither the
-- ingredient list nor the steps mention it. The generator stamped a variant label on a
-- base dish: ingredients and steps are identical across the variants (three "Huevos
-- revueltos" with the same two ingredients and the same four steps). Adding the
-- condiment would be absurd (and honey breaks the vegan label); renaming them all
-- would leave several identical recipes under one name. So, per base dish:
--
--   * the base name is already taken by an active recipe (three toasts, the yogurt with
--     granola): every labelled copy is deactivated;
--   * otherwise ONE recipe keeps the dish and takes the base name (the one that is
--     already in users' menus, if any) and the identical copies are deactivated.
--
-- Deactivating is the FRESCO-460 mechanism (`activo = false`, reversible): the recipe
-- stops being offered by get_filtered_recipes() (menu generation, catalog, detail). A
-- recipe that is in a menu or in favorites is NEVER deactivated, because its detail page
-- would stop resolving: the two used "Batido verde" recipes are both kept, the second one
-- renamed "Batido verde con plátano" (the ingredient that actually defines the list).
-- Descriptions that repeated the condiment are cleaned the same way. Slugs are left as
-- they are so existing links keep working.
--
-- Each update only fires while the row still holds its old name (and description), so it
-- is idempotent and never overwrites a later edit.

-- Tostada con jamón serrano
update public.recipes
set descripcion_corta = 'Tostada con jamon serrano.'
where id = 'a3937eed-03b5-465c-b478-4c27b3234b79' and nombre = 'Tostada con jamón serrano' and activo and descripcion_corta = 'Tostada con jamon serrano y frutos rojos.';

-- Batido verde con canela -> Batido verde
update public.recipes
set nombre = 'Batido verde'
where id = 'd67259a9-89a5-4aaa-95dc-a5e3f68806a8' and nombre = 'Batido verde con canela' and activo;

-- Batido verde con frutos rojos -> Batido verde con plátano
update public.recipes
set nombre = 'Batido verde con plátano', descripcion_corta = 'Batido verde con plátano.'
where id = '71bd98eb-8f99-4cb9-996e-622471e0e694' and nombre = 'Batido verde con frutos rojos' and activo and descripcion_corta = 'Batido verde al estilo mediterraneo.';

-- Batido verde canela (deactivate)
update public.recipes
set activo = false
where id = 'd806c307-1c2f-4c4a-b30c-cf15ce75c256' and nombre = 'Batido verde canela' and activo;

-- Batido verde con miel (deactivate)
update public.recipes
set activo = false
where id = 'a8edf55f-21da-4269-a3d6-a248d6d4e50c' and nombre = 'Batido verde con miel' and activo;

-- Batido verde frutos rojos (deactivate)
update public.recipes
set activo = false
where id = '92598a37-b83f-4c22-921a-2d71c797125d' and nombre = 'Batido verde frutos rojos' and activo;

-- Batido verde miel (deactivate)
update public.recipes
set activo = false
where id = 'f87aa7ce-aa3e-45ff-b6a9-f152404e61a0' and nombre = 'Batido verde miel' and activo;

-- Batido verde especias con canela -> Batido verde especias
update public.recipes
set nombre = 'Batido verde especias'
where id = '2a51365a-b2b9-4e5f-b9d2-34b1975f1214' and nombre = 'Batido verde especias con canela' and activo;

-- Batido verde especias con frutos rojos (deactivate)
update public.recipes
set activo = false
where id = '91984eef-3d3d-417f-b66a-6fb7071f0c6d' and nombre = 'Batido verde especias con frutos rojos' and activo;

-- Batido verde especias con miel (deactivate)
update public.recipes
set activo = false
where id = 'a1c82037-d5e4-4b46-bd68-159161ae7110' and nombre = 'Batido verde especias con miel' and activo;

-- Batido verde hierbas frescas con canela -> Batido verde hierbas frescas
update public.recipes
set nombre = 'Batido verde hierbas frescas'
where id = '36c10971-04b6-4cb4-8e25-991a4a862d73' and nombre = 'Batido verde hierbas frescas con canela' and activo;

-- Batido verde hierbas frescas con miel (deactivate)
update public.recipes
set activo = false
where id = '8874ab7d-d442-424a-8e71-c24b5dbd499e' and nombre = 'Batido verde hierbas frescas con miel' and activo;

-- Bowl de avena con canela -> Bowl de avena
update public.recipes
set nombre = 'Bowl de avena', descripcion_corta = 'Bowl de avena.'
where id = '7c2055e5-e95f-40f5-8d8f-cfa26502807a' and nombre = 'Bowl de avena con canela' and activo and descripcion_corta = 'Bowl de avena con canela.';

-- Bowl de avena con frutos rojos (deactivate)
update public.recipes
set activo = false
where id = '24580167-c54c-4d98-9ba0-9d8c7bb2b505' and nombre = 'Bowl de avena con frutos rojos' and activo;

-- Bowl de avena con miel (deactivate)
update public.recipes
set activo = false
where id = '13c653e5-ff32-4413-a93d-ac8f14965403' and nombre = 'Bowl de avena con miel' and activo;

-- Gofres con canela -> Gofres
update public.recipes
set nombre = 'Gofres'
where id = '8773e3b5-835d-462e-9316-75a8a69a2485' and nombre = 'Gofres con canela' and activo;

-- Gofres con miel (deactivate)
update public.recipes
set activo = false
where id = 'c96f67b7-6ff4-459d-819e-0d6131fd2a12' and nombre = 'Gofres con miel' and activo;

-- Huevos poche con canela -> Huevos poche
update public.recipes
set nombre = 'Huevos poche'
where id = '51b03003-63f2-419d-9b7e-f789776eaa9e' and nombre = 'Huevos poche con canela' and activo;

-- Huevos poche con frutos rojos (deactivate)
update public.recipes
set activo = false
where id = '77a2c72f-21c6-4e8c-811f-6171816c5c55' and nombre = 'Huevos poche con frutos rojos' and activo;

-- Huevos poche con miel (deactivate)
update public.recipes
set activo = false
where id = '185e0a79-5fdc-4e2c-87a1-7e35211cfaf2' and nombre = 'Huevos poche con miel' and activo;

-- Huevos revueltos con canela -> Huevos revueltos
update public.recipes
set nombre = 'Huevos revueltos'
where id = '0723583b-e23b-4368-aed2-1627a3518f75' and nombre = 'Huevos revueltos con canela' and activo;

-- Huevos revueltos con frutos rojos (deactivate)
update public.recipes
set activo = false
where id = '619f1cb0-3173-4a8a-8ab2-3955588d55fd' and nombre = 'Huevos revueltos con frutos rojos' and activo;

-- Huevos revueltos con miel (deactivate)
update public.recipes
set activo = false
where id = '917c355c-c58f-41f9-941d-00c87121b8c5' and nombre = 'Huevos revueltos con miel' and activo;

-- Muesli con leche y canela -> Muesli con leche
update public.recipes
set nombre = 'Muesli con leche'
where id = '0aff1ed8-54c1-4def-a56f-c60f84ae5e50' and nombre = 'Muesli con leche y canela' and activo;

-- Muesli con leche y miel (deactivate)
update public.recipes
set activo = false
where id = '8b4e534c-420d-4286-bfb2-b368cb0defd7' and nombre = 'Muesli con leche y miel' and activo;

-- Porridge de avena con canela -> Porridge de avena
update public.recipes
set nombre = 'Porridge de avena'
where id = '00bbcdcd-64ff-411b-9423-b0f476ec683c' and nombre = 'Porridge de avena con canela' and activo;

-- Porridge de avena con frutos rojos (deactivate)
update public.recipes
set activo = false
where id = '6bce2ea0-ffaa-46eb-a81f-3694805863f2' and nombre = 'Porridge de avena con frutos rojos' and activo;

-- Tortilla francesa con canela -> Tortilla francesa
update public.recipes
set nombre = 'Tortilla francesa'
where id = '4d025c8f-d783-44be-b4e7-06451aaa8a20' and nombre = 'Tortilla francesa con canela' and activo;

-- Tortilla francesa con frutos rojos (deactivate)
update public.recipes
set activo = false
where id = '8b78adbe-d290-433a-a338-9c3ac30b2482' and nombre = 'Tortilla francesa con frutos rojos' and activo;

-- Tortilla francesa con miel (deactivate)
update public.recipes
set activo = false
where id = '163ae5e4-fafc-4b4a-86f1-fbcd802a56e4' and nombre = 'Tortilla francesa con miel' and activo;

-- Tortitas con canela -> Tortitas
update public.recipes
set nombre = 'Tortitas'
where id = '281acba9-3a7e-4d31-99bc-d0d609ca66ad' and nombre = 'Tortitas con canela' and activo;

-- Tortitas con frutos rojos (deactivate)
update public.recipes
set activo = false
where id = '36f63713-d81e-434d-b703-38fa424eb421' and nombre = 'Tortitas con frutos rojos' and activo;

-- Tostada con jamón serrano y canela (deactivate)
update public.recipes
set activo = false
where id = 'b3f6fc5a-d740-4f89-a080-a4c8ec60c36d' and nombre = 'Tostada con jamón serrano y canela' and activo;

-- Tostada con jamón serrano y miel (deactivate)
update public.recipes
set activo = false
where id = '6ccb3074-cb74-4497-88c6-bb0b24f9164b' and nombre = 'Tostada con jamón serrano y miel' and activo;

-- Tostada con queso fresco y canela (deactivate)
update public.recipes
set activo = false
where id = 'e88e1c25-ffdd-4818-912c-d0c69d8ab43d' and nombre = 'Tostada con queso fresco y canela' and activo;

-- Tostada con queso fresco y miel (deactivate)
update public.recipes
set activo = false
where id = '8e2597e9-8a4d-42cf-aae6-10d06d966b46' and nombre = 'Tostada con queso fresco y miel' and activo;

-- Tostada con salmón ahumado y canela (deactivate)
update public.recipes
set activo = false
where id = 'e32f501e-a320-4673-8a63-a53ccec546e7' and nombre = 'Tostada con salmón ahumado y canela' and activo;

-- Tostada con salmón ahumado y miel (deactivate)
update public.recipes
set activo = false
where id = 'aa8182f3-cadb-45a0-8e9f-dfb68716dfc4' and nombre = 'Tostada con salmón ahumado y miel' and activo;

-- Tostada de aguacate con frutos rojos -> Tostada de aguacate
update public.recipes
set nombre = 'Tostada de aguacate'
where id = '372c277d-44df-4405-b2c6-99d9a9fae88c' and nombre = 'Tostada de aguacate con frutos rojos' and activo;

-- Tostada de aguacate con canela (deactivate)
update public.recipes
set activo = false
where id = 'a5660898-cb0a-4bfa-9426-0efde026dba8' and nombre = 'Tostada de aguacate con canela' and activo;

-- Tostada de aguacate con miel (deactivate)
update public.recipes
set activo = false
where id = '5b3979a9-7145-472f-8767-ddf3d3f25b34' and nombre = 'Tostada de aguacate con miel' and activo;

-- Yogur griego con granola y canela (deactivate)
update public.recipes
set activo = false
where id = '1ba5c75c-f2a0-4a73-a66e-a3e61d03e396' and nombre = 'Yogur griego con granola y canela' and activo;

-- Yogur griego con granola y miel (deactivate)
update public.recipes
set activo = false
where id = '6ba3e9f2-2f84-4f66-81c6-abf992d20a5e' and nombre = 'Yogur griego con granola y miel' and activo;

