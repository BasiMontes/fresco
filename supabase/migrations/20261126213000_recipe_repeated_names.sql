-- FRESCO-1317 / QAFRESCO-3 (owner approved the table, 2026-11-26): 14 names had two
-- active recipes each.
--
--   * same allergens and the same dish: one twin is deactivated (`activo = false`,
--     reversible). Only twins that sit in no menu and no favourites list are chosen;
--   * different allergens or ingredients: one twin takes a name that tells them apart,
--     so nobody loses the option with fewer allergens.
--
-- Slugs are left as they are so existing links keep working. Each update only fires while
-- the row still holds its old name, so it is idempotent and never overwrites a later edit.

-- Bacalao a la vizcaína (deactivate)
update public.recipes
set activo = false
where id = '42be95eb-43fc-4806-89dd-f1dc7f96911d' and nombre = 'Bacalao a la vizcaína' and activo;

-- Crema de calabacín (deactivate)
update public.recipes
set activo = false
where id = 'c7a29db6-8779-4c73-9f76-f5d2b4673167' and nombre = 'Crema de calabacín' and activo;

-- Fajitas de pollo (deactivate)
update public.recipes
set activo = false
where id = '0a48c32b-cc2b-4e28-b002-2d53b690332c' and nombre = 'Fajitas de pollo' and activo;

-- Marmitako de bonito (deactivate)
update public.recipes
set activo = false
where id = '9346179e-61a4-4a1c-be0d-fe9d92557c73' and nombre = 'Marmitako de bonito' and activo;

-- Pad thai de gambas -> Pad thai de gambas sencillo
update public.recipes
set nombre = 'Pad thai de gambas sencillo'
where id = '64d0fc21-7a36-4e3e-92ce-e83ce876b9aa' and nombre = 'Pad thai de gambas' and activo;

-- Cocido madrileño -> Cocido madrileño sencillo
update public.recipes
set nombre = 'Cocido madrileño sencillo'
where id = '61e1c72f-e113-4762-b7c4-85e8ccbf1aaf' and nombre = 'Cocido madrileño' and activo;

-- Fabada asturiana -> Fabada asturiana sencilla
update public.recipes
set nombre = 'Fabada asturiana sencilla'
where id = '10fc742a-be10-4554-b0b8-c1747fbecbaa' and nombre = 'Fabada asturiana' and activo;

-- Ensalada César con pollo -> Ensalada César con pollo sin picatostes
update public.recipes
set nombre = 'Ensalada César con pollo sin picatostes'
where id = 'dfaf7133-ae1c-4730-b106-37a41142a061' and nombre = 'Ensalada César con pollo' and activo;

-- Rabo de toro estofado -> Rabo de toro estofado al vino tinto
update public.recipes
set nombre = 'Rabo de toro estofado al vino tinto'
where id = 'b0807ee8-b806-495b-bcfe-c8c8fec6b635' and nombre = 'Rabo de toro estofado' and activo;

-- Sopa de fideos con pollo -> Sopa de fideos con pollo sencilla
update public.recipes
set nombre = 'Sopa de fideos con pollo sencilla'
where id = '48df1b94-a90d-45cc-96b9-a1eebc3ece20' and nombre = 'Sopa de fideos con pollo' and activo;

-- Poke bowl de salmón -> Poke bowl de salmón con sésamo
update public.recipes
set nombre = 'Poke bowl de salmón con sésamo'
where id = '2285488c-2365-4299-a0ee-575d57b4a286' and nombre = 'Poke bowl de salmón' and activo;

-- Porridge de avena con manzana -> Porridge de avena con manzana y nueces
update public.recipes
set nombre = 'Porridge de avena con manzana y nueces'
where id = '6526abcd-ed04-4be6-885d-26d05c56184c' and nombre = 'Porridge de avena con manzana' and activo;

-- Ensalada de garbanzos con atún -> Ensalada de garbanzos con atún y pimiento rojo
update public.recipes
set nombre = 'Ensalada de garbanzos con atún y pimiento rojo'
where id = '5ed45a0d-4482-4c39-9107-172b5d0f8b60' and nombre = 'Ensalada de garbanzos con atún' and activo;

-- Lasaña de verduras -> Lasaña de calabacín con bechamel
update public.recipes
set nombre = 'Lasaña de calabacín con bechamel'
where id = '9ce085d6-c1ef-44ce-b983-df9b41d342d4' and nombre = 'Lasaña de verduras' and activo;
