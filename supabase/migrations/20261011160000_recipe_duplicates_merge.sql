-- FRESCO-898: 30 groups of active recipes (62 recipes) share exactly the same ingredient list and
-- the same steps; 23 of them are named "... con verduras salteadas" without having those vegetables.
-- They are one dish under several names. Per group the recipe with the shortest name is kept, the
-- others are folded into it:
--   1. a photo the keeper lacks is copied from a duplicate,
--   2. favorites move to the keeper (a user who already favourited the keeper just loses the extra row),
--   3. menu slots (`meal_plan_recipes.recipe_id`) move to the keeper. Checked on 2026-10-11: 9 slots, all of
--      two test accounts, all `pendiente`, no rating, no ingredient substitution, no favorites, so no
--      learning history is lost. `estado` does not change, so the learning trigger does not fire,
--   4. the duplicates are deactivated (`activo = false`, the FRESCO-460 reversible mechanism), only while
--      no menu slot or favorite still points at them.
-- `app.mpr_trusted_write` lets the integrity trigger of `meal_plan_recipes` accept the `recipe_id` change.
-- Counters on the duplicates (veces_cocinada, veces_descartada, veces_calificada) sum to 4.

select set_config('app.mpr_trusted_write', 'on', true);

-- Alubias con verduras <- Alubias con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('117b1cd1-de6e-4af0-b645-fd138e4db4ed') and k.recipe_id = 'd2ce987f-8180-490b-b74f-49ff4d5e4bd1' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'd2ce987f-8180-490b-b74f-49ff4d5e4bd1' where recipe_id in ('117b1cd1-de6e-4af0-b645-fd138e4db4ed');
update public.meal_plan_recipes set recipe_id = 'd2ce987f-8180-490b-b74f-49ff4d5e4bd1' where recipe_id in ('117b1cd1-de6e-4af0-b645-fd138e4db4ed');
update public.recipes set activo = false
where id in ('117b1cd1-de6e-4af0-b645-fd138e4db4ed') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Arroz con verduras <- Arroz con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('8b16e86b-3386-4f2b-a6a6-1907d00e1add') and k.recipe_id = '0575a462-058d-43cf-9674-f8f193b3f26c' and k.user_id = f.user_id;
update public.favorites set recipe_id = '0575a462-058d-43cf-9674-f8f193b3f26c' where recipe_id in ('8b16e86b-3386-4f2b-a6a6-1907d00e1add');
update public.meal_plan_recipes set recipe_id = '0575a462-058d-43cf-9674-f8f193b3f26c' where recipe_id in ('8b16e86b-3386-4f2b-a6a6-1907d00e1add');
update public.recipes set activo = false
where id in ('8b16e86b-3386-4f2b-a6a6-1907d00e1add') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Arroz con pollo <- Arroz con pollo y verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('789f0acb-19bc-45a3-a7e2-ad2175751484') and k.recipe_id = '1c049616-1e03-4883-8f68-d360ce4b4617' and k.user_id = f.user_id;
update public.favorites set recipe_id = '1c049616-1e03-4883-8f68-d360ce4b4617' where recipe_id in ('789f0acb-19bc-45a3-a7e2-ad2175751484');
update public.meal_plan_recipes set recipe_id = '1c049616-1e03-4883-8f68-d360ce4b4617' where recipe_id in ('789f0acb-19bc-45a3-a7e2-ad2175751484');
update public.recipes set activo = false
where id in ('789f0acb-19bc-45a3-a7e2-ad2175751484') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Ensalada de atun <- Ensalada de atun con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('69959319-9a45-4a27-97ee-4686f684c86b') and k.recipe_id = '9552b2cb-4ad2-4d53-ac42-df40a76b1012' and k.user_id = f.user_id;
update public.favorites set recipe_id = '9552b2cb-4ad2-4d53-ac42-df40a76b1012' where recipe_id in ('69959319-9a45-4a27-97ee-4686f684c86b');
update public.meal_plan_recipes set recipe_id = '9552b2cb-4ad2-4d53-ac42-df40a76b1012' where recipe_id in ('69959319-9a45-4a27-97ee-4686f684c86b');
update public.recipes set activo = false
where id in ('69959319-9a45-4a27-97ee-4686f684c86b') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Porridge de avena <- Porridge de avena con miel
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('3f6253e5-4dda-4ba7-8d31-e833fdebb348') and k.recipe_id = '00bbcdcd-64ff-411b-9423-b0f476ec683c' and k.user_id = f.user_id;
update public.favorites set recipe_id = '00bbcdcd-64ff-411b-9423-b0f476ec683c' where recipe_id in ('3f6253e5-4dda-4ba7-8d31-e833fdebb348');
update public.meal_plan_recipes set recipe_id = '00bbcdcd-64ff-411b-9423-b0f476ec683c' where recipe_id in ('3f6253e5-4dda-4ba7-8d31-e833fdebb348');
update public.recipes set activo = false
where id in ('3f6253e5-4dda-4ba7-8d31-e833fdebb348') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Bacalao con tomate <- Bacalao con tomate y verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('8b26cfd4-b23d-493a-9487-97d970b60b84') and k.recipe_id = 'e994c27d-225a-4ef5-b4fe-886236d26e8d' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'e994c27d-225a-4ef5-b4fe-886236d26e8d' where recipe_id in ('8b26cfd4-b23d-493a-9487-97d970b60b84');
update public.meal_plan_recipes set recipe_id = 'e994c27d-225a-4ef5-b4fe-886236d26e8d' where recipe_id in ('8b26cfd4-b23d-493a-9487-97d970b60b84');
update public.recipes set activo = false
where id in ('8b26cfd4-b23d-493a-9487-97d970b60b84') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Conejo al ajillo <- Conejo al ajillo con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('0172d769-4c63-4b51-8a2d-ebf252883be4') and k.recipe_id = 'c01e6490-af49-4d67-991c-046281998196' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'c01e6490-af49-4d67-991c-046281998196' where recipe_id in ('0172d769-4c63-4b51-8a2d-ebf252883be4');
update public.meal_plan_recipes set recipe_id = 'c01e6490-af49-4d67-991c-046281998196' where recipe_id in ('0172d769-4c63-4b51-8a2d-ebf252883be4');
update public.recipes set activo = false
where id in ('0172d769-4c63-4b51-8a2d-ebf252883be4') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Cordero al horno <- Cordero al horno con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('fd853ed8-ac99-4368-9c94-d698eb787c9b') and k.recipe_id = 'a4dbbb6f-156b-4521-9002-21a227e2833c' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'a4dbbb6f-156b-4521-9002-21a227e2833c' where recipe_id in ('fd853ed8-ac99-4368-9c94-d698eb787c9b');
update public.meal_plan_recipes set recipe_id = 'a4dbbb6f-156b-4521-9002-21a227e2833c' where recipe_id in ('fd853ed8-ac99-4368-9c94-d698eb787c9b');
update public.recipes set activo = false
where id in ('fd853ed8-ac99-4368-9c94-d698eb787c9b') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Dorada al horno <- Dorada al horno con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('7e572850-d05c-49f3-95b5-f52214b85033') and k.recipe_id = '994c34bc-175e-4812-b78e-c6efb20a753b' and k.user_id = f.user_id;
update public.favorites set recipe_id = '994c34bc-175e-4812-b78e-c6efb20a753b' where recipe_id in ('7e572850-d05c-49f3-95b5-f52214b85033');
update public.meal_plan_recipes set recipe_id = '994c34bc-175e-4812-b78e-c6efb20a753b' where recipe_id in ('7e572850-d05c-49f3-95b5-f52214b85033');
update public.recipes set activo = false
where id in ('7e572850-d05c-49f3-95b5-f52214b85033') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Batido verde <- Batido verde con plátano, Batido verde especias, Batido verde hierbas frescas
update public.recipes set foto_url = 'https://images.pexels.com/photos/1346347/pexels-photo-1346347.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' where id = 'd67259a9-89a5-4aaa-95dc-a5e3f68806a8' and foto_url is null;
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('71bd98eb-8f99-4cb9-996e-622471e0e694', '2a51365a-b2b9-4e5f-b9d2-34b1975f1214', '36c10971-04b6-4cb4-8e25-991a4a862d73') and k.recipe_id = 'd67259a9-89a5-4aaa-95dc-a5e3f68806a8' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'd67259a9-89a5-4aaa-95dc-a5e3f68806a8' where recipe_id in ('71bd98eb-8f99-4cb9-996e-622471e0e694', '2a51365a-b2b9-4e5f-b9d2-34b1975f1214', '36c10971-04b6-4cb4-8e25-991a4a862d73');
update public.meal_plan_recipes set recipe_id = 'd67259a9-89a5-4aaa-95dc-a5e3f68806a8' where recipe_id in ('71bd98eb-8f99-4cb9-996e-622471e0e694', '2a51365a-b2b9-4e5f-b9d2-34b1975f1214', '36c10971-04b6-4cb4-8e25-991a4a862d73');
update public.recipes set activo = false
where id in ('71bd98eb-8f99-4cb9-996e-622471e0e694', '2a51365a-b2b9-4e5f-b9d2-34b1975f1214', '36c10971-04b6-4cb4-8e25-991a4a862d73') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Gambas al ajillo <- Gambas al ajillo con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('99b38cea-c65a-4e93-8903-1bb61aa35e6e') and k.recipe_id = 'e29fd4de-2e1c-487f-8aef-f57875dcabac' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'e29fd4de-2e1c-487f-8aef-f57875dcabac' where recipe_id in ('99b38cea-c65a-4e93-8903-1bb61aa35e6e');
update public.meal_plan_recipes set recipe_id = 'e29fd4de-2e1c-487f-8aef-f57875dcabac' where recipe_id in ('99b38cea-c65a-4e93-8903-1bb61aa35e6e');
update public.recipes set activo = false
where id in ('99b38cea-c65a-4e93-8903-1bb61aa35e6e') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Garbanzos con espinacas <- Garbanzos con espinacas y verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('2d83af7c-1270-4260-8e85-5e98c41b1f43') and k.recipe_id = '9faee65c-8b4c-448c-89b9-b9b1779a10ee' and k.user_id = f.user_id;
update public.favorites set recipe_id = '9faee65c-8b4c-448c-89b9-b9b1779a10ee' where recipe_id in ('2d83af7c-1270-4260-8e85-5e98c41b1f43');
update public.meal_plan_recipes set recipe_id = '9faee65c-8b4c-448c-89b9-b9b1779a10ee' where recipe_id in ('2d83af7c-1270-4260-8e85-5e98c41b1f43');
update public.recipes set activo = false
where id in ('2d83af7c-1270-4260-8e85-5e98c41b1f43') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Ensalada de garbanzos <- Ensalada de garbanzos con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('3faee9c6-114c-48b7-a981-2a60211bcf8e') and k.recipe_id = '960b6069-8605-4ed0-844b-a729e8705938' and k.user_id = f.user_id;
update public.favorites set recipe_id = '960b6069-8605-4ed0-844b-a729e8705938' where recipe_id in ('3faee9c6-114c-48b7-a981-2a60211bcf8e');
update public.meal_plan_recipes set recipe_id = '960b6069-8605-4ed0-844b-a729e8705938' where recipe_id in ('3faee9c6-114c-48b7-a981-2a60211bcf8e');
update public.recipes set activo = false
where id in ('3faee9c6-114c-48b7-a981-2a60211bcf8e') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Gofres <- Gofres con frutos rojos
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('591cc4fd-3782-4007-b151-ab2369cf8fb1') and k.recipe_id = '8773e3b5-835d-462e-9316-75a8a69a2485' and k.user_id = f.user_id;
update public.favorites set recipe_id = '8773e3b5-835d-462e-9316-75a8a69a2485' where recipe_id in ('591cc4fd-3782-4007-b151-ab2369cf8fb1');
update public.meal_plan_recipes set recipe_id = '8773e3b5-835d-462e-9316-75a8a69a2485' where recipe_id in ('591cc4fd-3782-4007-b151-ab2369cf8fb1');
update public.recipes set activo = false
where id in ('591cc4fd-3782-4007-b151-ab2369cf8fb1') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Muesli con leche <- Muesli con leche y frutos rojos
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('3ae2ff65-266a-4719-bf22-d2fe915a3f75') and k.recipe_id = '0aff1ed8-54c1-4def-a56f-c60f84ae5e50' and k.user_id = f.user_id;
update public.favorites set recipe_id = '0aff1ed8-54c1-4def-a56f-c60f84ae5e50' where recipe_id in ('3ae2ff65-266a-4719-bf22-d2fe915a3f75');
update public.meal_plan_recipes set recipe_id = '0aff1ed8-54c1-4def-a56f-c60f84ae5e50' where recipe_id in ('3ae2ff65-266a-4719-bf22-d2fe915a3f75');
update public.recipes set activo = false
where id in ('3ae2ff65-266a-4719-bf22-d2fe915a3f75') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Tortilla de patatas <- Tortilla de patatas con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('d80af55c-ff96-4cdf-8f6f-97eb0d27bdc4') and k.recipe_id = '1a13b69b-6593-43ed-af93-31096b76bf72' and k.user_id = f.user_id;
update public.favorites set recipe_id = '1a13b69b-6593-43ed-af93-31096b76bf72' where recipe_id in ('d80af55c-ff96-4cdf-8f6f-97eb0d27bdc4');
update public.meal_plan_recipes set recipe_id = '1a13b69b-6593-43ed-af93-31096b76bf72' where recipe_id in ('d80af55c-ff96-4cdf-8f6f-97eb0d27bdc4');
update public.recipes set activo = false
where id in ('d80af55c-ff96-4cdf-8f6f-97eb0d27bdc4') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Lentejas estofadas <- Lentejas estofadas con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('b2a8434e-1913-444d-9d9e-63ddb6541808') and k.recipe_id = '157b4863-dc9f-4b60-8ae2-cbc8d9532df8' and k.user_id = f.user_id;
update public.favorites set recipe_id = '157b4863-dc9f-4b60-8ae2-cbc8d9532df8' where recipe_id in ('b2a8434e-1913-444d-9d9e-63ddb6541808');
update public.meal_plan_recipes set recipe_id = '157b4863-dc9f-4b60-8ae2-cbc8d9532df8' where recipe_id in ('b2a8434e-1913-444d-9d9e-63ddb6541808');
update public.recipes set activo = false
where id in ('b2a8434e-1913-444d-9d9e-63ddb6541808') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Solomillo de cerdo <- Solomillo de cerdo con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('e4326af9-ed0e-4c3e-a775-113bb164448d') and k.recipe_id = 'badcd7b9-1bef-4143-ad33-b35e584a350c' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'badcd7b9-1bef-4143-ad33-b35e584a350c' where recipe_id in ('e4326af9-ed0e-4c3e-a775-113bb164448d');
update public.meal_plan_recipes set recipe_id = 'badcd7b9-1bef-4143-ad33-b35e584a350c' where recipe_id in ('e4326af9-ed0e-4c3e-a775-113bb164448d');
update public.recipes set activo = false
where id in ('e4326af9-ed0e-4c3e-a775-113bb164448d') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Mejillones al vapor <- Mejillones al vapor con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('0a10e16e-6714-40ac-a2b9-f076465f7319') and k.recipe_id = 'a8cc4e66-e1db-439b-9178-feb0c97943ad' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'a8cc4e66-e1db-439b-9178-feb0c97943ad' where recipe_id in ('0a10e16e-6714-40ac-a2b9-f076465f7319');
update public.meal_plan_recipes set recipe_id = 'a8cc4e66-e1db-439b-9178-feb0c97943ad' where recipe_id in ('0a10e16e-6714-40ac-a2b9-f076465f7319');
update public.recipes set activo = false
where id in ('0a10e16e-6714-40ac-a2b9-f076465f7319') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Pasta con setas <- Pasta con setas y verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('2a1bca79-d042-46fc-a141-cac4945165f2') and k.recipe_id = '0a047b8d-9240-455e-bf1f-56424b10cb71' and k.user_id = f.user_id;
update public.favorites set recipe_id = '0a047b8d-9240-455e-bf1f-56424b10cb71' where recipe_id in ('2a1bca79-d042-46fc-a141-cac4945165f2');
update public.meal_plan_recipes set recipe_id = '0a047b8d-9240-455e-bf1f-56424b10cb71' where recipe_id in ('2a1bca79-d042-46fc-a141-cac4945165f2');
update public.recipes set activo = false
where id in ('2a1bca79-d042-46fc-a141-cac4945165f2') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Pasta con tomate <- Pasta con tomate y verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('bc4b8410-ea20-461f-b51e-5a69679afff3') and k.recipe_id = 'cf42bf0c-e8f4-4e7a-a0d1-44217d9a0fe8' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'cf42bf0c-e8f4-4e7a-a0d1-44217d9a0fe8' where recipe_id in ('bc4b8410-ea20-461f-b51e-5a69679afff3');
update public.meal_plan_recipes set recipe_id = 'cf42bf0c-e8f4-4e7a-a0d1-44217d9a0fe8' where recipe_id in ('bc4b8410-ea20-461f-b51e-5a69679afff3');
update public.recipes set activo = false
where id in ('bc4b8410-ea20-461f-b51e-5a69679afff3') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Pavo al horno <- Pavo al horno con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('a3635b66-6cfd-4079-b64e-d43a800cbad6') and k.recipe_id = '3fdba1be-e81f-4892-a4fe-097903cbe054' and k.user_id = f.user_id;
update public.favorites set recipe_id = '3fdba1be-e81f-4892-a4fe-097903cbe054' where recipe_id in ('a3635b66-6cfd-4079-b64e-d43a800cbad6');
update public.meal_plan_recipes set recipe_id = '3fdba1be-e81f-4892-a4fe-097903cbe054' where recipe_id in ('a3635b66-6cfd-4079-b64e-d43a800cbad6');
update public.recipes set activo = false
where id in ('a3635b66-6cfd-4079-b64e-d43a800cbad6') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Pollo al horno <- Pollo al horno con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('8bd774cb-1691-43c5-9fc0-ddf83f4b7392') and k.recipe_id = '4846c18c-f1ea-400f-9201-cbe8012815a8' and k.user_id = f.user_id;
update public.favorites set recipe_id = '4846c18c-f1ea-400f-9201-cbe8012815a8' where recipe_id in ('8bd774cb-1691-43c5-9fc0-ddf83f4b7392');
update public.meal_plan_recipes set recipe_id = '4846c18c-f1ea-400f-9201-cbe8012815a8' where recipe_id in ('8bd774cb-1691-43c5-9fc0-ddf83f4b7392');
update public.recipes set activo = false
where id in ('8bd774cb-1691-43c5-9fc0-ddf83f4b7392') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Ensalada de quinoa <- Ensalada de quinoa con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('a5c9ebe9-74d4-4e57-843b-04a234667059') and k.recipe_id = '21fac519-388a-4fd0-b49b-43b54a3d2510' and k.user_id = f.user_id;
update public.favorites set recipe_id = '21fac519-388a-4fd0-b49b-43b54a3d2510' where recipe_id in ('a5c9ebe9-74d4-4e57-843b-04a234667059');
update public.meal_plan_recipes set recipe_id = '21fac519-388a-4fd0-b49b-43b54a3d2510' where recipe_id in ('a5c9ebe9-74d4-4e57-843b-04a234667059');
update public.recipes set activo = false
where id in ('a5c9ebe9-74d4-4e57-843b-04a234667059') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Rúcula con semillas de girasol y limón <- Ensalada de semillas de girasol con limón
update public.recipes set foto_url = 'https://images.pexels.com/photos/32986468/pexels-photo-32986468.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' where id = '9779b23b-7357-4cf5-834a-589f3c55d2b3' and foto_url is null;
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('1eaf3b69-d896-4292-aa22-3e61019c51f9') and k.recipe_id = '9779b23b-7357-4cf5-834a-589f3c55d2b3' and k.user_id = f.user_id;
update public.favorites set recipe_id = '9779b23b-7357-4cf5-834a-589f3c55d2b3' where recipe_id in ('1eaf3b69-d896-4292-aa22-3e61019c51f9');
update public.meal_plan_recipes set recipe_id = '9779b23b-7357-4cf5-834a-589f3c55d2b3' where recipe_id in ('1eaf3b69-d896-4292-aa22-3e61019c51f9');
update public.recipes set activo = false
where id in ('1eaf3b69-d896-4292-aa22-3e61019c51f9') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Rúcula con semillas de girasol y semillas de lino <- Ensalada de semillas de girasol con semillas de lino
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('86b123cc-795c-40d9-9e15-f49409e79067') and k.recipe_id = '7b4c20ca-233f-444e-85bd-2509ed063bb5' and k.user_id = f.user_id;
update public.favorites set recipe_id = '7b4c20ca-233f-444e-85bd-2509ed063bb5' where recipe_id in ('86b123cc-795c-40d9-9e15-f49409e79067');
update public.meal_plan_recipes set recipe_id = '7b4c20ca-233f-444e-85bd-2509ed063bb5' where recipe_id in ('86b123cc-795c-40d9-9e15-f49409e79067');
update public.recipes set activo = false
where id in ('86b123cc-795c-40d9-9e15-f49409e79067') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Salmon al horno <- Salmon al horno con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('0094b77c-ac64-4808-9fa0-5057e1ae2b67') and k.recipe_id = '73436afa-c3bc-417c-ab5a-5d8a3ecd5aae' and k.user_id = f.user_id;
update public.favorites set recipe_id = '73436afa-c3bc-417c-ab5a-5d8a3ecd5aae' where recipe_id in ('0094b77c-ac64-4808-9fa0-5057e1ae2b67');
update public.meal_plan_recipes set recipe_id = '73436afa-c3bc-417c-ab5a-5d8a3ecd5aae' where recipe_id in ('0094b77c-ac64-4808-9fa0-5057e1ae2b67');
update public.recipes set activo = false
where id in ('0094b77c-ac64-4808-9fa0-5057e1ae2b67') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Ternera guisada <- Ternera guisada con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('a03d8e46-719d-4c34-93e5-7d0f27273176') and k.recipe_id = 'f620e9cc-4e38-48e7-a12f-88a5d2cb3a80' and k.user_id = f.user_id;
update public.favorites set recipe_id = 'f620e9cc-4e38-48e7-a12f-88a5d2cb3a80' where recipe_id in ('a03d8e46-719d-4c34-93e5-7d0f27273176');
update public.meal_plan_recipes set recipe_id = 'f620e9cc-4e38-48e7-a12f-88a5d2cb3a80' where recipe_id in ('a03d8e46-719d-4c34-93e5-7d0f27273176');
update public.recipes set activo = false
where id in ('a03d8e46-719d-4c34-93e5-7d0f27273176') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Salteado de tofu <- Salteado de tofu con verduras salteadas
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('579fbb47-3a86-4a3d-b305-8fc2d2e73ae2') and k.recipe_id = '166e6123-2c6a-4ead-8a34-e30523b59871' and k.user_id = f.user_id;
update public.favorites set recipe_id = '166e6123-2c6a-4ead-8a34-e30523b59871' where recipe_id in ('579fbb47-3a86-4a3d-b305-8fc2d2e73ae2');
update public.meal_plan_recipes set recipe_id = '166e6123-2c6a-4ead-8a34-e30523b59871' where recipe_id in ('579fbb47-3a86-4a3d-b305-8fc2d2e73ae2');
update public.recipes set activo = false
where id in ('579fbb47-3a86-4a3d-b305-8fc2d2e73ae2') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);

-- Tortitas <- Tortitas con miel
delete from public.favorites f
using public.favorites k
where f.recipe_id in ('553a16ef-6a46-49d7-9056-94ee6874ac90') and k.recipe_id = '281acba9-3a7e-4d31-99bc-d0d609ca66ad' and k.user_id = f.user_id;
update public.favorites set recipe_id = '281acba9-3a7e-4d31-99bc-d0d609ca66ad' where recipe_id in ('553a16ef-6a46-49d7-9056-94ee6874ac90');
update public.meal_plan_recipes set recipe_id = '281acba9-3a7e-4d31-99bc-d0d609ca66ad' where recipe_id in ('553a16ef-6a46-49d7-9056-94ee6874ac90');
update public.recipes set activo = false
where id in ('553a16ef-6a46-49d7-9056-94ee6874ac90') and activo
  and not exists (select 1 from public.meal_plan_recipes m where m.recipe_id = recipes.id)
  and not exists (select 1 from public.favorites f where f.recipe_id = recipes.id);
