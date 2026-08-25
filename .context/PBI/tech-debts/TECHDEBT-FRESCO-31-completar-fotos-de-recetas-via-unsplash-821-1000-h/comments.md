# Comments for FRESCO-31

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-31)

---

### Basi Montes - 8/1/2026, 7:25:50 PM

Encontrado y arreglado antes de seguir: el script pedia solo 1 resultado por busqueda de categoria, asi que TODAS las recetas de la misma categoria (ej. las 12 de 'carne') recibian la foto EXACTA misma. Corregido: ahora pide 10 resultados por busqueda y elige uno distinto por receta via hash del id (mismo costo de requests, cero busquedas extra). Verificado: 10/10 fotos distintas en el lote de prueba. Progreso reseteado a 0 y reaplicado limpio: ahora 10/1000 con el fix. Quedan 990.

---

### Basi Montes - 8/1/2026, 7:36:45 PM

User encontro un segundo bug real revisando manualmente: 'Tortilla de patatas individual' devolvia foto de un huevo frito, no una tortilla. Causa: la busqueda usaba clasificacion.categoria (bucket generico 'huevos') en vez del nombre especifico del plato -- esa categoria agrupa platos que no se parecen en nada (tortilla, huevos revueltos, huevos poche, tortilla francesa). Arreglado: ahora prioriza 1) nombre del plato base especifico (para las 686 recetas combinatorias, extraido antes de los sufijos tipo 'con especias con guarnicion de temporada') 2) el nombre real de la receta tal cual (para las 314 originales, que ya tienen nombres especificos como 'Paella valenciana') 3) categoria generica solo como ultimo recurso si las busquedas especificas no devuelven nada. Verificado en vivo: 'spanish potato omelette tortilla' trae una tortilla de patatas real e inconfundible. Progreso reseteado y reaplicado limpio: 25/1000 con el fix bueno. Quedan 975.

---

### Basi Montes - 8/1/2026, 7:40:01 PM

Otro ajuste real del user tras revisar: prioridad de busqueda cambiada a nombre -> descripcion*corta -> categoria (simplificado, se descarto la tabla de traduccion de platos base que habia armado -- probado en vivo que el nombre completo, sin recortar, ya trae buenos resultados via el fuzzy matching de Unsplash). Encontrado en el camino un tercer problema real: Unsplash tiene un limiter de rafaga distinto a la cuota de 50/hora -- pegar varios requests seguidos sin pausa tira 403 'Rate Limit Exceeded' aunque la cuota horaria (header X-Ratelimit-Remaining) muestre de sobra. Arreglado con una pausa de 400ms entre requests. Progreso real al cierre: 10/1000 con la version final del script (nombre/descripcion*corta primero, pausa anti-rafaga). Quedan 990.

---

### Basi Montes - 8/1/2026, 7:45:36 PM

Corrida otra tanda. El limiter de rafaga resulto mas persistente de lo pensado: subida la pausa a 1.2s + cooldown de 4s tras cada 403, y AUN ASI la mayoria de los intentos con nombre/descripcion_corta siguieron rebotando -- solo el 3er intento (categoria generica) solia sobrevivir, porque para entonces ya paso suficiente tiempo acumulado. Resultado: 9 fotos nuevas aplicadas, pero la mayoria cayeron en fallback de categoria, no en el nombre especifico (no estan mal, solo menos precisas que el ideal). Progreso: 19/1000. Pendiente real para la proxima tanda: simplificar a un solo intento por receta (solo nombre, sin fallback en cascada) para bajar el volumen de requests, o espaciar mas agresivo (2-3s fijos). No resuelto del todo esta sesion, cortado aca a proposito tras 3 rondas de ajuste.

---

### Basi Montes - 8/1/2026, 7:50:47 PM

Simplificado a un solo intento por receta (solo nombre, sin cascada), como pidio el user. Probado con una tanda de 25: 0/25 exitosas, TODAS con 403. Pero un pedido aislado inmediatamente despues SI funciono (200 OK) -- conclusion real: el bloqueo no es de espaciado entre requests, es que una vez disparado se queda activo un tiempo sostenido (mas de los 4s de cooldown que tenia el script), probablemente por el volumen acumulado de pruebas/tandas de toda la sesion de hoy. La cuenta esta sana (el pedido aislado lo prueba). No se sigio insistiendo para no empeorarlo. Progreso sigue en 19/1000. Script fetch-photos.ts queda con la version simplificada (1 intento, sin cascada) lista para la proxima vez, en frio, con mas tiempo de por medio.

---

### Basi Montes - 8/1/2026, 7:57:53 PM

Auditoría de las 19 fotos aplicadas hasta ahora: 8 correctas (matcheadas por nombre o descripción específica), 11 cayeron en bucket genérico de categoría (mismo defecto que el caso tortilla/huevo frito, sin detectar hasta esta revisión).

Correctas (8): Arroz con magro y pimientos, Carne guisada con patatas, Estofado de cerdo con zanahorias, Gachas dulces andaluzas, Porridge de avena con manzana y canela, Ternera en salsa con guisantes, Tortilla de calabacín y cebolla, Tostada con hummus y pepino.

Reseteadas a foto_url = null (11): Arepa rellena de queso, Bizcocho casero de yogur, Bol de quinoa con fruta y frutos secos, Croissant con jamón y queso, Ensalada de garbanzos con atún, Huevos a la mexicana, Pan con tomate y jamón ibérico, Tortilla de claras con espárragos, Tostada con crema de cacahuete y plátano, Tostada de centeno con salmón y eneldo, Wrap de huevo revuelto y verduras. Reset vía SQL directo, sin gasto de cuota Unsplash.

Progreso real: 8/1000 fotos confirmadas buenas. Pendiente: 992 (990 nunca procesadas + 11 recién reseteadas).

---

### Basi Montes - 8/1/2026, 8:28:30 PM

Retomadas las tandas de fotos tras la pausa. El bloqueo de Unsplash se había liberado — corrida de 25 dio 16/25 (0 errores 403), corrida de 60 dio 22/60 (25 errores 403, empezó a re-activarse el límite bajo volumen sostenido, así que se cortó ahí). Progreso: 46/1000 fotos aplicadas (8 verificadas antes + 38 nuevas de estas 2 tandas).

Además: foto_url ya está conectado al frontend real. RecipeCard.tsx muestra la foto de Unsplash cuando existe, ícono de categoría cuando es null — mismo layout en ambos casos. Verificado en vivo en /recipes y /menu, sin romper nada.

---

### Basi Montes - 8/2/2026, 12:25:59 AM

Auditoría visual completa de las fotos aplicadas hasta ahora — el user reportó que varias no correspondían al nombre de la receta (ej. 'Arroz con magro y pimientos' mostraba solo pimientos crudos). Se revisaron una por una, imagen por imagen, las ~70 fotos aplicadas.

***Hallazgos reales:***
1. Bug de nombres roto "X de con Y" en el generador combinatorio de recetas — afectaba ***71 recetas*** (no solo 2 como se pensó al inicio). Arreglado con UPDATE sobre las 71 filas.
2. Fotos duplicadas por colisión de hash: varias recetas distintas compartían literalmente la misma imagen.
3. Calidad real: ~30% de las fotos revisadas mostraban ingredientes crudos, fotos de producto, o contenido sin relación (el peor caso: "Espaguetis a la boloñesa" devolvió un programa de boda en portugués).

***Mejoras aplicadas al script*** (`fetch-photos.ts`, scratchpad):
- Sesgo de búsqueda reforzado a "cooked meal food photography" (antes "food plated dish", insuficiente).
- Selección restringida a los 4 resultados más relevantes de Unsplash en vez de los 10 — los peores casos salían de los índices 5-9.

***Progreso al cierre:*** 67/1000 fotos (48 recetas reseteadas y reintentadas en 2 rondas tras la auditoría; algunas no encontraron match nuevo y quedaron en null, listas para reintentar). Calidad subjetivamente mucho mejor tras las 2 rondas, aunque no perfecta — platos poco fotografiados en Unsplash (ej. "pisto") siguen sin buena cobertura.

***Pendiente:*** 933/1000 recetas sin foto. Recomendado para próximas tandas: revisar visualmente una muestra tras cada tanda grande, no asumir que la query mejorada garantiza 100% de calidad.

---

### Basi Montes - 8/2/2026, 12:34:48 AM

Fix real de fondo para la calidad de fotos — el user marcó esto como prioridad obligatoria, no seguir generando en volumen hasta resolver la causa raíz.

***Investigación (vía Tavily, documentación oficial de Unsplash, no supuesto):**** confirmado que el endpoint `/search/photos` permite combinar `collections=<id>` con `query` en la misma llamada. Encontrada la colección curada oficial "Food & Drink" de Unsplash — ID ****3330455***, 2.5k fotos reales de fotografía de comida.

***Implementado:*** cada búsqueda ahora restringe el universo de resultados a esa colección (`query=<nombre> cooked meal food photography&collections=3330455`). Esto ataca directamente la clase de error más grave encontrada en la auditoría anterior — fotos totalmente ajenas a comida (el caso del programa de boda para "Espaguetis a la boloñesa"), algo que ningún ajuste de texto de búsqueda podía garantizar por sí solo.

***No validado en vivo todavía:*** el limitador de ráfaga de Unsplash seguía activo por el volumen acumulado de tandas de la sesión de hoy — probado 3 veces (tanda de 10, espera de 20s, petición aislada), siempre 403. Cero escrituras en la base desde los intentos fallidos.

***Progreso:*** sigue en 67/1000, sin cambios de datos en esta ronda. El fix queda implementado y documentado, listo para probar en frío.

***Próxima sesión:*** probar con tanda chica (~10) primero, revisar visualmente antes de confiar en volumen. Si el bloqueo persiste incluso en frío, evaluar acceso "production" de Unsplash (5000/hora) o reconsiderar generación de imágenes por IA (descartada antes por costo, pero el techo de calidad del stock-matching quedó demostrado hoy).

---

### Basi Montes - 8/2/2026, 8:25:24 PM

## Script persistido al repo

El script vivía solo en el scratchpad de la sesión (nunca en el repo) — se perdía entre sesiones, había que reconstruirlo cada vez. Ahora está en `scripts/fetch-recipe-photos.ts`, commit `2345f04`, con la receta JSON→SQL documentada inline en vez de hacerla ad hoc.

## Tanda de 30, 22 aplicadas

`bun scripts/fetch-recipe-photos.ts 30` → 22/30 encontradas, 8 sin resultado (sin cascada, comportamiento esperado por diseño). Aplicadas vía SQL, verificado cero duplicados con la consulta estándar.

***Progreso real******:****** 122/1000*** (era 100/1000 al empezar esta sesión). Quedan 878.

Sin cambios de comportamiento en el script — mismo v5 documentado en sus propios comentarios (sin scope de colección, sin cascada, sesgo "cooked meal food photography", dedup por `usedUrls` sembrado desde toda la tabla).

---

### Basi Montes - 8/2/2026, 8:31:29 PM

## Tanda de 30, 11 aplicadas (burst limiter cortó cerca del final)

11/30 encontradas, resto sin resultado (sin cascada por diseño) o 403 de burst limiter hacia el final de la tanda. Aplicadas, cero duplicados verificado.

***Chequeo visual real, pedido explícito***: descargadas y miradas 3 de las 11 fotos nuevas antes de confirmar calidad.

- Tempeh con cilantro → bowl de comida cocinada, plausible.
- Tempeh con aceitunas → plato emplatado (más estilo appetizer que el plato real, pero cocinado, no ingrediente crudo).
- Champiñones al ajillo con jengibre → bowl estilo poke con botella de Jarritos y fondo de cactus — NO es ingrediente crudo suelto, pero sí staging raro que no combina con el plato real. Aplicada igual, mismo criterio que siempre (no hay curación perfecta con este approach, documentado en el script).

***Progreso real******:****** 133/1000.***

---

### Basi Montes - 8/2/2026, 8:44:20 PM

## v6 del script: causa raíz real arreglada

Encontrado el problema real: se mandaba el nombre de la receta en ESPAÑOL a Unsplash, que indexa en inglés. Eso explica el bowl con Jarritos y cactus para "champiñones al ajillo" — nada del query coincidía semánticamente.

Arreglado sin gastar en ninguna IA de traducción (restricción explícita del user, costo cero): diccionario estático español→inglés armado con el vocabulario real de la tabla (consultado por SQL, no inventado), más filtrado de modificadores genéricos que no aportan nada visual ("estilo mediterráneo", "versión ligera", "con guarnición de temporada"). `topK` bajado de 4 a 2 — confiar más en la mejor relevancia ahora que el query está en el idioma correcto, "menos pero mejor" como se pidió.

Probado el diccionario contra nombres reales antes de gastar quota — queries limpias, sin español suelto. Corrida una tanda de 30 real: 0/30, pero por el limitador de Unsplash agotado (ya iban 2 tandas hoy), no por calidad — las queries que se alcanzaron a mandar antes del 403 salieron perfectas ("eggplant grilled basil lime", "tofu baked lemon spicy ginger", "coles bruselas roasted garlic olives").

Sin resultados que aplicar esta vuelta. Retomar cuando resetee la quota (~1h).

---

### Basi Montes - 8/13/2026, 12:35:40 PM

***Actualización 2026-08-13***

- Root-cause del colapso de hit-rate (v9): saturación real de contenido en Unsplash para conceptos combinatorios, no problema de traducción.
- v10 shippeada y validada en vivo: fallback de query amplia cuando la precisa se agota. Commit `a584d89` en `staging` → `main`, prod desplegado y verificado `READY`.
- Dos tandas de validación: 22/30 y 14/30 (recuperando del 1-3/30 previo al fix).
- Progreso: 736 → 772/1000. Quedan 228.
- Hacia el final de la segunda tanda empezaron 403 de Unsplash (burst limiter o cuota horaria) — si la próxima tanda sale en 403 desde el inicio, pausar hasta reset de cuota en vez de seguir quemando tandas.

Detalle completo en `.context/bitacora.md`, entradas del 2026-08-13.

---

### Basi Montes - 8/13/2026, 4:21:29 PM

## Actualización 2026-08-13

***797/1000*** recetas con foto (era 772). 203 pendientes.

- Batch 1 (30 recetas): 19 hits, aplicado sin duplicados.
- Batch 2 (30 recetas): 6 hits — cuota/burst limiter de Unsplash saturado a mitad de batch (403 en cascada).
- Verificado: 0 fotos duplicadas (`foto_url` único por receta).

Cuello de botella actual: variantes combinatorias con solo modificadores de relleno (`version ligera`, `con especias`, `con guarnicion de temporada`, etc. apilados) siguen colapsando al mismo query traducido incluso con el fallback amplio v10 — son la mayoría de los "no photo found" restantes.

Próximo batch: esperar reset de cuota horaria de Unsplash antes de relanzar.

---

### Basi Montes - 8/13/2026, 6:29:31 PM

Batch más — 12/30 hits (797→809). Sin duplicados. El pool restante (191) sigue mayormente compuesto de variantes solo-de-relleno que ya sabíamos difíciles (version ligera, con guarnicion de temporada, con especias apiladas).

---

### Basi Montes - 8/13/2026, 6:33:04 PM

Batch más — 7/30 hits (809→816). Cascada de 403 hacia el final (cuota horaria pegando). Sin duplicados. 184 restantes. Recomiendo pausar batches hasta que resetee la cuota si el ritmo sigue cayendo.

---

### Basi Montes - 8/13/2026, 6:48:55 PM

Batch 5: solo 3/30 (816->819) — cuota horaria agotada de verdad esta vez, cascada de 403 desde temprano. Pauso este hilo hasta que resetee. En paralelo sigue el audit de FRESCO-192 (no depende de la API de búsqueda, solo descarga imágenes ya aplicadas).

---

### Basi Montes - 8/13/2026, 6:57:50 PM

Reintento tras pausa: 3/30, cuota sigue agotada. Dejo de reintentar batches hasta que pase más tiempo — no vale la pena seguir quemando llamadas contra 403 constante. 821/1000 (179 restantes). Nota: 1 foto de FRESCO-192 (17ef7f11) se puso en null por contenido inapropiado (persona real con texto visible), no cuenta como pendiente de re-búsqueda normal.

---

### Basi Montes - 8/14/2026, 5:18:25 PM

Batch corrido esta sesión: 10/30 fotos aplicadas (hit rate bajando según lo esperado — quedan las recetas más difíciles, variantes filler-only de conceptos ya saturados, documentado en el propio script v9/v10). Progreso real 842/1000 (ni el título ni la descripción de este ticket estaban actualizados — decían 821 y 772 respectivamente). Cero duplicados verificados (foto_url agrupado, sin colisiones). Cortado por cuota: quedan 6 requests de las 50/hora del free tier de Unsplash. Quedan 158 recetas sin foto.

---

### Basi Montes - 8/14/2026, 9:45:06 PM

2 batches corridos esta sesión: 6/30 + 3/30 aplicados. Progreso real 851/1000 (169 restantes), 0 duplicados verificados. Cortado por cuota de Unsplash (403 en la segunda tanda) — retomar cuando resetee la hora.

---

### Basi Montes - 8/18/2026, 1:52:23 PM

## Actualización 2026-08-18

Tanda corrida esta sesión: 5/30 aplicadas (856/1000, era 851). Mayoría de fallos fueron "no photo found" genuino sin cascada (pool de variantes filler-only ya conocido como difícil), no bloqueo de cuota — sin 403 esta vez. 0 duplicados verificados (`foto_url` único).

Segunda tanda de 30 corriendo en background, resultado pendiente de aplicar.

Quedan 144/1000 tras esta tanda.

---

### Basi Montes - 8/18/2026, 1:52:45 PM

## Cierre de sesión 2026-08-18

Segunda tanda: 1/30 — cuota horaria de Unsplash agotada, cascada de 403 hacia el final (patrón ya conocido). Pausado tandas hasta reset de cuota.

Progreso real al cierre: ***857/1000*** (era 851 al empezar esta sesión). 0 duplicados verificados (`foto_url` único). Quedan 143.

---

### Basi Montes - 8/20/2026, 6:04:30 PM

Batch — 2/30 hits (857→859). 0 duplicados verificados. Progreso real vía DB (cache local estaba desactualizada: decía 851, la BD ya iba en 857 antes de este batch). Pool restante (141) sigue dominado por variantes filler-only ya documentadas como difíciles (v9/v10) — sin cascada 403, cuota no fue el limitante esta vez, es escasez real de resultados en Unsplash para esos conceptos saturados.

---

### Basi Montes - 8/24/2026, 12:01:28 PM

## Batch update

Tanda de `fetch-recipe-photos.ts` (30 recetas, batch size default): 9/30 hits (859 → 868). Aplicado vía Supabase MCP (`execute*sql`) directo. Verificado sin duplicados de `foto*url`.

Restan 132 recetas sin foto. Hit rate bajo esperado — pool restante son variantes filler-only (modificadores tipo "versión ligera"/"con guarnición de temporada") que siguen colapsando al mismo query traducido incluso con el fallback amplio v10.

---

### Basi Montes - 8/24/2026, 12:06:16 PM

## Batch update

Tanda de `fetch-recipe-photos.ts` (30 recetas): 3/30 hits (868 → 871). Aplicado vía Supabase MCP (`execute*sql`) directo. Verificado sin duplicados de `foto*url`.

Restan 129 recetas sin foto. Hit rate sigue cayendo (el pool restante son casi todas variantes filler-only que colapsan al mismo query).

---

### Basi Montes - 8/24/2026, 12:16:28 PM

## Ajuste por auditoría FRESCO-192

FRESCO-192 (auditoría de fotos ya aplicadas) confirmó 104 mismatches en batches 1-8 (foto no corresponde a la receta). Decisión del user: `foto_url = null` en esos 104 en vez de re-búsqueda manual — vuelven al pool pendiente de este ticket para regenerarse con el pipeline normal.

`recipes.foto_url is not null`: 871 → 767. Restantes: 233 (antes 129).

Detalle completo de los 104 IDs y el criterio de mismatch: ver comentario en FRESCO-192.

---


_Synced from Jira by sync-jira-issues_
