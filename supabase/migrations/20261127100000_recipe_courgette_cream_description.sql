-- FRESCO-1323 (owner approved the text on 2026-11-27): the cream with fresh cheese, renamed in FRESCO-1317, still
-- said "Crema de calabacin con especias.": no accent, and no spice among its ingredients. Fires only while the row
-- still holds the old description.

update public.recipes
set descripcion_corta = 'Crema suave de calabacín y puerro con queso fresco.'
where id = '154f8b38-3815-4f7a-a765-8af1ee20d774' and descripcion_corta = 'Crema de calabacin con especias.';
