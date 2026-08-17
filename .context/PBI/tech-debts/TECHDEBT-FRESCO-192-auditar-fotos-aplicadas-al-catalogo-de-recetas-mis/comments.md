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


_Synced from Jira by sync-jira-issues_
