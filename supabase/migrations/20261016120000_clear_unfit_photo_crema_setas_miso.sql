-- FRESCO-973 (UX-24): the photo of "Crema de setas con miso" is a dark shot of
-- a person eating cereal with a text T-shirt in frame, not a mushroom soup.
-- Clear it so the recipe shows the designed placeholder until the catalog
-- photo backfill (FRESCO-192) assigns a fitting one.
update public.recipes
set foto_url = null
where id = '7bdcfdac-ae56-46fc-8293-234b37cfe734'
  and foto_url like 'https://images.unsplash.com/photo-1709451148221-44474af7373a%';
