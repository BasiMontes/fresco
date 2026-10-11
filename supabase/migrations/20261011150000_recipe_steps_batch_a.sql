-- FRESCO-896 (batch A): 83 active recipes whose steps were the generic script
-- "Preparar X / Cocinar con ... / Sazonar al gusto / Servir caliente", even for a cold muesli.
-- The new steps are written from each recipe's OWN ingredient list (plus oil, salt and water,
-- which are never listed) and the technique its name states (al horno, a la plancha, al ajillo).
-- No step adds a main ingredient, so `alergenos` and `dieta` do not change (FRESCO-880 rule:
-- the allergen filters read the ingredient list, and the steps may not go beyond it).
-- No times are written into the steps: `meta` times are inconsistent (batch B). Each update only
-- fires while the row still holds its old steps.

-- Albondigas en salsa
update public.recipes
set pasos_resumen = '["Sazonar la ternera picada y formar las albóndigas", "Dorar las albóndigas en una sartén con un poco de aceite y reservarlas", "Sofreír la cebolla picada y añadir el tomate", "Volver a poner las albóndigas en la salsa y cocer a fuego lento hasta que estén hechas por dentro"]'::jsonb
where id = '3bfec4da-4bb6-4ac0-ace1-6a421d13efeb'
  and pasos_resumen = '["Preparar ternera picada", "Cocinar con tomate, cebolla", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Alubias con verduras
update public.recipes
set pasos_resumen = '["Remojar las alubias si son secas y cocerlas en agua hasta que estén tiernas", "Pelar y trocear la zanahoria y el puerro", "Sofreír las verduras en una cazuela con un poco de aceite", "Añadir las alubias con parte de su caldo y cocer a fuego lento unos minutos para que se mezclen los sabores"]'::jsonb
where id = 'd2ce987f-8180-490b-b74f-49ff4d5e4bd1'
  and pasos_resumen = '["Preparar alubias", "Cocinar con zanahoria, puerro", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Alubias con verduras salteadas
update public.recipes
set pasos_resumen = '["Remojar las alubias si son secas y cocerlas en agua hasta que estén tiernas", "Pelar y trocear la zanahoria y el puerro", "Sofreír las verduras en una cazuela con un poco de aceite", "Añadir las alubias con parte de su caldo y cocer a fuego lento unos minutos para que se mezclen los sabores"]'::jsonb
where id = '117b1cd1-de6e-4af0-b645-fd138e4db4ed'
  and pasos_resumen = '["Preparar alubias", "Cocinar con zanahoria, puerro", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Arroz con pollo
update public.recipes
set pasos_resumen = '["Trocear la pechuga de pollo y dorarla en una cazuela con un poco de aceite", "Añadir el pimiento en tiras y sofreírlo unos minutos", "Incorporar el arroz y rehogarlo un minuto", "Cubrir con agua o caldo caliente y cocer a fuego medio hasta que el arroz esté en su punto", "Dejar reposar tapado unos minutos antes de servir"]'::jsonb
where id = '1c049616-1e03-4883-8f68-d360ce4b4617'
  and pasos_resumen = '["Preparar arroz", "Cocinar con pechuga de pollo, pimiento", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Arroz con pollo y verduras salteadas
update public.recipes
set pasos_resumen = '["Trocear la pechuga de pollo y dorarla en una cazuela con un poco de aceite", "Añadir el pimiento en tiras y sofreírlo unos minutos", "Incorporar el arroz y rehogarlo un minuto", "Cubrir con agua o caldo caliente y cocer a fuego medio hasta que el arroz esté en su punto", "Dejar reposar tapado unos minutos antes de servir"]'::jsonb
where id = '789f0acb-19bc-45a3-a7e2-ad2175751484'
  and pasos_resumen = '["Preparar arroz", "Cocinar con pechuga de pollo, pimiento", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Arroz con verduras
update public.recipes
set pasos_resumen = '["Cortar el calabacín, la zanahoria y el pimiento en dados pequeños", "Sofreír las verduras en una cazuela con un poco de aceite", "Añadir el arroz y rehogarlo un minuto", "Cubrir con agua o caldo caliente y cocer hasta que el arroz esté en su punto", "Dejar reposar tapado unos minutos antes de servir"]'::jsonb
where id = '0575a462-058d-43cf-9674-f8f193b3f26c'
  and pasos_resumen = '["Preparar arroz", "Cocinar con calabacin, zanahoria, pimiento", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Arroz con verduras salteadas
update public.recipes
set pasos_resumen = '["Cortar el calabacín, la zanahoria y el pimiento en dados pequeños", "Sofreír las verduras en una cazuela con un poco de aceite", "Añadir el arroz y rehogarlo un minuto", "Cubrir con agua o caldo caliente y cocer hasta que el arroz esté en su punto", "Dejar reposar tapado unos minutos antes de servir"]'::jsonb
where id = '8b16e86b-3386-4f2b-a6a6-1907d00e1add'
  and pasos_resumen = '["Preparar arroz", "Cocinar con calabacin, zanahoria, pimiento", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Bacalao con tomate
update public.recipes
set pasos_resumen = '["Desalar el bacalao si es salado y secarlo bien", "Sofreír la cebolla picada con un poco de aceite hasta que esté transparente", "Añadir el tomate y cocer la salsa a fuego lento", "Poner el bacalao en la salsa y cocerlo unos minutos por cada lado hasta que esté hecho"]'::jsonb
where id = 'e994c27d-225a-4ef5-b4fe-886236d26e8d'
  and pasos_resumen = '["Preparar bacalao", "Cocinar con tomate, cebolla", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Bacalao con tomate y verduras salteadas
update public.recipes
set pasos_resumen = '["Desalar el bacalao si es salado y secarlo bien", "Sofreír la cebolla picada con un poco de aceite hasta que esté transparente", "Añadir el tomate y cocer la salsa a fuego lento", "Poner el bacalao en la salsa y cocerlo unos minutos por cada lado hasta que esté hecho"]'::jsonb
where id = '8b26cfd4-b23d-493a-9487-97d970b60b84'
  and pasos_resumen = '["Preparar bacalao", "Cocinar con tomate, cebolla", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Batido verde
update public.recipes
set pasos_resumen = '["Lavar las espinacas y pelar los plátanos", "Poner las espinacas, los plátanos troceados y la leche en la batidora", "Triturar hasta que quede una mezcla fina y sin grumos", "Servir enseguida, bien frío"]'::jsonb
where id = 'd67259a9-89a5-4aaa-95dc-a5e3f68806a8'
  and pasos_resumen = '["Preparar espinacas", "Cocinar con platano, leche", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Batido verde con plátano
update public.recipes
set pasos_resumen = '["Lavar las espinacas y pelar los plátanos", "Poner las espinacas, los plátanos troceados y la leche en la batidora", "Triturar hasta que quede una mezcla fina y sin grumos", "Servir enseguida, bien frío"]'::jsonb
where id = '71bd98eb-8f99-4cb9-996e-622471e0e694'
  and pasos_resumen = '["Preparar espinacas", "Cocinar con platano, leche", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Batido verde especias
update public.recipes
set pasos_resumen = '["Lavar las espinacas y pelar los plátanos", "Poner las espinacas, los plátanos troceados y la leche en la batidora", "Triturar hasta que quede una mezcla fina y sin grumos", "Servir enseguida, bien frío"]'::jsonb
where id = '2a51365a-b2b9-4e5f-b9d2-34b1975f1214'
  and pasos_resumen = '["Preparar espinacas", "Cocinar con platano, leche", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Batido verde hierbas frescas
update public.recipes
set pasos_resumen = '["Lavar las espinacas y pelar los plátanos", "Poner las espinacas, los plátanos troceados y la leche en la batidora", "Triturar hasta que quede una mezcla fina y sin grumos", "Servir enseguida, bien frío"]'::jsonb
where id = '36c10971-04b6-4cb4-8e25-991a4a862d73'
  and pasos_resumen = '["Preparar espinacas", "Cocinar con platano, leche", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Berenjenas rellenas
update public.recipes
set pasos_resumen = '["Cortar las berenjenas por la mitad a lo largo y vaciarlas con una cuchara, dejando un borde", "Picar la pulpa y sofreírla con el tomate", "Rellenar las berenjenas con esa mezcla y cubrir con el queso rallado", "Hornear hasta que las berenjenas estén tiernas y el queso, dorado"]'::jsonb
where id = '2d67544d-f224-4c22-976a-4c465a9f7b7b'
  and pasos_resumen = '["Preparar berenjena", "Cocinar con queso rallado, tomate", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Bowl de avena
update public.recipes
set pasos_resumen = '["Calentar la leche en un cazo", "Añadir la avena y cocer a fuego suave, removiendo, hasta que espese", "Pelar y cortar el plátano en rodajas", "Servir la avena en un bol y poner el plátano por encima"]'::jsonb
where id = '7c2055e5-e95f-40f5-8d8f-cfa26502807a'
  and pasos_resumen = '["Preparar avena", "Cocinar con leche, platano", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Bowl de yogur y fruta
update public.recipes
set pasos_resumen = '["Lavar la manzana y cortarla en dados", "Picar las nueces", "Poner el yogur en un bol y añadir la manzana", "Terminar con las nueces por encima"]'::jsonb
where id = '576d87e3-6a78-4d73-a624-a7084d6c2981'
  and pasos_resumen = '["Preparar yogur", "Cocinar con manzana, nueces", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Calamares a la plancha
update public.recipes
set pasos_resumen = '["Limpiar los calamares y secarlos bien", "Cortar el pimiento en tiras", "Calentar la plancha con un poco de aceite y cocinar el pimiento hasta que esté tierno", "Hacer los calamares a la plancha a fuego fuerte, pocos minutos por cada lado, y salar al final"]'::jsonb
where id = 'd4c3e7c4-aa56-457e-9a6e-c18b9252f253'
  and pasos_resumen = '["Preparar calamares", "Cocinar con pimiento", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Coliflor al horno
update public.recipes
set pasos_resumen = '["Cortar la coliflor en ramilletes", "Mezclarlos con el aceite de oliva y un poco de sal", "Hornear hasta que estén tiernos y dorados", "Servir con el tahini por encima"]'::jsonb
where id = '2f7f3fc3-8497-4545-9926-97807ccdfb8c'
  and pasos_resumen = '["Preparar coliflor", "Cocinar con tahini, aceite de oliva", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Conejo al ajillo
update public.recipes
set pasos_resumen = '["Trocear el conejo y salarlo", "Dorar el conejo en una cazuela con un poco de aceite", "Añadir los dientes de ajo laminados y rehogarlos sin que se quemen", "Verter el vino blanco y dejar que evapore el alcohol", "Tapar y cocer a fuego lento hasta que el conejo esté tierno"]'::jsonb
where id = 'c01e6490-af49-4d67-991c-046281998196'
  and pasos_resumen = '["Preparar conejo", "Cocinar con ajo, vino blanco", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Conejo al ajillo con verduras salteadas
update public.recipes
set pasos_resumen = '["Trocear el conejo y salarlo", "Dorar el conejo en una cazuela con un poco de aceite", "Añadir los dientes de ajo laminados y rehogarlos sin que se quemen", "Verter el vino blanco y dejar que evapore el alcohol", "Tapar y cocer a fuego lento hasta que el conejo esté tierno"]'::jsonb
where id = '0172d769-4c63-4b51-8a2d-ebf252883be4'
  and pasos_resumen = '["Preparar conejo", "Cocinar con ajo, vino blanco", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Cordero al horno
update public.recipes
set pasos_resumen = '["Salar el cordero y frotarlo con el romero", "Pelar las patatas y cortarlas en rodajas gruesas", "Colocar las patatas en una fuente de horno y poner el cordero encima", "Hornear hasta que el cordero esté tierno y dorado, regándolo de vez en cuando con su jugo"]'::jsonb
where id = 'a4dbbb6f-156b-4521-9002-21a227e2833c'
  and pasos_resumen = '["Preparar cordero", "Cocinar con patata, romero", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Cordero al horno con verduras salteadas
update public.recipes
set pasos_resumen = '["Salar el cordero y frotarlo con el romero", "Pelar las patatas y cortarlas en rodajas gruesas", "Colocar las patatas en una fuente de horno y poner el cordero encima", "Hornear hasta que el cordero esté tierno y dorado, regándolo de vez en cuando con su jugo"]'::jsonb
where id = 'fd853ed8-ac99-4368-9c94-d698eb787c9b'
  and pasos_resumen = '["Preparar cordero", "Cocinar con patata, romero", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Crema de calabacin
update public.recipes
set pasos_resumen = '["Cortar el calabacín y el puerro en trozos", "Rehogar el puerro en una cazuela con un poco de aceite", "Añadir el calabacín, cubrir con agua y cocer hasta que esté tierno", "Triturar con el queso fresco hasta obtener una crema fina y rectificar de sal"]'::jsonb
where id = '154f8b38-3815-4f7a-a765-8af1ee20d774'
  and pasos_resumen = '["Preparar calabacin", "Cocinar con puerro, queso fresco", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Crema de calabaza
update public.recipes
set pasos_resumen = '["Pelar la calabaza y cortarla en trozos; picar la cebolla", "Rehogar la cebolla con un poco de aceite", "Añadir la calabaza, cubrir con agua y cocer hasta que esté tierna", "Triturar con la nata hasta obtener una crema fina y rectificar de sal"]'::jsonb
where id = '060a6fc6-f053-45bb-abfd-5cd2ea029f82'
  and pasos_resumen = '["Preparar calabaza", "Cocinar con cebolla, nata", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Dorada al horno
update public.recipes
set pasos_resumen = '["Pelar las patatas, cortarlas en rodajas finas y ponerlas en una fuente de horno con un poco de aceite y sal", "Hornear las patatas hasta que empiecen a ablandarse", "Colocar encima las doradas limpias con el tomate en rodajas", "Volver al horno hasta que la dorada esté hecha"]'::jsonb
where id = '994c34bc-175e-4812-b78e-c6efb20a753b'
  and pasos_resumen = '["Preparar dorada", "Cocinar con patata, tomate", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Dorada al horno con verduras salteadas
update public.recipes
set pasos_resumen = '["Pelar las patatas, cortarlas en rodajas finas y ponerlas en una fuente de horno con un poco de aceite y sal", "Hornear las patatas hasta que empiecen a ablandarse", "Colocar encima las doradas limpias con el tomate en rodajas", "Volver al horno hasta que la dorada esté hecha"]'::jsonb
where id = '7e572850-d05c-49f3-95b5-f52214b85033'
  and pasos_resumen = '["Preparar dorada", "Cocinar con patata, tomate", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Ensalada de atun
update public.recipes
set pasos_resumen = '["Lavar el tomate y cortarlo en trozos", "Escurrir el atún y desmenuzarlo", "Mezclar en una fuente el tomate, el atún y las aceitunas", "Aliñar con un poco de aceite y sal"]'::jsonb
where id = '9552b2cb-4ad2-4d53-ac42-df40a76b1012'
  and pasos_resumen = '["Preparar atun", "Cocinar con tomate, aceitunas", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Ensalada de atun con verduras salteadas
update public.recipes
set pasos_resumen = '["Lavar el tomate y cortarlo en trozos", "Escurrir el atún y desmenuzarlo", "Mezclar en una fuente el tomate, el atún y las aceitunas", "Aliñar con un poco de aceite y sal"]'::jsonb
where id = '69959319-9a45-4a27-97ee-4686f684c86b'
  and pasos_resumen = '["Preparar atun", "Cocinar con tomate, aceitunas", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Ensalada de garbanzos
update public.recipes
set pasos_resumen = '["Escurrir y enjuagar los garbanzos cocidos", "Picar el tomate y la cebolla", "Mezclar todo en un bol con las aceitunas", "Aliñar con aceite y sal y dejar reposar unos minutos antes de servir"]'::jsonb
where id = '960b6069-8605-4ed0-844b-a729e8705938'
  and pasos_resumen = '["Preparar garbanzos", "Cocinar con tomate, cebolla, aceitunas", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Ensalada de garbanzos con verduras salteadas
update public.recipes
set pasos_resumen = '["Escurrir y enjuagar los garbanzos cocidos", "Picar el tomate y la cebolla", "Mezclar todo en un bol con las aceitunas", "Aliñar con aceite y sal y dejar reposar unos minutos antes de servir"]'::jsonb
where id = '3faee9c6-114c-48b7-a981-2a60211bcf8e'
  and pasos_resumen = '["Preparar garbanzos", "Cocinar con tomate, cebolla, aceitunas", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Ensalada de quinoa
update public.recipes
set pasos_resumen = '["Enjuagar la quinoa, cocerla en agua con sal hasta que esté tierna, escurrirla y dejarla enfriar", "Cortar el tomate y el aguacate en dados", "Mezclar la quinoa con el tomate y el aguacate", "Aliñar con aceite y sal"]'::jsonb
where id = '21fac519-388a-4fd0-b49b-43b54a3d2510'
  and pasos_resumen = '["Preparar quinoa", "Cocinar con tomate, aguacate", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Ensalada de quinoa con verduras salteadas
update public.recipes
set pasos_resumen = '["Enjuagar la quinoa, cocerla en agua con sal hasta que esté tierna, escurrirla y dejarla enfriar", "Cortar el tomate y el aguacate en dados", "Mezclar la quinoa con el tomate y el aguacate", "Aliñar con aceite y sal"]'::jsonb
where id = 'a5c9ebe9-74d4-4e57-843b-04a234667059'
  and pasos_resumen = '["Preparar quinoa", "Cocinar con tomate, aguacate", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Gambas al ajillo
update public.recipes
set pasos_resumen = '["Pelar las gambas y laminar los dientes de ajo", "Calentar el aceite de oliva en una cazuela o una sartén y dorar el ajo a fuego suave", "Subir el fuego, añadir las gambas y salarlas", "Saltearlas un par de minutos, hasta que cambien de color, y servir enseguida en el aceite"]'::jsonb
where id = 'e29fd4de-2e1c-487f-8aef-f57875dcabac'
  and pasos_resumen = '["Preparar gambas", "Cocinar con ajo, aceite de oliva", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Gambas al ajillo con verduras salteadas
update public.recipes
set pasos_resumen = '["Pelar las gambas y laminar los dientes de ajo", "Calentar el aceite de oliva en una cazuela o una sartén y dorar el ajo a fuego suave", "Subir el fuego, añadir las gambas y salarlas", "Saltearlas un par de minutos, hasta que cambien de color, y servir enseguida en el aceite"]'::jsonb
where id = '99b38cea-c65a-4e93-8903-1bb61aa35e6e'
  and pasos_resumen = '["Preparar gambas", "Cocinar con ajo, aceite de oliva", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Garbanzos con espinacas
update public.recipes
set pasos_resumen = '["Escurrir los garbanzos cocidos", "Dorar los ajos laminados en una sartén con un poco de aceite", "Añadir las espinacas y rehogarlas hasta que se reduzcan", "Incorporar los garbanzos y cocinar unos minutos para que se mezclen los sabores"]'::jsonb
where id = '9faee65c-8b4c-448c-89b9-b9b1779a10ee'
  and pasos_resumen = '["Preparar garbanzos", "Cocinar con espinacas, ajo", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Garbanzos con espinacas y verduras salteadas
update public.recipes
set pasos_resumen = '["Escurrir los garbanzos cocidos", "Dorar los ajos laminados en una sartén con un poco de aceite", "Añadir las espinacas y rehogarlas hasta que se reduzcan", "Incorporar los garbanzos y cocinar unos minutos para que se mezclen los sabores"]'::jsonb
where id = '2d83af7c-1270-4260-8e85-5e98c41b1f43'
  and pasos_resumen = '["Preparar garbanzos", "Cocinar con espinacas, ajo", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Gofres
update public.recipes
set pasos_resumen = '["Calentar los gofres en la tostadora o en una sartén", "Lavar los frutos rojos", "Servir los gofres calientes con los frutos rojos por encima"]'::jsonb
where id = '8773e3b5-835d-462e-9316-75a8a69a2485'
  and pasos_resumen = '["Preparar gofres", "Cocinar con frutos rojos", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Gofres con frutos rojos
update public.recipes
set pasos_resumen = '["Calentar los gofres en la tostadora o en una sartén", "Lavar los frutos rojos", "Servir los gofres calientes con los frutos rojos por encima"]'::jsonb
where id = '591cc4fd-3782-4007-b151-ab2369cf8fb1'
  and pasos_resumen = '["Preparar gofres", "Cocinar con frutos rojos", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Hamburguesa de ternera
update public.recipes
set pasos_resumen = '["Sazonar la ternera picada y formar las hamburguesas", "Hacerlas en una sartén o plancha caliente hasta que estén hechas por dentro", "Poner una loncha de queso encima en el último minuto para que se funda", "Tostar ligeramente el pan y montar las hamburguesas"]'::jsonb
where id = '82edb728-a851-4c38-b7da-b76e0f4da624'
  and pasos_resumen = '["Preparar ternera picada", "Cocinar con pan, queso", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Huevos poche
update public.recipes
set pasos_resumen = '["Saltear las espinacas en una sartén con un poco de aceite y salarlas", "Calentar agua en un cazo hasta que casi hierva", "Cascar los huevos de uno en uno en el agua y cocerlos unos tres minutos", "Tostar el pan y servir los huevos sobre las espinacas y el pan"]'::jsonb
where id = '51b03003-63f2-419d-9b7e-f789776eaa9e'
  and pasos_resumen = '["Preparar huevo", "Cocinar con espinacas, pan integral", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Huevos revueltos
update public.recipes
set pasos_resumen = '["Batir los huevos con un poco de sal", "Calentar el aceite de oliva en una sartén a fuego medio", "Verter los huevos y remover despacio hasta que cuajen pero sigan jugosos", "Servir enseguida"]'::jsonb
where id = '0723583b-e23b-4368-aed2-1627a3518f75'
  and pasos_resumen = '["Preparar huevo", "Cocinar con aceite de oliva", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Lentejas estofadas
update public.recipes
set pasos_resumen = '["Picar la cebolla y la zanahoria y cortar el chorizo en rodajas", "Sofreír la cebolla, la zanahoria y el chorizo en una cazuela", "Añadir las lentejas y cubrir con agua", "Cocer a fuego lento hasta que las lentejas estén tiernas"]'::jsonb
where id = '157b4863-dc9f-4b60-8ae2-cbc8d9532df8'
  and pasos_resumen = '["Preparar lentejas", "Cocinar con zanahoria, cebolla, chorizo", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Lentejas estofadas con verduras salteadas
update public.recipes
set pasos_resumen = '["Picar la cebolla y la zanahoria y cortar el chorizo en rodajas", "Sofreír la cebolla, la zanahoria y el chorizo en una cazuela", "Añadir las lentejas y cubrir con agua", "Cocer a fuego lento hasta que las lentejas estén tiernas"]'::jsonb
where id = 'b2a8434e-1913-444d-9d9e-63ddb6541808'
  and pasos_resumen = '["Preparar lentejas", "Cocinar con zanahoria, cebolla, chorizo", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Mejillones al vapor
update public.recipes
set pasos_resumen = '["Limpiar los mejillones y quitarles las barbas", "Picar la cebolla y rehogarla en una cazuela con un poco de aceite", "Añadir el vino blanco y los mejillones, y tapar", "Cocer a fuego fuerte hasta que se abran y tirar los que sigan cerrados"]'::jsonb
where id = 'a8cc4e66-e1db-439b-9178-feb0c97943ad'
  and pasos_resumen = '["Preparar mejillones", "Cocinar con vino blanco, cebolla", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Mejillones al vapor con verduras salteadas
update public.recipes
set pasos_resumen = '["Limpiar los mejillones y quitarles las barbas", "Picar la cebolla y rehogarla en una cazuela con un poco de aceite", "Añadir el vino blanco y los mejillones, y tapar", "Cocer a fuego fuerte hasta que se abran y tirar los que sigan cerrados"]'::jsonb
where id = '0a10e16e-6714-40ac-a2b9-f076465f7319'
  and pasos_resumen = '["Preparar mejillones", "Cocinar con vino blanco, cebolla", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Merluza a la plancha
update public.recipes
set pasos_resumen = '["Secar la merluza y salarla", "Hacer los espárragos a la plancha con un poco de aceite hasta que estén tiernos y reservarlos", "Hacer la merluza en la plancha bien caliente, pocos minutos por cada lado", "Servir la merluza con los espárragos"]'::jsonb
where id = 'd3e80e02-5fb5-4594-b1d3-c01f71dbf1e7'
  and pasos_resumen = '["Preparar merluza", "Cocinar con esparragos", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Muesli con leche
update public.recipes
set pasos_resumen = '["Poner la granola en un bol", "Añadir la leche fría", "Lavar los frutos rojos y ponerlos por encima", "Tomar enseguida, para que la granola siga crujiente"]'::jsonb
where id = '0aff1ed8-54c1-4def-a56f-c60f84ae5e50'
  and pasos_resumen = '["Preparar granola", "Cocinar con leche, frutos rojos", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Muesli con leche y frutos rojos
update public.recipes
set pasos_resumen = '["Poner la granola en un bol", "Añadir la leche fría", "Lavar los frutos rojos y ponerlos por encima", "Tomar enseguida, para que la granola siga crujiente"]'::jsonb
where id = '3ae2ff65-266a-4719-bf22-d2fe915a3f75'
  and pasos_resumen = '["Preparar granola", "Cocinar con leche, frutos rojos", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Panceta con higado
update public.recipes
set pasos_resumen = '["Cortar la panceta en tiras y el hígado en filetes finos", "Picar la cebolla", "Dorar la panceta en una sartén y retirarla", "En la grasa de la panceta, rehogar la cebolla y hacer el hígado unos minutos por cada lado", "Volver a poner la panceta y servir enseguida"]'::jsonb
where id = '1de8cc1a-8e96-4e16-a5d7-d26120bcb027'
  and pasos_resumen = '["Preparar panceta", "Cocinar con higado, cebolla", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Pasta con setas
update public.recipes
set pasos_resumen = '["Cocer la pasta en agua con sal hasta que esté al dente y escurrirla", "Limpiar y laminar las setas", "Saltear las setas en una sartén con un poco de aceite", "Añadir la nata y cocer unos minutos a fuego suave", "Mezclar con la pasta y servir"]'::jsonb
where id = '0a047b8d-9240-455e-bf1f-56424b10cb71'
  and pasos_resumen = '["Preparar pasta", "Cocinar con setas, nata", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Pasta con setas y verduras salteadas
update public.recipes
set pasos_resumen = '["Cocer la pasta en agua con sal hasta que esté al dente y escurrirla", "Limpiar y laminar las setas", "Saltear las setas en una sartén con un poco de aceite", "Añadir la nata y cocer unos minutos a fuego suave", "Mezclar con la pasta y servir"]'::jsonb
where id = '2a1bca79-d042-46fc-a141-cac4945165f2'
  and pasos_resumen = '["Preparar pasta", "Cocinar con setas, nata", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Pasta con tomate
update public.recipes
set pasos_resumen = '["Cocer la pasta en agua con sal hasta que esté al dente y escurrirla", "Cocer el tomate a fuego lento en una sartén con un poco de aceite hasta que se espese la salsa", "Mezclar la pasta con la salsa", "Servir con el queso rallado por encima"]'::jsonb
where id = 'cf42bf0c-e8f4-4e7a-a0d1-44217d9a0fe8'
  and pasos_resumen = '["Preparar pasta", "Cocinar con tomate, queso rallado", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Pasta con tomate y verduras salteadas
update public.recipes
set pasos_resumen = '["Cocer la pasta en agua con sal hasta que esté al dente y escurrirla", "Cocer el tomate a fuego lento en una sartén con un poco de aceite hasta que se espese la salsa", "Mezclar la pasta con la salsa", "Servir con el queso rallado por encima"]'::jsonb
where id = 'bc4b8410-ea20-461f-b51e-5a69679afff3'
  and pasos_resumen = '["Preparar pasta", "Cocinar con tomate, queso rallado", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Pavo al horno
update public.recipes
set pasos_resumen = '["Salar el pavo", "Pelar los boniatos y cortarlos en trozos", "Poner el pavo y los boniatos en una fuente con un poco de aceite", "Hornear hasta que el pavo esté hecho por dentro y los boniatos, tiernos"]'::jsonb
where id = '3fdba1be-e81f-4892-a4fe-097903cbe054'
  and pasos_resumen = '["Preparar pavo", "Cocinar con boniato", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Pavo al horno con verduras salteadas
update public.recipes
set pasos_resumen = '["Salar el pavo", "Pelar los boniatos y cortarlos en trozos", "Poner el pavo y los boniatos en una fuente con un poco de aceite", "Hornear hasta que el pavo esté hecho por dentro y los boniatos, tiernos"]'::jsonb
where id = 'a3635b66-6cfd-4079-b64e-d43a800cbad6'
  and pasos_resumen = '["Preparar pavo", "Cocinar con boniato", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Poke bowl de salmón
update public.recipes
set pasos_resumen = '["Cocer el arroz y dejarlo enfriar", "Cortar el salmón en dados (si va crudo, que sea apto para consumo en crudo; si no, hacerlo antes a la plancha) y el aguacate también", "Montar el bol con el arroz y encima el salmón y el aguacate", "Terminar con el sésamo por encima"]'::jsonb
where id = '2285488c-2365-4299-a0ee-575d57b4a286'
  and pasos_resumen = '["Preparar salmon", "Cocinar con arroz, aguacate, sesamo", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Pollo a la plancha
update public.recipes
set pasos_resumen = '["Salar la pechuga de pollo y, si es gruesa, abrirla en filetes finos", "Cocer el brócoli en ramilletes en agua con sal unos minutos hasta que esté tierno y escurrirlo", "Hacer el pollo en la plancha caliente con un poco de aceite hasta que esté bien hecho por dentro", "Servir el pollo con el brócoli"]'::jsonb
where id = '81a8c4c7-eed4-44f0-9710-6decd8720a90'
  and pasos_resumen = '["Preparar pechuga de pollo", "Cocinar con brocoli", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Pollo al horno
update public.recipes
set pasos_resumen = '["Pelar las patatas y cortarlas en rodajas; cortar el pimiento en tiras", "Poner las patatas y el pimiento en una fuente de horno con un poco de aceite y sal", "Colocar encima la pechuga de pollo salada", "Hornear hasta que el pollo esté bien hecho por dentro y las patatas, tiernas"]'::jsonb
where id = '4846c18c-f1ea-400f-9201-cbe8012815a8'
  and pasos_resumen = '["Preparar pechuga de pollo", "Cocinar con patata, pimiento", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Pollo al horno con verduras salteadas
update public.recipes
set pasos_resumen = '["Pelar las patatas y cortarlas en rodajas; cortar el pimiento en tiras", "Poner las patatas y el pimiento en una fuente de horno con un poco de aceite y sal", "Colocar encima la pechuga de pollo salada", "Hornear hasta que el pollo esté bien hecho por dentro y las patatas, tiernas"]'::jsonb
where id = '8bd774cb-1691-43c5-9fc0-ddf83f4b7392'
  and pasos_resumen = '["Preparar pechuga de pollo", "Cocinar con patata, pimiento", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Porridge de avena
update public.recipes
set pasos_resumen = '["Pelar la manzana y cortarla en dados pequeños", "Cocer la avena en agua a fuego suave, removiendo, hasta que espese", "Añadir la manzana a media cocción", "Servir con la miel por encima"]'::jsonb
where id = '00bbcdcd-64ff-411b-9423-b0f476ec683c'
  and pasos_resumen = '["Preparar avena", "Cocinar con manzana, miel", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Porridge de avena con miel
update public.recipes
set pasos_resumen = '["Pelar la manzana y cortarla en dados pequeños", "Cocer la avena en agua a fuego suave, removiendo, hasta que espese", "Añadir la manzana a media cocción", "Servir con la miel por encima"]'::jsonb
where id = '3f6253e5-4dda-4ba7-8d31-e833fdebb348'
  and pasos_resumen = '["Preparar avena", "Cocinar con manzana, miel", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Revuelto de champinones
update public.recipes
set pasos_resumen = '["Laminar los champiñones y picar el ajo", "Saltear el ajo y los champiñones en una sartén con un poco de aceite hasta que se doren", "Añadir los huevos batidos con un poco de sal", "Remover despacio hasta que cuajen y servir enseguida"]'::jsonb
where id = 'b22cea3a-8126-4d29-9271-30a38c62224f'
  and pasos_resumen = '["Preparar huevo", "Cocinar con champinones, ajo", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Salmon al horno
update public.recipes
set pasos_resumen = '["Cortar el brócoli en ramilletes y ponerlo en una fuente de horno con un poco de aceite y sal", "Colocar el salmón encima y salarlo", "Exprimir el limón por encima", "Hornear hasta que el salmón esté hecho y el brócoli, tierno"]'::jsonb
where id = '73436afa-c3bc-417c-ab5a-5d8a3ecd5aae'
  and pasos_resumen = '["Preparar salmon", "Cocinar con brocoli, limon", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Salmon al horno con verduras salteadas
update public.recipes
set pasos_resumen = '["Cortar el brócoli en ramilletes y ponerlo en una fuente de horno con un poco de aceite y sal", "Colocar el salmón encima y salarlo", "Exprimir el limón por encima", "Hornear hasta que el salmón esté hecho y el brócoli, tierno"]'::jsonb
where id = '0094b77c-ac64-4808-9fa0-5057e1ae2b67'
  and pasos_resumen = '["Preparar salmon", "Cocinar con brocoli, limon", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Salteado de seitan
update public.recipes
set pasos_resumen = '["Cortar el seitán, el pimiento y la cebolla en tiras", "Saltear la cebolla y el pimiento en una sartén con un poco de aceite", "Añadir el seitán y dorarlo", "Echar la salsa de soja y cocinar un par de minutos más"]'::jsonb
where id = '69e676eb-3dad-41b6-8e15-3097bf3b93f4'
  and pasos_resumen = '["Preparar seitan", "Cocinar con pimiento, cebolla, salsa de soja", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Salteado de tofu
update public.recipes
set pasos_resumen = '["Escurrir el tofu, secarlo y cortarlo en dados", "Cortar el brócoli en ramilletes y cocerlo unos minutos hasta que esté tierno pero firme", "Dorar el tofu en una sartén con un poco de aceite", "Añadir el brócoli y la salsa de soja y saltear un par de minutos", "Servir con el sésamo por encima"]'::jsonb
where id = '166e6123-2c6a-4ead-8a34-e30523b59871'
  and pasos_resumen = '["Preparar tofu", "Cocinar con brocoli, salsa de soja, sesamo", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Salteado de tofu con verduras salteadas
update public.recipes
set pasos_resumen = '["Escurrir el tofu, secarlo y cortarlo en dados", "Cortar el brócoli en ramilletes y cocerlo unos minutos hasta que esté tierno pero firme", "Dorar el tofu en una sartén con un poco de aceite", "Añadir el brócoli y la salsa de soja y saltear un par de minutos", "Servir con el sésamo por encima"]'::jsonb
where id = '579fbb47-3a86-4a3d-b305-8fc2d2e73ae2'
  and pasos_resumen = '["Preparar tofu", "Cocinar con brocoli, salsa de soja, sesamo", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Solomillo de cerdo
update public.recipes
set pasos_resumen = '["Salar el lomo de cerdo y cortarlo en medallones", "Laminar los champiñones", "Dorar el cerdo en una sartén con un poco de aceite y reservarlo", "Saltear los champiñones en la misma sartén", "Volver a poner el cerdo y cocinarlo unos minutos hasta que esté hecho por dentro"]'::jsonb
where id = 'badcd7b9-1bef-4143-ad33-b35e584a350c'
  and pasos_resumen = '["Preparar lomo de cerdo", "Cocinar con champinones", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Solomillo de cerdo con verduras salteadas
update public.recipes
set pasos_resumen = '["Salar el lomo de cerdo y cortarlo en medallones", "Laminar los champiñones", "Dorar el cerdo en una sartén con un poco de aceite y reservarlo", "Saltear los champiñones en la misma sartén", "Volver a poner el cerdo y cocinarlo unos minutos hasta que esté hecho por dentro"]'::jsonb
where id = 'e4326af9-ed0e-4c3e-a775-113bb164448d'
  and pasos_resumen = '["Preparar lomo de cerdo", "Cocinar con champinones", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Sopa de verduras
update public.recipes
set pasos_resumen = '["Pelar y cortar la zanahoria, el puerro y el apio en trozos", "Rehogarlos unos minutos en una cazuela con un poco de aceite", "Cubrir con agua, salar y cocer a fuego lento hasta que estén tiernos", "Servir caliente, entera o triturada"]'::jsonb
where id = 'ebdb28bf-d8fa-40d1-b95e-822ea0e64de1'
  and pasos_resumen = '["Preparar zanahoria", "Cocinar con puerro, apio", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Ternera guisada
update public.recipes
set pasos_resumen = '["Salar la ternera, cortarla en trozos y dorarla en una cazuela con un poco de aceite", "Añadir la zanahoria en rodajas y rehogarla", "Verter el vino tinto y dejar que reduzca unos minutos", "Cubrir con agua y cocer a fuego lento hasta que la carne esté casi tierna", "Añadir la patata en trozos y cocer hasta que esté tierna"]'::jsonb
where id = 'f620e9cc-4e38-48e7-a12f-88a5d2cb3a80'
  and pasos_resumen = '["Preparar ternera", "Cocinar con patata, zanahoria, vino tinto", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Ternera guisada con verduras salteadas
update public.recipes
set pasos_resumen = '["Salar la ternera, cortarla en trozos y dorarla en una cazuela con un poco de aceite", "Añadir la zanahoria en rodajas y rehogarla", "Verter el vino tinto y dejar que reduzca unos minutos", "Cubrir con agua y cocer a fuego lento hasta que la carne esté casi tierna", "Añadir la patata en trozos y cocer hasta que esté tierna"]'::jsonb
where id = 'a03d8e46-719d-4c34-93e5-7d0f27273176'
  and pasos_resumen = '["Preparar ternera", "Cocinar con patata, zanahoria, vino tinto", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Tortilla de patatas
update public.recipes
set pasos_resumen = '["Pelar las patatas y cortarlas en láminas finas; picar la cebolla", "Pochar la patata y la cebolla con abundante aceite a fuego suave hasta que estén tiernas y escurrirlas", "Batir los huevos con sal y mezclarlos con la patata y la cebolla", "Cuajar la mezcla en una sartén por un lado, darle la vuelta y cuajar el otro"]'::jsonb
where id = '1a13b69b-6593-43ed-af93-31096b76bf72'
  and pasos_resumen = '["Preparar huevo", "Cocinar con patata, cebolla", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Tortilla de patatas con verduras salteadas
update public.recipes
set pasos_resumen = '["Pelar las patatas y cortarlas en láminas finas; picar la cebolla", "Pochar la patata y la cebolla con abundante aceite a fuego suave hasta que estén tiernas y escurrirlas", "Batir los huevos con sal y mezclarlos con la patata y la cebolla", "Cuajar la mezcla en una sartén por un lado, darle la vuelta y cuajar el otro"]'::jsonb
where id = 'd80af55c-ff96-4cdf-8f6f-97eb0d27bdc4'
  and pasos_resumen = '["Preparar huevo", "Cocinar con patata, cebolla", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Tortilla francesa
update public.recipes
set pasos_resumen = '["Batir los huevos con un poco de sal", "Verter en una sartén caliente con un poco de aceite", "Cuando empiece a cuajar, espolvorear el queso rallado", "Doblar la tortilla por la mitad y servir enseguida"]'::jsonb
where id = '4d025c8f-d783-44be-b4e7-06451aaa8a20'
  and pasos_resumen = '["Preparar huevo", "Cocinar con queso rallado", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Tortitas
update public.recipes
set pasos_resumen = '["Calentar las tortitas en una sartén o en el microondas", "Apilarlas en un plato", "Servirlas con la miel por encima"]'::jsonb
where id = '281acba9-3a7e-4d31-99bc-d0d609ca66ad'
  and pasos_resumen = '["Preparar tortitas", "Cocinar con miel", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Tortitas con miel
update public.recipes
set pasos_resumen = '["Calentar las tortitas en una sartén o en el microondas", "Apilarlas en un plato", "Servirlas con la miel por encima"]'::jsonb
where id = '553a16ef-6a46-49d7-9056-94ee6874ac90'
  and pasos_resumen = '["Preparar tortitas", "Cocinar con miel", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Tostada con jamón serrano
update public.recipes
set pasos_resumen = '["Tostar el pan integral", "Rallar el tomate y extenderlo sobre el pan", "Colocar encima el jamón serrano"]'::jsonb
where id = 'a3937eed-03b5-465c-b478-4c27b3234b79'
  and pasos_resumen = '["Preparar pan integral", "Cocinar con jamon serrano, tomate", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Tostada con queso fresco
update public.recipes
set pasos_resumen = '["Tostar el pan integral", "Extender el queso fresco sobre las tostadas", "Cortar el tomate en rodajas y ponerlo encima"]'::jsonb
where id = 'efd079c7-f5af-419e-a33f-c21d32417ed3'
  and pasos_resumen = '["Preparar pan integral", "Cocinar con queso fresco, tomate", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Tostada con salmón ahumado
update public.recipes
set pasos_resumen = '["Tostar el pan integral", "Extender el queso fresco sobre las tostadas", "Colocar el salmón ahumado encima"]'::jsonb
where id = '05d079cc-8962-4924-be90-c39a3b1c354a'
  and pasos_resumen = '["Preparar pan integral", "Cocinar con salmon, queso fresco", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Tostada de aguacate
update public.recipes
set pasos_resumen = '["Tostar el pan integral", "Machacar el aguacate con un tenedor y un poco de sal", "Extenderlo sobre las tostadas", "Terminar con un chorrito de aceite de oliva"]'::jsonb
where id = '372c277d-44df-4405-b2c6-99d9a9fae88c'
  and pasos_resumen = '["Preparar pan integral", "Cocinar con aguacate, aceite de oliva", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Wrap de pollo
update public.recipes
set pasos_resumen = '["Cortar la pechuga de pollo en tiras y salarla", "Hacer el pollo en una sartén con un poco de aceite hasta que esté bien hecho", "Cortar el aguacate en láminas", "Calentar las tortillas, rellenarlas con el pollo y el aguacate y enrollarlas"]'::jsonb
where id = 'dd88540d-e87a-4b1d-953b-96467de108a3'
  and pasos_resumen = '["Preparar pechuga de pollo", "Cocinar con tortilla de trigo, aguacate", "Sazonar al gusto", "Servir caliente"]'::jsonb;

-- Yogur griego con granola
update public.recipes
set pasos_resumen = '["Poner el yogur griego en un bol", "Añadir la granola por encima", "Terminar con los frutos rojos lavados"]'::jsonb
where id = 'a56dc047-8a39-4294-aa52-b1eadf1fc8e9'
  and pasos_resumen = '["Preparar yogur griego", "Cocinar con granola, frutos rojos", "Sazonar al gusto", "Servir caliente"]'::jsonb;
