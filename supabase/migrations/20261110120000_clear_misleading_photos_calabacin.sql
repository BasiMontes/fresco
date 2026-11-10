-- FRESCO-1175 (UX audit U5): two catalog photos do not show their dish.
-- "Calabacín salteado con albahaca y jengibre" (vegetarian and vegan) shows what
-- looks like glazed meat with rice, and no courgette; "Sopa de calabacín y menta"
-- shows a raw courgette on a white background, not a soup. A vegan reader who sees
-- meat on a "vegan" recipe stops trusting the labels, so clear both: the recipe
-- shows the designed placeholder until a fitting photo is assigned (FRESCO-1132).
-- Same shape as 20261016120000 (FRESCO-973): guarded by id AND photo prefix, so it
-- never clears a photo that was replaced in the meantime.
update public.recipes
set foto_url = null
where id = '0009c6fb-9a7c-4845-bf9a-b3eb90e35054'
  and foto_url like 'https://images.unsplash.com/photo-1561583953-29d04b8cf5ee%';

update public.recipes
set foto_url = null
where id = '44c43290-030b-450d-8c9e-5e7bf30b8c73'
  and foto_url like 'https://images.unsplash.com/photo-1583118208563-1654aa5caa31%';
