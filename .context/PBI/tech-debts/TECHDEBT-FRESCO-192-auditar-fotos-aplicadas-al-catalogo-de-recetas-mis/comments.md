# Comments for FRESCO-192

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-192)

---

### Basi Montes - 8/13/2026, 6:42:42 PM

## Batch 1-3 (30/816 auditadas)

***Resumen******:****** 8 MATCH · 15 MISMATCH · 7 QUESTIONABLE (50% mismatch real)***

Extrapolado a las 816 aplicadas: ~400 fotos potencialmente mal puestas si la muestra es representativa.

### MISMATCH confirmados (15)

| ID | Nombre | Problema |
| --- | --- | --- |
| 0009c6fb | Calabacín salteado con albahaca y jengibre | Bok choy crudo en mano, no calabacín ni salteado |
| 00c51007 | Champiñones salteados tamari y jengibre | Un champiñón crudo solo, sin cocinar |
| 010c3990 | Crema de calabaza estilo casero | Ingredientes crudos en bowl, no crema |
| 0172d769 | Conejo al ajillo con verduras salteadas | Chiles secos y ajo, sin conejo ni carne |
| 02260641 | Bol de requesón con fresas | Solo fresas, sin requesón |
| 02c44048 | Huevos poché al estilo del sur con miel | Huevos fritos (no poché), sin miel |
| 03b0877e | Ensalada de quinoa con especias | Chaat indio (patties fritos), sin quinoa |
| 03ff12b2 | Sopa de ajo con semillas de lino | Un bulbo de ajo crudo, sin sopa |
| 040ee444 | Pavo al horno con especias | Jamón glaseado, no pavo |
| 0413d43f | Huevos revueltos al estilo del sur con miel | Huevo frito (no revuelto), sin miel |
| 0453374c | Pasta con setas mediterráneo | Carbonara, sin setas |
| 053495c3 | Ensalada César con pollo | Ensalada genérica, sin César |
| 056531e2 | Wok de tamari y jengibre con cilantro | Wok de pollo con chile, no vegetal |
| 0575a462 | Arroz con verduras | Estofado cremoso, sin arroz visible |
| 064f2539 | Champiñones rellenos de ajo | Dumplings/wontons, sin champiñones |

### QUESTIONABLE (7) — dudoso, revisar con más cuidado

017bf4b6, 01b7907a, 02023545, 022a6a07, 02e28b46, 056d1fb7, 05d079cc

### MATCH confirmados (8)

0094b77c, 00bbcdcd, 0281cf35, 0443cfd6, 052bae9d, 05ddcd45, 060a6fc6, 063fed15

## Siguiente

Escala del problema es grande (~400/816 estimado). Antes de seguir auditando el resto, decidir estrategia de remediación: ¿re-buscar foto para cada mismatch (mismo riesgo de baja precisión otra vez), o directamente poner `foto_url = null` en los confirmados y aceptar el icono de categoría como fallback (ya existe ese patrón en la UI)?

---

### Basi Montes - 8/13/2026, 6:49:25 PM

## Batch 4 (30-60/816 auditadas) — acumulado 60/816

***Batch 4******:****** 9 MATCH · 15 MISMATCH · 6 QUESTIONABLE***
***Acumulado (batches 1-4)******:****** 17 MATCH · 30 MISMATCH · 13 QUESTIONABLE / 60 = 50% mismatch estable***

### MISMATCH batch 4 (15)

| ID | Nombre | Problema |
| --- | --- | --- |
| 066194df | Pollo a la plancha con verduras salteadas | Alitas turcas con sumac, sin verduras salteadas |
| 069336e0 | Crema de brócoli | Crema beige, no verde |
| 0723583b | Huevos revueltos estilo casero con canela | Huevo horneado flameado, no revuelto |
| 07f67686 | Tofu al horno con limón | Bodegón de fruta/nueces, sin tofu |
| 0830232e | Alubias con verduras estilo casero | Curry indio, sin alubias |
| 09e52f77 | Ensalada de semillas de girasol con ajo asado | Ajos crudos, sin ensalada ni semillas |
| 0a047b8d | Pasta con setas | Pasta de gambas y almejas, sin setas |
| 0a4308a5 | Tortilla de patatas con verduras | Plato horneado con queso, no tortilla española |
| 0aa0ddc1 | Pollo al limón con ensalada verde | Tacos con paquete de "carne" vegana visible |
| 0cb54b8f | Repollo salteado con sésamo y aceitunas | Repollo estilo Rotkohl alemán, sin sésamo ni aceitunas |
| 0cfa89ec | Huevos rellenos | Desayuno mexicano completo, sin huevos rellenos |
| 0cfee27f | Coliflor al horno | Ramo de flores secas — sin comida |
| 0d3e17e5 | Porridge de avena con miel | Taza de café, sin avena |
| 0d7e223b | Calabacín salteado con albahaca | Pepino en rodajas de cítricos, verdura equivocada |
| 0dc55ef2 | Revuelto de cúrcuma y ajo | Huevo frito simple, sin revolver ni cúrcuma |

### QUESTIONABLE (6)

07020220, 08d82b7a, 0a10e16e, 0ba06e16, 0d312464, 0df26766

### MATCH (9)

06a4c249, 08627993, 0ad788cf, 0af68c71, 0aff1ed8, 0b8f1b8a, 0d01c545, 0d283ae7, 0db159e2

## Siguiente

Sigo con batch 5 del audit (offset 60). Backfill de fotos (FRESCO-31) en pausa por cuota agotada.

---

### Basi Montes - 8/13/2026, 6:53:20 PM

## Batch 5 (60-90/816) — acumulado 90/816

***Batch 5******:****** 8 MATCH · 17 MISMATCH · 5 QUESTIONABLE***
***Acumulado (batches 1-5)******:****** 25 MATCH · 47 MISMATCH · 18 QUESTIONABLE / 90 = 52.2% mismatch***

### MISMATCH batch 5 (17)

| ID | Nombre | Problema |
| --- | --- | --- |
| 0e78a8c6 | Garbanzos con espinacas y bacalao | Ingredientes crudos, sin espinaca ni bacalao |
| 0e7cbace | Gachas dulces andaluzas | Buñuelos fritos, no gachas |
| 0ff0d4ae | Aguacate relleno de cilantro y lima | Chile relleno mexicano, sin aguacate |
| 1026051d | Setas shiitake salteadas con tamari | Curry sin champiñones visibles |
| 105a8742 | Tortilla de patatas casero ligera | Foto de packaging de pan, sin huevo |
| 10ecf707 | Espaguetis a la boloñesa | Frijoles y plátano frito, sin pasta |
| 11577d54 | Ensalada de langostinos y aguacate | Ensalada de atún y huevo, sin langostinos ni aguacate |
| 117b1cd1 | Alubias con verduras salteadas | Solo verduras salteadas, sin alubias |
| 12d9c34a | Tortilla de patatas con especias | Chips de patata en espiral, sin huevo |
| 12fcea93 | Pasta con setas con especias | Penne con pollo y berenjena, sin setas |
| 13c653e5 | Bowl de avena mediterráneo con miel | Buddha bowl salado, no avena |
| 13d46431 | Tofu a la plancha con limón/cilantro | Naan con brochetas de carne, sin tofu |
| 144e4fff | Ensalada de garbanzos con hierbas frescas | Cereal inflado con leche, nada que ver |
| 149db5b5 | Berenjenas rellenas al estilo del sur | Berenjenas crudas enteras, sin cocinar ni rellenar |
| 14b1a710 | Sopa de leche de coco con ajo asado | Chowder de almejas, sin coco |
| 14f781bf | Muesli con leche con hierbas/canela | Especias secas en cucharas, sin bowl ni muesli |
| 1538b47f | Calamares a la plancha estilo mediterráneo | Escena de cena con filete y vino, sin calamares |

### QUESTIONABLE (5)

0e4a6015, 0f3ff299, 109348ca, 11134e58, 11571307

### MATCH (8)

0f0e5cf5, 0f2b10b8, 0f5febbd, 0f7e2f19, 1065b294, 115d8ab3, 1452a43f, 154f8b38

## Siguiente

Sigo con batch 6 (offset 90). Mismatch rate estable ~50-52% en 90 muestras — patrón consistente, no ruido de muestra chica.

---

### Basi Montes - 8/13/2026, 6:57:18 PM

## Batch 6 (90-120/816) — acumulado 120/816

***Batch 6******:****** 7 MATCH · 18 MISMATCH · 5 QUESTIONABLE***
***Acumulado (batches 1-6)******:****** 32 MATCH · 65 MISMATCH · 23 QUESTIONABLE / 120 = 54.2% mismatch***

## ⚠️ Hallazgo urgente — resuelto en el momento

`17ef7f11` (Bowl de avena con hierbas frescas con canela): la foto tenía una persona real con texto visible inapropiado en la remera. No solo mismatch de plato — riesgo de marca/contenido, estaba en vivo. `foto_url`*** puesto a ****`null`**** de inmediato*** (fuera del flujo de re-búsqueda batch, ya resuelto).

### MISMATCH batch 6 (18, excluyendo el ya resuelto arriba)

| ID | Nombre | Problema |
| --- | --- | --- |
| 157b4863 | Lentejas estofadas mediterráneo | Curry de garbanzos y pollo, sin lentejas |
| 163ae5e4 | Tortilla francesa con hierbas y miel | Brunch multi-plato, no tortilla francesa |
| 166e6123 | Salteado de tofu | Gambas al vino, sin tofu |
| 167ce0f3 | Berenjenas rellenas | Plato indonesio con tempeh, sin berenjena |
| 17099b32 | Revuelto de cúrcuma y ajo con jengibre | Noodles amarillos con huevo frito, no revuelto |
| 186282f3 | Berenjena a la plancha con albahaca | Estofado de tomate y mozzarella, sin berenjena |
| 187579a4 | Poke bowl de salmón | Gambas, no salmón |
| 18b1f684 | Calamares a la plancha ligera | Calamares fritos rebozados, contradice "ligera" |
| 1adfc03c | Ensalada césar ligera | Ensalada Cobb, sin nada de césar |
| 1b764d0a | Bowl de yogur y fruta con miel | Cereal con chocolate y leche, sin yogur |
| 1bdfb9eb | Champiñones portobello a la plancha | Pollo asado con brócoli, sin champiñones |
| 1c184e30 | Tofu revuelto estilo mexicano | Tacos al pastor, sin tofu |
| 1c2c2779 | Berenjena a la plancha con albahaca picante | Carne frita con cebolla, sin berenjena |
| 1cb96dae | Ensalada de aceitunas con cilantro | Aceitunas en el árbol, no plato preparado |
| 1cd396cc | Sopa de leche de coco con limón | Sopa tipo matzah ball, sin coco |
| 1ce32808 | Lentejas estofadas con chorizo | Paella con gambas/mejillones, sin lentejas |
| 1de8cc1a | Panceta con hígado al estilo del sur | Filete de ternera con papa, sin panceta ni hígado |

### QUESTIONABLE (5)

1671514f, 185e0a79, 1b85af10, 1d4bf13a, 1e37da58

### MATCH (7)

15f261be, 17ba9a8f, 17caadea, 18ef3d22, 1ba5c75c, 1c049616, 1cfc839f

## Siguiente

Sigo con batch 7 (offset 120). Tasa de mismatch sigue estable en ~50-54% con 120 muestras — patrón confirmado, no es ruido.

---

### Basi Montes - 8/13/2026, 7:02:07 PM

## Batch 7 (120-150/816) — acumulado 150/816

***Batch 7******:****** 5 MATCH · 20 MISMATCH · 5 QUESTIONABLE***
***Acumulado (batches 1-7)******:****** 37 MATCH · 85 MISMATCH · 28 QUESTIONABLE / 150 = 56.7% mismatch***

## ⚠️ Segundo hallazgo de contenido — resuelto en el momento

`22520726` (Tostada con queso fresco con miel): frasco de miel comercial con logo/marca de terceros visible en la foto. `foto_url`*** puesto a ***`null` de inmediato, mismo criterio que `17ef7f11`.

Nota: `1fbe280b` (Estofado de cerdo) muestra manos sosteniendo el plato — no persona identificable, no se tocó (dentro de lo normal en foodphotography).

### MISMATCH batch 7 (20)

| ID | Nombre | Problema |
| --- | --- | --- |
| 1eb61c4e | Revuelto de trigueros y gambas | Steak tartare, sin huevo ni espárragos |
| 1f4d88fa | Sopa fría de melón | Sandía en rodaja, no sopa, fruta equivocada |
| 2099541d | Ensalada césar | Ensalada de remolacha en vaso, sin nada de césar |
| 20f93cf6 | Tempeh salteado con tamari y lima | Tacos al pastor con tequila, sin tempeh |
| 21fac519 | Ensalada de quinoa | Risotto de maíz, sin quinoa |
| 23a8c69b | Huevos a la mexicana | Carne frita, sin huevos |
| 23e63ffa | Ensalada de atún | Sashimi crudo, no ensalada mixta |
| 2409a18c | Sándwich de aguacate y huevo | Sándwich de pollo y queso, sin aguacate ni huevo |
| 24580167 | Bowl de avena con frutos rojos | Bowl de fruta fresca, sin avena |
| 24a8202c | Salmón al horno | Pescado blanco, no salmón (color equivocado) |
| 24c0cf25 | Merluza a la plancha | Banquete persa completo, sin pescado |
| 24de7d2b | Tofu a la plancha con limón | Foto artística de pan/aceitunas, sin tofu |
| 26349d11 | Pavo al horno con especias | Banquete de Acción de Gracias con jamón, no pavo |
| 265d65d6 | Poke bowl de salmón ligera | Ensalada verde sin salmón ni arroz |
| 266d92e0 | Tostada con salmón ahumado | Solo salmón crudo, sin tostada |
| 26a83a60 | Espinacas salteadas | Espinaca cruda, sin saltear |
| 27b62daa | Pasta con tomate | Tomates crudos en la mata, sin pasta |
| 28c03b6d | Coliflor asada con cúrcuma | Calabazas decorativas, sin coliflor |
| 29b7945b | Batido verde con canela | Porridge sin verde, no batido |

### QUESTIONABLE (5)

22a9731b, 2432ad18, 21a7e935, 1fbe280b (manos visibles, sin acción), 281acba9

### MATCH (5)

1f87f2c4, 22732018, 2285488c, 2504b5b4, 276d1386

## Siguiente

Sigo con batch 8 (offset 150). Tasa de mismatch consolidada ~55-57% con 150 muestras.

---

### Basi Montes - 8/24/2026, 12:16:16 PM

## Batch 8 (150-180/816 auditadas, base original) — acumulado 180/816

***Batch 8***: 6 MATCH · 23 MISMATCH · 1 QUESTIONABLE
***Acumulado (batches 1-8)***: 43 MATCH · 108 MISMATCH · 29 QUESTIONABLE / 180 = 60% mismatch

### MISMATCH batch 8 (23)

| ID | Nombre | Problema |
| --- | --- | --- |
| 28c03b6d | Coliflor asada con cúrcuma y comino | Calabazas decorativas, sin coliflor |
| 28c79114 | Tortitas al estilo del sur con miel | Bandeja de queso/nueces/miel, sin tortitas |
| 29b7945b | Batido verde con canela | Bowl de avena con café, no batido |
| 29c8b4f3 | Tostada de aguacate con miel | Huevo frito con pesto, sin aguacate visible ni miel |
| 29d957dd | Crema de calabaza ligera | Sopa con albóndigas, no es crema |
| 2a1417bd | Tofu a la plancha con tamari | Croquetas fritas sobre arroz, sin tofu |
| 2a1bca79 | Pasta con setas | Solo champiñones crudos, sin pasta |
| 2a51365a | Batido verde con especias | Bebida dorada tipo turmeric latte, no verde |
| 2ab46b0e | Ensalada de garbanzos | Guiso de garbanzos especiado, sin ensalada |
| 2b0dfd24 | Arroz con magro y pimientos | Bowl de arroz con champiñones, sin pimientos ni cerdo |
| 2bb3eb64 | Gambas al ajillo con guarnición | Gambas peladas simples, sin salsa de ajo ni guarnición |
| 2c550fed | Ensalada de garbanzos | Bowl de avellanas tostadas |
| 2cedf7ff | Bowl de avena con canela | Cereal tipo aros con leche, no avena |
| 2d51f060 | Tostada de aguacate con canela | Huevo frito sobre tostada, sin aguacate ni canela |
| 2da0b300 | Alubias con verduras ligera | Foto de una flor — sin comida |
| 2e1471cf | Porridge de avena con canela | Granola seca en primer plano, no porridge |
| 2e34b82d | Pollo a la plancha mediterráneo | Pollo entero asado al horno, no "a la plancha" |
| 2eb196b4 | Champiñones al ajillo con aceitunas | Bowl de aceitunas, sin champiñones |
| 2f300045 | Tostada de aguacate con miel | Mesa de desayuno genérica, sin tostada de aguacate |
| 2f558176 | Solomillo de cerdo mediterráneo ligero | Costillas BBQ glaseadas, no es "ligero" ni mediterráneo |
| 2f71b84c | Pasta con tomate mediterráneo | Un tomate solo, sin pasta |
| 2f7bcb84 | Tostada con queso fresco y miel | Sándwich fundido en manos, sin queso fresco ni miel |
| 2fdb783f | Coliflor al horno con hierbas | Mujer con flores y masa — nada que ver |

### QUESTIONABLE (1)

2d67544d (berenjena con salsa, pero no "rellena")

### MATCH (6)

2a34a85b, 2ac49906, 2c699c8c, 2dacf7be, 2f2f85fc, 302f6f62

## ⚠️ Bug de tracking detectado

`28c03b6d` y `29b7945b` de este batch 8 ya habían sido auditados y marcados MISMATCH en el batch 7 (mismo problema descrito). Causa: la paginación por `offset` sobre `recipes where foto*url is not null order by id` no es estable — el backfill de FRESCO-31 sigue corriendo en paralelo y cada foto nueva aplicada desplaza las posiciones. El "acumulado 180/816" es aproximado, no exacto; puede haber gaps sin auditar en algún punto. Recomendación para seguir: trackear por rango de `id` explícito (ej. "auditado hasta id >= X") en vez de offset, o agregar una columna `foto*auditada boolean` a `recipes`.

## Decisión de remediación (resuelta)

User decidió: `foto_url = null` en confirmados MISMATCH, para que vuelvan al pool de FRESCO-31 y se regeneren con el pipeline existente (no re-búsqueda manual por ítem).

Aplicado: ***104 recetas*** puestas a `null` (todo lo confirmado MISMATCH en batches 1-8, deduplicando los 2 ya resueltos por contenido inapropiado — `17ef7f11`, `22520726` — y los 2 duplicados del bug de tracking arriba). Verificado vía Supabase MCP antes de aplicar: 104/104 prefixes matchearon receta real, 0 ya estaban en null.

`recipes.foto_url is not null`: 871 → 767 (los QUESTIONABLE quedan sin tocar, pendientes de revisión más fina).

## Siguiente

FRESCO-31 recupera 104 recetas en su pool pendiente (233 restantes en vez de 129). Seguir auditando desde donde el bug de tracking lo permita, o esperar a que se recorra todo el catálogo de nuevo tras la próxima ronda de backfill.

---

### Basi Montes - 8/24/2026, 12:19:50 PM

## Batch 9 (tracking por rango de id, no offset) — 30 recetas

Desde este batch se trackea por `id > '<último id auditado>'` en vez de `offset`, para evitar el bug detectado en el batch 8 (offset se desfasa por el backfill de FRESCO-31 corriendo en paralelo). Rango cubierto: `305ec882` a `39cfbbe4` (30 recetas, ids ascendente).

***Batch 9***: 5 MATCH · 23 MISMATCH · 2 QUESTIONABLE

### MISMATCH (23)

| ID | Nombre | Problema |
| --- | --- | --- |
| 3120ec0d | Calamares a la plancha ligera | Bandeja de fritos variados, no es "ligera" ni a la plancha |
| 315d2422 | Muesli con leche y frutos rojos | Plato de fruta fresca cortada, sin muesli ni leche |
| 32660bdd | Berenjenas asadas con sésamo y limón | Cubos tipo tofu/halloumi con tomate, no parece berenjena |
| 32757589 | Ensalada de rúcula, pera y nueces | Nueces partidas sobre fondo blanco, sin ensalada |
| 32ced9a0 | Huevos poché con canela | Postre cremoso tipo arroz con leche, sin huevos |
| 3327228a | Tofu al curry verde con coco | Collage de bowls variados (ramen, teriyaki, curry), ninguno es tofu al curry verde |
| 336276ea | Tostada de aguacate con hierbas y miel | Canapés de pepino, sin tostada ni aguacate |
| 338afcef | Pollo en pepitoria | Foto artística de un gallo vivo — ni siquiera es comida |
| 3406beda | Poke bowl de salmón con guarnición | Gente comiendo ramen/bruschetta en mesa, no es un poke de salmón |
| 3432f7ef | Pollo a la plancha estilo casero | Pollo entero tandoori asado, no "a la plancha" |
| 345027fa | Salteado de seitan con especias ligero | Bowl de arroz biryani con carne real, contradice seitan/ligero |
| 353527c4 | Estofado de ternera con boniato | Plato de chuletas a la plancha con patatas, no es estofado |
| 35780ddb | Marmitako de bonito | Plato envuelto en hoja de plátano estilo sudeste asiático, no es guiso vasco |
| 368ddac4 | Crema de levadura nutricional con ajo | Solo dientes de ajo sobre fondo blanco, sin crema |
| 36c10971 | Batido verde con hierbas y canela | Hojas crudas en un vaso, no está licuado |
| 3724f842 | Tortilla francesa con especias y frutos rojos | Mesa exterior con crepes/quesadillas y jugos, sin tortilla ni frutos rojos |
| 3857b513 | Tempeh al horno con jengibre y cilantro | Cuadrados verdes tipo brownie de espinaca, no es tempeh |
| 3892dbb4 | Salteado de tofu estilo casero | Desayuno inglés completo con salchicha y bacon, sin tofu |
| 3899f83d | Tempeh al horno con jengibre y semillas de lino | Bowl de mazorcas de maíz asadas, sin tempeh |
| 38f95768 | Tostada de aguacate con frutos rojos | Torrija/French toast con manzana y plátano, sin aguacate |
| 39099927 | Tortilla de espárragos trigueros | Filete empanado con patatas fritas, sin espárragos ni tortilla |
| 3963916b | Berenjenas asadas con sésamo y lino | Tarta de hojaldre con verduras, no es berenjena — ***nota******:****** esta foto se aplicó hoy mismo en la tanda 32 de FRESCO-31, el fallback amplio v10 sigue sin puntería*** |
| 39cfbbe4 | Bowl de yogur y fruta con miel | Smoothie bowl verde con kiwi/fresas, es batido no yogur |

### QUESTIONABLE (2)

333b653b (kale sí, pero ensalada cruda no salteado, sin semillas de calabaza), 372c277d (tostada de aguacate confirmada, sin frutos rojos)

### MATCH (5)

305ec882, 31973a91, 33b814eb, 36f63713, 39b5e3e6

## Remediación aplicada

Mismo criterio acordado: `foto*url = null` en los 23 MISMATCH confirmados, verificado 23/23 match antes de aplicar. `recipes.foto*url is not null`: 767 → 744.

## Siguiente

Continuar batch 10 desde id > `39cfbbe4`.

---

### Basi Montes - 8/24/2026, 12:25:22 PM

## Batch 10 (id > `39cfbbe4`, 50 recetas) — acumulado 260/816 (base original, ya aproximado por el bug de tracking)

***Batch 10***: 14 MATCH · 32 MISMATCH · 4 QUESTIONABLE. Rango cubierto: `39f5506d` a `48bfc33c`.

### MISMATCH (32)

| ID | Nombre | Problema |
| --- | --- | --- |
| 39f5506d | Bowl de avena con canela | Cereal tipo bolitas con leche, no avena |
| 3a0eb6f0 | Alubias con verduras ligera | Solo vainas crudas sin cocinar, sin alubias |
| 3ae2ff65 | Muesli con leche y frutos rojos | Bowl de frambuesas y arándanos solos, sin muesli ni leche |
| 3b79db01 | Pasta con setas al estilo del sur | Hongos silvestres en tronco, sin pasta |
| 3b8f6233 | Gambas al ajillo ligera | Platos tailandeses variados, sin gambas visibles |
| 3bfec4da | Albóndigas en salsa mediterránea | Nachos/chiles volando en foto surrealista, sin albóndigas |
| 3cce9284 | Huevos revueltos con miel | Huevo frito (no revuelto), sin miel |
| 3cd9ae0f | Pisto ligero con huevo escalfado | Huevos duros con flores decorativas, sin pisto ni huevo poché |
| 3ce29b92 | Pollo al horno con especias ligero | Bandeja de biryani con pollo, plato pesado no "ligero" |
| 3e78a7df | Lasaña de verduras | Bandeja de tomates con queso rallado, sin capas de pasta |
| 3f269da9 | Tostada con jamón serrano | Foto artística de flores sobre pan, sin jamón |
| 3f6253e5 | Porridge de avena con miel | Risotto con gambas y espuma, no porridge |
| 3f8adae9 | Pollo a la plancha con especias | Pollo tandoori entero con naan, no "a la plancha" |
| 3ffba5d8 | Arroz con verduras ligera | Cucharas con arroz/lentejas sueltos, sin plato ni verduras — ***receta rellenada hoy en la tanda 31 de FRESCO-31*** |
| 400336ac | Tofu a la plancha con limón | Tabla con pomelo y quesos, sin tofu |
| 40bc5777 | Berenjenas rellenas | Bandeja de pimientos, sin berenjena |
| 4139e153 | Champiñones rellenos de ajo | Plato de pasta con queso, sin champiñones |
| 418fe22d | Gambas al ajillo al estilo del sur | Curry de pollo naranja, sin gambas |
| 420437ef | Champiñones salteados con tamari | Ajos y champiñones crudos sin cocinar |
| 429704f6 | Pavo al horno estilo casero | Patrón decorativo ilustrado de Acción de Gracias, no es foto real de comida |
| 43269fa0 | Crema de calabaza con hierbas | Dos calabazas enteras, sin crema |
| 43c0571e | Torrijas caseras | Botella de vino y bruschetta, sin torrijas |
| 44117e6c | Patatas a la riojana | Patatas baby asadas crujientes, sin guiso ni chorizo |
| 44c43290 | Sopa de calabacín y menta | Sartén salteando hierbas picadas, sin sopa |
| 454e548a | Tofu al horno con limón/lima | Porción de tarta/cheesecake con salsa, sin tofu |
| 456e2ef3 | Lentejas con costillas | Costillas BBQ con espárragos, sin lentejas |
| 4622caf1 | Mejillones al vapor con especias | Producto empaquetado al vacío, no es plato preparado |
| 46c9ca5f | Champiñones al ajillo con perejil | Un champiñón crudo solo, sin ajo ni perejil |
| 46d88cd1 | Gambas al ajillo mediterráneo | Pasta scampi con gambas y crema, no es "al ajillo" ligero |
| 4846c18c | Pollo al horno con guarnición | Alitas empanadas fritas con papas, no horneado |
| 4861222e | Crema de calabacín | Sopa naranja (color tomate), no verde como calabacín |
| 48bfc33c | Huevos poché con espárragos | Manojo de espárragos crudos, sin huevos |

### QUESTIONABLE (4)

3b02dfd6 (coles de Bruselas sí, pero envueltas en bacon, sin lima), 3f157db3 (fideuá con ostras en caldo, no el estilo típico), 4279ed8d (waffle sí, pero con sprinkles no hierbas/canela), 46bd30ec (ensalada tibia de verduras asadas, sin semillas de calabaza visibles)

### MATCH (14)

3a47551a, 3abf6e09, 3e172357, 3e2b82db, 3fdba1be, 41d1b97c, 42967db9, 43a43297, 43b94c33, 44cb928c, 4645b8ff, 46abb49e, 46d1bfd7, 4782223c

## Remediación aplicada

Mismo criterio: `foto*url = null` en los 32 confirmados MISMATCH, verificado 32/32 antes de aplicar. `recipes.foto*url is not null`: 744 → 712.

## Observación importante

Dos de las fotos rellenadas HOY MISMO por FRESCO-31 (tandas 31 y 32: `3963916b` y `3ffba5d8`) ya salieron mismatch en este audit. El fallback amplio v10 sigue produciendo resultados de baja precisión incluso en corridas frescas — no es solo deuda histórica, sigue generando trabajo nuevo para este ticket. Vale la pena evaluar si conviene pausar el backfill hasta mejorar la precisión del matching, o aceptar el ciclo actual (backfill genera → audit descarta → vuelve al pool).

## Siguiente

Continuar batch 11 desde id > `48bfc33c`.

---

### Basi Montes - 8/24/2026, 12:31:29 PM

## Batches 11-12 (id > `48bfc33c`, 100 recetas en dos tandas de 50) — acumulado ~360/816 (base original, aproximado)

***Batch 11*** (id `49037e13` a `510ed79b`, 25 recetas): 9 MATCH · 15 MISMATCH · 1 QUESTIONABLE
***Batch 12*** (id `5194026b` a `57cde3bd`, 25 recetas): 5 MATCH · 18 MISMATCH · 2 QUESTIONABLE
***Total combinado (50 recetas)***: 14 MATCH · 33 MISMATCH · 3 QUESTIONABLE

### MISMATCH (33)

| ID | Nombre | Problema |
| --- | --- | --- |
| 49037e13 | Salteado de tofu ligera | Picatostes fritos con lata de chile, sin tofu |
| 49b6594a | Tortitas con hierbas y miel | Bote de miel con croissants, sin tortitas |
| 4a39ab0b | Calabacín salteado con albahaca | Guiso de carne con canapés de pepino, sin calabacín |
| 4a4b533e | Champiñones al ajillo con semillas de calabaza | Plato elegante con almendras y crema, sin champiñones |
| 4ab858d0 | Berenjenas rellenas | Pimiento amarillo y rojo asados, sin berenjena |
| 4b13895c | Espinacas salteadas con levadura | Pollo con arroz y bok choy, sin espinacas |
| 4bb77b42 | Ensalada de garbanzos con atún | Tabulé de quinoa, sin garbanzos ni atún |
| 4d7ee658 | Repollo salteado con sésamo | Coles enteras crudas, sin saltear |
| 4de08afd | Arroz con verduras con hierbas | Bandeja de tomates gratinados, sin arroz |
| 4e55c50d | Champiñones al ajillo con cilantro | 4 champiñones crudos sobre tela, sin cocinar |
| 4e9d7703 | Alubias con verduras ligera | Plato de quinoa y patata rellena, sin alubias |
| 4ebd0f75 | Ensalada de pollo y aguacate | Ensalada con pollo, sin aguacate visible |
| 4ff2fca8 | Huevos poché con hierbas | Olla oscura con líquido burbujeante, sin huevos |
| 50ca016c | Calamares a la plancha con verduras salteadas | Vieiras (no calamares) con guarnición |
| 510ed79b | Tostada con jamón serrano y frutos rojos | Bandeja con pavo/queso, sin jamón serrano ni frutos rojos |
| 5194026b | Repollo salteado con sésamo y cilantro | Foto decorativa de col ornamental, no es plato |
| 51a197a3 | Crema fría de lima con lino | Sopa naranja (no lima/verde), sin semillas de lino |
| 51b03003 | Huevos poché mediterráneo | Huevos fritos (no poché) sobre bacon |
| 51dcfda3 | Tostada con salmón ahumado | Tostada de aguacate sin salmón visible |
| 51fd7dd1 | Albóndigas en salsa con guarnición | Plato de milanesa/bistec con guacamole, sin albóndigas |
| 52051cec | Calamares a la plancha con especias | Postre de gofres con chocolate, sin calamares |
| 5285a2fe | Mejillones al vapor mediterráneo | Mejillones crudos empaquetados en red, no plato preparado |
| 52b2d660 | Ensalada tibia de semillas de calabaza | Manos picando mango sobre arroz/cilantro, sin semillas de calabaza |
| 533dbb78 | Tostada de aguacate con especias y miel | Bandeja de desayuno con pepino y mermelada, sin aguacate |
| 53640240 | Cocido madrileño | Bistec con chimichurri y brócoli, sin garbanzos ni cocido |
| 53ba986b | Tostada con jamón serrano y frutos rojos | Panes volando con mermelada, sin jamón |
| 53d0a44d | Berenjenas asadas con sésamo y ajo | Focaccia/pan plano con semillas, no es berenjena — ***receta rellenada hoy en la tanda 31 de FRESCO-31*** |
| 5480c4db | Tostada con queso fresco y canela | Pila de rebanadas de pan sin ningún topping |
| 553a16ef | Tortitas con miel | Bote de miel con galleta y nueces, sin tortitas |
| 555e413f | Wok de tamari y jengibre con aceitunas | Plato de fideos sin aceitunas visibles |
| 55db40ed | Tortilla francesa mediterránea con frutos rojos | Bizcocho de arándanos en sartén, no es tortilla/omelette |
| 5647178f | Sopa de verduras ligera | Fideos secos y bowl de agua con hierbas, sin sopa |
| 57cde3bd | Crema fría de lima con limón | Persona comiendo sopa en restaurante, foto de acción no de plato |

### QUESTIONABLE (3)

4e7bae4c (tostada con tomate sí, sin queso fresco visible), 541f9c93 (pasta cremosa, sin champiñones visibles), 56eb55fa (jamón y rúcula sí, sin champiñones)

### MATCH (14)

4942047f, 49a07b19, 49d0dc5f, 4b299042, 4b664ad7, 4c6f94b9, 4cdc4618, 4ea26db3, 4fbddc6d, 52470b42, 5355ea37, 54ae6922, 56a5c658, 576d87e3

## Remediación aplicada

Mismo criterio: `foto*url = null` en los 33 confirmados MISMATCH, verificado 33/33 antes de aplicar. `recipes.foto*url is not null`: 712 → 679.

## Tercera confirmación del patrón de fotos frescas fallando

`53d0a44d`, rellenada HOY en la tanda 31 de FRESCO-31, es la tercera foto de esta misma sesión (junto a `3963916b` y `3ffba5d8`) que el audit confirma mismatch. Patrón consistente — el fallback amplio v10 no es solo deuda histórica.

## Siguiente

Continuar desde id > `57cde3bd`.

---


_Synced from Jira by sync-jira-issues_
