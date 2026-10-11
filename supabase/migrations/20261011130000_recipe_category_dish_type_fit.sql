-- FRESCO-881: the category and the dish type (`clasificacion.categoria` / `tipo_plato`) of the
-- families the product owner reviewed on 2026-10-11 now fit each other. FRESCO-861 put every
-- category inside the contract; this decides the ones that were in it but did not fit. A recipe
-- only has ONE `tipo_plato`, so moving one off desayuno means picking where it goes: savory
-- vegetable sautés -> cena, cold salads -> comida (this balances the slots).
--
-- Only `clasificacion` changes: names, slugs, ingredients and steps are untouched, no recipe is
-- deactivated, and no recipe that is in a menu changes its `tipo_plato` (those changed here are in
-- none). Each update fires only while the row still holds the old value, so it is idempotent and
-- never overwrites a later edit.

-- Sauteed vegetables tagged desayuno -> cena (savory sides; "Boniato asado con canela y nueces" stays: it is sweet and is in 13 menus) (20)
update public.recipes
set clasificacion = jsonb_set(clasificacion, '{tipo_plato}', '"cena"')
where id in (
  '0d7e223b-500d-4560-b55b-af88d378cf3d', -- Calabacín salteado con albahaca
  '0009c6fb-9a7c-4845-bf9a-b3eb90e35054', -- Calabacín salteado con albahaca y jengibre
  '5d40755c-4aec-4f1b-8f99-e23d32e9815e', -- Calabacín salteado con albahaca y lima
  '4a39ab0b-e5ff-4773-9ace-69289bf9f560', -- Calabacín salteado con albahaca y limón
  '1bdfb9eb-0e1b-4b70-8483-fe89853ed51c', -- Champiñones portobello a la plancha con jengibre
  'affca230-07cf-4c10-9a9e-882efb550492', -- Champiñones portobello a la plancha con lima y cilantro
  'd9363395-e8aa-4ee2-ab14-9012704c178b', -- Champiñones portobello a la plancha con limón
  'd98f8ca1-b442-4d07-bc8a-a773be3cbdeb', -- Champiñones portobello a la plancha con semillas de lino
  '420437ef-c257-4a23-a217-57d01fa04020', -- Champiñones salteados con tamari y jengibre
  '683fe562-40ab-4d26-94fb-d9d4a08f1ea5', -- Champiñones salteados con tamari, jengibre y limón
  '00c51007-6447-41db-891b-f0530232be02', -- Champiñones salteados con tamari, jengibre y semillas de lino
  '9f6f669d-4550-4a46-b45a-7d6e4843f111', -- Champiñones salteados con tamari, jengibre, lima y cilantro
  '4b13895c-08e8-409a-b637-ca9832b4975e', -- Espinacas salteadas con levadura nutricional y jengibre
  '26a83a60-af70-4689-b0a7-d50a6a2df5e0', -- Espinacas salteadas con levadura nutricional y limón
  '97ff13a3-7c79-4f39-a7c4-7275e1c63c8a', -- Espinacas salteadas con levadura nutricional y semillas de lino
  '7a074777-8a76-467c-b8d2-9e4c22f41184', -- Espinacas salteadas con levadura nutricional, lima y cilantro
  '5b1dec89-8e98-4508-9908-3e8a2d044368', -- Kale salteado con semillas de calabaza y jengibre
  '333b653b-3fa2-4f2c-879e-99151736b0cc', -- Kale salteado con semillas de calabaza y limón
  'e6a3c908-ac83-481d-b7fd-0e9380e34475', -- Kale salteado con semillas de calabaza y semillas de lino
  '98e43d5a-a4d2-4270-bdba-70db8669b4c3' -- Kale salteado con semillas de calabaza, lima y cilantro
) and clasificacion ->> 'tipo_plato' = 'desayuno';

-- Tofu and tempeh dishes filed as huevos -> legumbres (soy is a legume). The 8 scrambles (Revuelto de cúrcuma, Tofu revuelto estilo mexicano) stay huevos (21)
update public.recipes
set clasificacion = jsonb_set(clasificacion, '{categoria}', '"legumbres"')
where id in (
  'ebf63253-21cf-4951-8dd3-8a0bda28b6e4', -- Tempeh a la plancha con ajo y jengibre
  '5ae688be-5d8a-4a10-a41e-afc237ba8202', -- Tempeh a la plancha con ajo y limón
  '850da934-205a-430f-adae-c8b5379e07ee', -- Tempeh a la plancha con ajo y semillas de lino
  'a06aa046-abbf-4206-a6cc-2a892b38c117', -- Tempeh a la plancha con ajo, lima y cilantro
  '5f7de91c-a542-4ed8-bc89-e63fe08b235f', -- Tempeh al horno con jengibre y ajo asado
  '3857b513-f046-409f-a6db-13caa9d3926a', -- Tempeh al horno con jengibre y cilantro
  'b307377c-b784-4d33-a687-4d8c1cd8d750', -- Tempeh al horno con jengibre y limón
  '3899f83d-ff15-4089-bbfe-f1e41cd0a961', -- Tempeh al horno con jengibre y semillas de lino
  '400336ac-0ebc-4083-b4ed-2dd67f4e103a', -- Tofu a la plancha con limón
  'be744eb9-2482-4633-8daf-03d4146f952a', -- Tofu a la plancha con limón y ajo asado
  '13d46431-2b5f-4079-b9f6-e035454e8e2c', -- Tofu a la plancha con limón y cilantro
  '24de7d2b-a883-4205-877b-9c9d4d9c2b4d', -- Tofu a la plancha con limón y semillas de lino
  '2a1417bd-4cf8-49c8-8ad8-9e33253cee4d', -- Tofu a la plancha con tamari y jengibre
  'b7112b35-9539-435a-932c-5fc827b4e9d7', -- Tofu a la plancha con tamari y limón
  'dd3875da-bd2a-4c9e-a0c9-457a52ad05c1', -- Tofu a la plancha con tamari y semillas de lino
  'd2786d2c-1295-4fca-8d1e-58143c568349', -- Tofu a la plancha con tamari, lima y cilantro
  '7af63170-779f-4204-ae41-7771e2823875', -- Tofu al horno con limón picante
  'a2d5ed3b-5e4b-4e28-9775-54c14a123395', -- Tofu al horno con limón y aceitunas
  'fe42a272-33da-4de9-91c1-dc0a223c5aa4', -- Tofu al horno con limón y cilantro fresco
  '454e548a-c47f-429e-8eaa-4fffb2761aa6', -- Tofu al horno con limón y lima
  '07f67686-25ab-433c-81a2-16792220572b' -- Tofu al horno con limón y semillas de calabaza
) and clasificacion ->> 'categoria' = 'huevos';

-- Sweet batters filed as sandwich -> reposteria. "Arepa rellena de queso" stays sandwich (savory, filled) (5)
update public.recipes
set clasificacion = jsonb_set(clasificacion, '{categoria}', '"reposteria"')
where id in (
  '21a7e935-b70c-4c14-b9a7-ebbc6b2d5987', -- Bizcocho casero de yogur
  'c3d5e272-089a-44ac-98fe-7c7984607931', -- Creps de avena y plátano
  'f51574b7-f91c-496d-a8a2-00127f5a84fa', -- Panqueques integrales con miel
  '43c0571e-7383-4818-b1be-d4af03ea0634', -- Torrijas caseras
  '0ba06e16-f2e3-426a-91ec-c8d43781e574' -- Tortitas de avena y plátano
) and clasificacion ->> 'categoria' = 'sandwich';

-- Cold salads tagged desayuno -> comida (category ensalada unchanged) (8)
update public.recipes
set clasificacion = jsonb_set(clasificacion, '{tipo_plato}', '"comida"')
where id in (
  '69449f5c-54f0-4e47-b438-c77430378bd1', -- Aguacate relleno de cilantro y lima con jengibre
  '7ca0b098-9d1f-4cb8-9d55-b9990ec7ee61', -- Aguacate relleno de cilantro y lima con lima y cilantro
  '0db159e2-eb6b-4d48-812d-98a2467f366e', -- Aguacate relleno de cilantro y lima con limón
  '0ff0d4ae-d81b-4611-b0b1-35caaf13ee17', -- Aguacate relleno de cilantro y lima con semillas de lino
  '6af77875-467c-4c5a-8ca4-2a24668fb6cd', -- Rúcula con semillas de girasol y jengibre
  '9779b23b-7357-4cf5-834a-589f3c55d2b3', -- Rúcula con semillas de girasol y limón
  '7b4c20ca-233f-444e-85bd-2509ed063bb5', -- Rúcula con semillas de girasol y semillas de lino
  'a79d612f-edea-4196-a71a-d424ab0938b1' -- Rúcula con semillas de girasol, lima y cilantro
) and clasificacion ->> 'tipo_plato' = 'desayuno';

-- Poke bowls filed as pescado -> bowls, like the other 36 bowls (2)
update public.recipes
set clasificacion = jsonb_set(clasificacion, '{categoria}', '"bowls"')
where id in (
  '835c9ed0-feb4-47d1-b596-df4208687f08', -- Poke bowl de atún
  '2c699c8c-4f3c-4529-b29c-ef413756a5be' -- Poke bowl de salmón
) and clasificacion ->> 'categoria' = 'pescado';

-- Open toasts filed as sandwich -> tostadas (11)
update public.recipes
set clasificacion = jsonb_set(clasificacion, '{categoria}', '"tostadas"')
where id in (
  '0ad788cf-f20d-4c09-90b2-5f0c02c77a86', -- Aguacate machacado sobre tostada
  'cb94293c-7f5f-4643-a265-f170e963cef9', -- Pan con tomate y jamón ibérico
  'faf20ecf-99c3-402a-94aa-92caf3ca0e42', -- Tostada con crema de cacahuete
  '9b0b28d2-2e2d-4fdd-a97d-67499b71d3c4', -- Tostada con hummus y pepino
  '4e7bae4c-2bd2-4d5c-989b-7be127aaad07', -- Tostada con queso fresco y tomate
  '9f8e4eed-a111-4ec0-aeca-aa4f0ee29517', -- Tostada con tomate y jamón serrano
  '43a43297-6d8c-4225-9fc1-ad69feea0dc3', -- Tostada de aguacate con huevo poché
  'fc9e03fa-153d-421c-a93a-6eb6ff3aab3f', -- Tostada de centeno con salmón
  'cc317512-89e9-4a7b-90d9-12b84b48a3bc', -- Tostada de pavo y aguacate
  'f6ae0b9d-0630-466c-9caa-e2b399bfd3a8', -- Tostada integral con tomates cherry
  'f3e22b27-bc3f-4700-89f3-e706d4ded340' -- Tostas de salmón ahumado y aguacate
) and clasificacion ->> 'categoria' = 'sandwich';

-- Wraps filed as sandwich -> wrap (2)
update public.recipes
set clasificacion = jsonb_set(clasificacion, '{categoria}', '"wrap"')
where id in (
  '11134e58-9323-4642-b025-10a4995df275', -- Wrap de huevo revuelto y verduras
  'b9af8080-9c84-42e3-b9a9-ded9935163cd' -- Wrap de pollo y verduras
) and clasificacion ->> 'categoria' = 'sandwich';
