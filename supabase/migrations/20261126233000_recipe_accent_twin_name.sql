-- FRESCO-1317 / QAFRESCO-3 (retest, owner approved the name on 2026-11-26): two active recipes
-- differed only by an accent, "Crema de calabacin" and "Crema de calabacín". They are different
-- dishes, so the one with fresh cheese takes a name that tells them apart. The slug is left as it
-- is so existing links keep working. Fires only while the row still holds its old name.

update public.recipes
set nombre = 'Crema de calabacín con queso fresco'
where id = '154f8b38-3815-4f7a-a765-8af1ee20d774' and nombre = 'Crema de calabacin' and activo;
