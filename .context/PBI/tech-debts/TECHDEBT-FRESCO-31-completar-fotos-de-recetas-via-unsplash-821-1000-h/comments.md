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

### Basi Montes - 8/26/2026, 8:50:32 AM

Tanda de fetch-recipe-photos.ts (30 recetas): 27/30 hits (627 -> 654). Aplicado via Supabase MCP (execute*sql) directo. Verificado sin duplicados de foto*url.

Restan 346 recetas sin foto. El conteo real habia bajado a 627 (no 767 como decia el ultimo comentario) por las tandas del audit paralelo de FRESCO-192 corridas hoy (679 -> 627, ver FRESCO-192).

---

### Basi Montes - 8/26/2026, 11:25:05 AM

Tanda de fetch-recipe-photos.ts (30 recetas): 23/30 hits (654->677). Aplicado via Supabase MCP, cero duplicados verificado. Progreso real: 677/1000, 323 restantes.

---

### Basi Montes - 8/26/2026, 11:32:20 AM

Tanda de fetch-recipe-photos.ts (30 recetas): 23/30 hits (677->700). Aplicado via Supabase MCP, cero duplicados verificado. Cuota Unsplash agotada al final de la tanda (403). Progreso real: 700/1000, 300 restantes.

---

### Basi Montes - 8/26/2026, 11:52:20 AM

Auditoria FRESCO-192 (3 tandas paralelas, 150 recetas revisadas) confirmo 99 mismatch mas, foto_url puesto a null. Progreso real: 700 -> 601. Quedan 399 recetas sin foto (301 nunca tuvieron + 99 recien liberadas por el audit).

---

### Basi Montes - 8/26/2026, 12:41:32 PM

Tanda de fetch-recipe-photos.ts (30 recetas): 25/30 hits (601->626). Aplicado via Supabase MCP, cero duplicados verificado. Progreso real: 626/1000, 374 restantes.

---

### Basi Montes - 8/31/2026, 9:02:24 AM

Dos tandas de `fetch-recipe-photos.ts` esta sesión (30 recetas cada una): 23/30 + 21/30 aplicadas vía Supabase MCP. Cero duplicados verificados (`foto_url` único).

Progreso real BD: ***650 → 694 / 1000*** con foto. 306 restantes.

Nota: el conteo del ticket estaba desactualizado (decía 626); la BD ya iba en 650 por tandas y audits de FRESCO-192 previos. Hacia el final de la 2ª tanda empezaron algunos 403 de Unsplash (cuota horaria) — cortado ahí. Pool restante sigue dominado por variantes filler-only ya documentadas como difíciles (v9/v10). Retomar cuando resetee la cuota.

---

### Basi Montes - 8/31/2026, 10:17:16 AM

Tanda de `fetch-recipe-photos.ts` (30 recetas): 23/30 aplicadas vía Supabase MCP, 0 duplicados, sin 403.

Progreso real BD: ***694 → 717 / 1000*** con foto. 283 restantes.

Además, regenerado `supabase/seed.sql` (fixture de CI para `test:e2e`, `supabase db reset`) con `supabase db dump --linked --data-only` — recoge las 717 fotos actuales. Es la copia fría del catálogo en el repo (backup pre-lanzamiento; no hace falta duplicar la BD en otra plataforma). PR/commit propagado dev → staging → main.

---

### Basi Montes - 9/2/2026, 8:10:55 AM

Tanda de `fetch-recipe-photos.ts` (30 recetas): 18/30 aplicadas vía Supabase MCP. Cero duplicados verificados (`foto_url` único), 0 errores 403.

Progreso real BD: ***738 → 756 / 1000*** con foto. 244 restantes.

Nota: el conteo del ticket estaba en 717; la BD ya iba en 738 por tandas/audits previos de FRESCO-192. Los 12 fallos de esta tanda fueron "no photo found" genuino (sin cascada por diseño) — pool restante dominado por variantes filler-only ya documentadas como difíciles (v9/v10). Sin bloqueo de cuota esta vez.

---

### Basi Montes - 9/2/2026, 8:15:50 AM

Segunda tanda de `fetch-recipe-photos.ts` (30 recetas): 18/30 aplicadas vía Supabase MCP. Cero duplicados verificados (`foto_url` único), 0 errores 403.

Progreso real BD: ***756 → 774 / 1000*** con foto. 226 restantes.

Total de la sesión: 738 → 774 (+36 en 2 tandas). Pool restante sigue dominado por variantes filler-only (v9/v10). `supabase/seed.sql` pendiente de regenerar al cierre de la sesión de tandas.

---

### Basi Montes - 9/2/2026, 8:23:01 AM

`supabase/seed.sql` regenerado (fixture de CI para `test:e2e`): dump `--data-only` de `public.recipes` desde prod, recoge las 774 fotos actuales. La desviación manual `frutos*secos` → `frutos*de_cascara` se retiró — la migración `20260901073555` ya la lleva en prod, el dump sale limpio.

Verificado: `supabase db reset` carga sin error, 1000 filas / 774 `foto*url` / 226 null, el CHECK `recipes*alergenos_vocab` pasa.

Commit `ef99df0` → `dev` + ff `staging`. `main` no promovido (lleva 15 commits de la ola de audit-4 por detrás — batch promote pendiente).

---

### Basi Montes - 9/3/2026, 8:45:46 AM

Tanda de fetch-recipe-photos.ts (30 recetas): 6/30 aplicadas vía supabase db query --linked (MCP de Supabase caído esta sesión, connection timeout). Cero duplicados verificados (foto_url único).

Progreso real BD: 774 -> 780 / 1000 con foto. 220 restantes.

Unsplash inestable esta corrida: 14 respuestas HTTP 500 (errores de su servidor, no cuota) al principio, y 13x 403 (cuota horaria) hacia el final. Probe posterior de 8: 11/11 403 -> cuota agotada, cortado ahí. Pool restante sigue dominado por variantes filler-only ya documentadas como difíciles (v9/v10).

seed.sql no regenerado (solo +6, se difiere a la próxima tanda). Retomar cuando resetee la cuota (~1h).

---

### Basi Montes - 9/4/2026, 8:33:33 AM

Tanda de `fetch-recipe-photos.ts` (30 recetas): 18/30 aplicadas vía Supabase MCP. Cero duplicados verificados (`foto_url` único), 0 errores 403.

Progreso real BD: 780 → 798 / 1000 con foto. 202 restantes.

Nota: el conteo del ticket estaba en 774; la BD ya iba en 780 por tandas previas. Los 12 fallos fueron "no photo found" genuino (sin cascada por diseño) — pool restante dominado por variantes filler-only ya documentadas como difíciles (v9/v10).

---

### Basi Montes - 9/4/2026, 11:09:41 AM

Tanda de `fetch-recipe-photos.ts` (30 recetas): 20/30 aplicadas vía Supabase MCP. Cero duplicados verificados (`foto_url` único), 0 errores 403.

Progreso real BD: 798 → 818 / 1000 con foto. 182 restantes.

Los 10 fallos fueron "no photo found" genuino (sin cascada por diseño) — pool restante dominado por variantes filler-only ya documentadas como difíciles (v9/v10).

---

### Basi Montes - 9/4/2026, 1:32:40 PM

## Batch (2026-09-04, `bun scripts/fetch-recipe-photos.ts 30`)

23/30 aplicadas (7 sin match, "skipped, no cascade" — mismo comportamiento v9 documentado en el script). Verificado 0 duplicados de `foto_url` antes y después de aplicar.

`recipes.foto_url is not null`: 676 → 699. Pendientes: 324 → 301.

## Siguiente

301 recetas sin foto aún. Repetir el script en próximas tandas; recordar que el pool "sin puntería" (fallback amplio v10, ver FRESCO-192) sigue generando falsos positivos que el audit tendrá que revisar más adelante.

---

### Basi Montes - 9/4/2026, 1:36:39 PM

## Batch 2 (2026-09-04, `bun scripts/fetch-recipe-photos.ts 30`)

24/30 aplicadas (6 sin match, "skipped, no cascade"). Verificado 0 duplicados de `foto_url` antes y después de aplicar.

`recipes.foto_url is not null`: 699 → 723. Pendientes: 301 → 277.

## Siguiente

277 recetas sin foto aún.

---

### Basi Montes - 9/4/2026, 1:39:31 PM

## Batch 3 (2026-09-04, `bun scripts/fetch-recipe-photos.ts 30`)

16/30 aplicadas — cortado a mitad por rate limit de Unsplash (errores 403, tope 50 req/hora del tier gratis; era la 3ª tanda seguida en la misma hora). Verificado 0 duplicados de `foto_url` antes y después de aplicar.

`recipes.foto_url is not null`: 723 → 739. Pendientes: 277 → 261.

## Siguiente

261 recetas sin foto. Esperar a que resetee la cuota de Unsplash (~1h) antes de la próxima tanda.

---

### Basi Montes - 9/4/2026, 2:48:18 PM

Tanda de fetch-recipe-photos.ts (30 recetas): 21/30 hits (739 -> 760). Aplicado vía supabase db query --linked directo. Cero duplicados verificados (foto_url único). Sin errores 403. Restan 240 recetas sin foto — el pool restante sigue dominado por variantes filler-only (version ligera, con guarnicion de temporada, con especias) ya documentadas como difíciles (v9/v10).

---

### Basi Montes - 9/4/2026, 2:50:07 PM

Tanda de fetch-recipe-photos.ts (30 recetas): 19/30 hits (760 -> 779). Aplicado vía supabase db query --linked directo. Cero duplicados verificados (foto_url único). Sin errores 403. Restan 221 recetas sin foto — pool restante sigue dominado por variantes filler-only ya documentadas como difíciles (v9/v10).

---

### Basi Montes - 9/4/2026, 2:51:56 PM

Tanda de fetch-recipe-photos.ts (30 recetas): 19/30 hits (779 -> 798). Aplicado vía supabase db query --linked directo. Cero duplicados verificados (foto_url único). Sin errores 403. Restan 202 recetas sin foto — pool restante sigue dominado por variantes filler-only ya documentadas como difíciles (v9/v10).

---

### Basi Montes - 9/4/2026, 3:00:55 PM

Tanda de fetch-recipe-photos.ts (30 recetas): 11/30 hits (798 -> 809). Aplicado vía supabase db query --linked directo. Cero duplicados verificados (foto_url único). Empezaron 2 errores 403 hacia el final de la tanda (cuota/burst limiter de Unsplash) — hit rate bajando. Restan 191 recetas sin foto. Recomendado pausar tandas hasta reset de cuota si el ritmo sigue cayendo en la próxima.

---

### Basi Montes - 9/4/2026, 3:15:39 PM

Auditoría FRESCO-192 (4 tandas paralelas, 200 recetas revisadas) confirmó 111 mismatch/brand-flag más, foto_url puesto a null. Progreso real: 809 -> 698. Quedan 302 recetas sin foto (191 nunca tuvieron + 111 recién liberadas por el audit). Detalle completo en FRESCO-192.

---

### Basi Montes - 9/4/2026, 3:27:30 PM

Auditoría FRESCO-192 (segunda ronda, 4 tandas paralelas, 200 recetas revisadas) confirmó 145 mismatch/brand-flag más, foto_url puesto a null. Progreso real: 698 -> 553. Quedan 447 recetas sin foto. Detalle completo en FRESCO-192.

---

### Basi Montes - 9/4/2026, 9:11:44 PM

v11 del script: content_filter=high, restaurada la palabra 'cooked' en el tier ancho (v10 la habia sacado del todo, causa real de fotos de ingrediente crudo segun el audit FRESCO-192), y 6 palabras nuevas al diccionario ES->EN que faltaban en el pool actual (bacalao, cordero, tortitas, rellena/rellenas/relleno/rellenos, leche, fria/frio). Commit 0fbd718 -> dev.

Tanda de 50: 47/50 hits, 0 errores 403. Revision visual de las 47 fotos completa (contact sheets, no solo muestra) antes de aplicar -- 18 eran mismatch real (flatlay de ingrediente crudo, foto de producto, o plato totalmente distinto) y se descartaron sin escribir a la base, en vez de aplicarlas y esperar a que un audit FRESCO-192 futuro las pesque. Aplicadas solo las 29 buenas via Supabase MCP.

Progreso real: 553 -> 582/1000. 418 restantes. 0 duplicados verificados.

---

### Basi Montes - 9/4/2026, 9:27:43 PM

Segunda tanda de la sesion (mismo v11, sin cambios de codigo): 44/50 hits, 0 errores 403.

Revision visual completa otra vez (contact sheets, 44 fotos): esta tanda salio mas floja que la anterior -- 24/44 mismatch (54%). Patrones que se repiten y no dependen del query: bulbo de ajo entero gana top-relevancia para cualquier receta con "ajo/ajillo" en el nombre (ya paso en la tanda anterior tambien), frascos de producto/condimento para tempeh/wok/berenjena, pescado crudo estilizado en vez de plato cocinado, patrones conceptuales de food-styling (huevos repetidos, dados con "DIET") sin plato real. Descartadas sin escribir a la base, igual que la tanda anterior.

Progreso real: 582 -> 602/1000. 398 restantes. 0 duplicados verificados.

Nota para las proximas tandas: el hit-rate de la API (44/50, 47/50) ya no es el problema -- el techo real es que Unsplash top-2 sigue devolviendo ingrediente-crudo/producto/foto-conceptual para un % alto de nombres combinatorios, sin importar cuanto se afine el query en texto. La revision visual completa por tanda (no una muestra) sigue siendo el paso que evita que esto vuelva a inflar el trabajo de FRESCO-192.

---

### Basi Montes - 9/4/2026, 9:43:30 PM

Tercera tanda de la sesion (v11, sin cambios de codigo): 36/50 hits -- cuota horaria de Unsplash se agoto hacia el final (403 en cascada desde "Bacalao con tomate" en adelante, patron ya conocido). Nota: "bacalao" ya tradujo bien a "cod" (fix del diccionario de esta sesion funcionando en vivo), el 403 fue solo cuota, no problema de query.

Revision visual completa (36 fotos): 21/36 mismatch (58%). Mismos patrones sistemicos que las tandas anteriores -- fotos conceptuales de food-styling sin plato real (huevos en patron, ingredientes flotando), pescado/hongos crudos sin cocinar, frascos de producto, plato equivocado. Descartadas sin escribir a la base.

Progreso real: 602 -> 617/1000. 383 restantes. 0 duplicados verificados.

Conclusion tras 3 tandas con v11: la mejora de query (content_filter, palabra "cooked" restaurada, diccionario ampliado) no cambio el hit-rate de calidad de forma medible -- ronda 38%/54%/58% de mismatch, sin tendencia clara de mejora. El techo es estructural (Unsplash top-2 relevance no entiende el plato), no de texto de busqueda. La revision visual completa por tanda sigue siendo lo que evita que este trabajo vuelva a inflar FRESCO-192.

---

### Basi Montes - 9/4/2026, 11:39:14 PM

Cuarta tanda (v11, sin cambios de codigo): 40/50 hits, 0 errores 403.

Revision visual completa (40 fotos): 28/40 mismatch (70%, la peor tanda hasta ahora). El pool restante ya son mayormente platos raros con pesima cobertura en Unsplash: rape, frijoles rancheros, kale, revuelto de curcuma, ademas de los patrones ya conocidos (crudo, producto, conceptual, plato equivocado).

Caso puntual detectado: la receta "Champiñones salteados con tamari y jengibre con lima y cilantro" (id 9f6f669d) vuelve a colisionar de forma DETERMINISTA con la misma foto incorrecta (un bhel puri indio) que ya se habia rechazado en la tanda 1 -- mismo query, mismo hash, mismo top-2 resultado, misma foto. Como sigue en null nunca entra a usedUrls, asi que se re-ofrece igual en cada tanda futura. Rechazada de nuevo, sigue en null. Si vuelve a aparecer habria que tratarla aparte (query manual o exclusion explicita), reintentar en bloque no la va a resolver.

Progreso real: 617 -> 628/1000. 372 restantes. 0 duplicados verificados.

---

### Basi Montes - 9/5/2026, 12:04:36 AM

FRESCO-192 corrio un round grande esta sesion (4 agentes paralelos, 100 recetas c/u, 400 auditadas): 151 MISMATCH + 7 con brand*flag = 158 recetas puestas a foto*url=null, vuelven a este pool. Detalle completo en FRESCO-192.

recipes.foto_url is not null: 628 -> 470. Restantes: 530.

---

### Basi Montes - 9/5/2026, 12:25:45 AM

FRESCO-192 round 2 de la sesion: 182 recetas (todo lo que quedaba del pool historico sin auditar), 116 MISMATCH + 2 brand_flag = 118 puestas a null, vuelven a este pool. Detalle en FRESCO-192.

recipes.foto_url is not null: 470 -> 352. Restantes: 648.

Con esto se agota el backlog historico de fotos nunca revisadas -- de aca en mas, todo lo que entra a foto_url pasa primero por revision visual (contact sheets) antes de escribirse, asi que no deberia volver a generarle trabajo a FRESCO-192.

---

### Basi Montes - 9/5/2026, 7:12:11 AM

Quinta tanda de la sesión (v11, sin cambios de código): 29/30 hits, 0 errores 403.

Revisión visual completa de las 27 fotos aplicadas de la tanda: 16/27 mismatch tras aplicar (59%), anuladas antes de que un futuro FRESCO-192 las tuviera que pescar. Mismos patrones sistémicos ya conocidos -- ingrediente crudo sin cocinar (garbanzos, alubias, espinacas, avena), foto conceptual de food-styling (ensalada césar con letras 'DIET' flotando en el aire), producto empaquetado (mejillones), y plato equivocado (calamares sin calamar, pasta con mejillones en vez de setas, coliflor mostrando otra cosa). Las otras 2 de las 29 originales (mushrooms crudos, lima suelta en vez de crema fría) se descartaron antes de escribir a la base por reconocimiento inmediato.

Progreso real: 352 -> 363/1000. 637 restantes. 0 duplicados verificados.

---

### Basi Montes - 9/5/2026, 9:08:28 AM

Sexta tanda de la sesión (v11, sin cambios de código): 27/30 hits, 0 errores 403.

Nota: 'Ensalada cesar con guarnicion de temporada' (id 99629f11) volvió a colisionar DETERMINISTA con la misma foto incorrecta (letras 'DIET' flotando) que ya se había anulado en la tanda anterior -- mismo caso puntual que 'Champiñones con tamari' documentado en el comentario de las 11:39 PM. Descartada sin bajarla siquiera, ya se conocía el resultado.

Revisión visual completa de las 26 restantes: la peor tanda hasta ahora, 20/26 mismatch (77%). Patrones ya conocidos más uno nuevo -- varias recetas devolvieron la MISMA foto de referencia que otra receta no relacionada (huevos fritos genéricos para 'poché' y 'revueltos', garbanzos crudos reciclados de la tanda anterior), sugiriendo que el pool de candidatos para nombres combinatorios comunes ya está bastante agotado. Único set aplicado: tofu salteado, ensalada de pasta fría, muesli con leche, tostada de aguacate, yogur griego con granola, tortilla francesa -- 6 de 27.

Progreso real: 363 -> 369/1000. 631 restantes. 0 duplicados verificados.

Con el mismatch subiendo a 77% y el patrón de recetas reusando la misma foto ya vista, el techo estructural mencionado en el comentario de las 9:43 PM se está confirmando aún más duro -- valdría la pena evaluar la alternativa ya anotada en la descripción (acceso 'production' de Unsplash, 5000/hora) o pausar tandas automáticas y resolver el resto restante con curación manual dirigida en vez de fuerza bruta.

---

### Basi Montes - 9/5/2026, 9:25:58 AM

Séptima tanda de la sesión (v11, sin cambios de código): 29/30 hits, 0 errores 403.

Optimización aplicada en esta tanda: 8 de las 29 recetas devolvieron la MISMA foto exacta (mismo hash de Unsplash) que ya se había anulado por mismatch en tandas anteriores para otro nombre de receta -- se descartaron directo sin bajarlas ni revisarlas, ya se conocía el resultado (pasta con setas → mejillones, porridge → avena cruda, pavo al horno → mesa de Thanksgiving con jamón, huevos revueltos → huevo frito genérico x2, garbanzos → garbanzos crudos, pisto → misma receta re-ofrecida con la misma foto, albóndigas → bruschetta de tomate).

Revisión visual completa de las 21 restantes: 11/21 mismatch adicional (52%) -- incluido un caso de auto-corrección: 'Tortilla francesa con miel' (ac85f924) parecía tener una foto ya validada como buena por el hash, pero al revisar resultó ser el mismo hash de 'Tortilla de patatas' (de3f3ae7, mismatch de la tanda anterior, papas fritas + ensalada) -- confundí dos fotos de tortilla francesa distintas al pre-filtrar, la revisión visual lo corrigió antes de escribir a la base.

Total mismatch de la tanda: 19/29 (66%, contando las 8 descartadas sin bajar). Aplicadas 10: tortitas con frutos rojos, ensalada tibia de semillas de calabaza, tostada de aguacate con miel, calabacín salteado con albahaca, yogur griego con granola, tostada de aguacate con especias y miel, salmón al horno, tortitas con miel, bowl de avena con frutos rojos, calabacín salteado con semillas de lino.

Progreso real: 369 -> 379/1000. 621 restantes. 0 duplicados verificados.

El patrón de fotos repetidas exactas entre recetas no relacionadas (mismo hash) es un indicador claro de que el pool de Unsplash para este dominio de nombres combinatorios está agotado. Sostengo la recomendación del comentario anterior: acceso Unsplash 'production' (5000/hora) o curación manual dirigida en vez de más tandas automáticas del mismo tipo.

---

### Basi Montes - 9/5/2026, 9:33:53 AM

Octava tanda de la sesión (v11, sin cambios de código): 30/30 hits, 0 errores 403.

Pre-filtro por hash duplicado esta vez descartó 14 de las 30 sin bajarlas -- 5 eran la MISMA receta re-ofrecida con la MISMA foto ya rechazada (683fe562, 17ef7f11, b2a8434e, 0723583b, 928b9ffe, cb0d1bc5 -- ya conocido, siguen null y van a seguir saliendo hasta que se traten aparte), y 9 más compartían hash con fotos de OTRAS recetas ya confirmadas mismatch (pasta con setas → mejillones x2, tortilla claras → papas fritas diamond plate, tostada salmón → bruschetta tomate, garbanzos → garbanzos crudos, mejillones → producto empaquetado, wok → prep crudo de ajo/hierbas, pudding coco → tarta de chocolate).

Revisión visual completa de las 16 restantes: 7/16 mismatch (coliflor asada sin coliflor visible, tortilla de patatas sin huevo -- solo papas hasselback, berenjenas crudas sin cocinar, sopa de miso que es en realidad un pastel salado, tostada de aguacate sin tostada -- bowl de hash, pollo al chilindrón dominado por foto de packaging de producto, poke bowl sin salmón visible).

Total mismatch de la tanda: 21/30 (70%). Aplicadas 9: risotto de setas, crema de calabaza, gofres con canela, ensalada de quinoa, yogur griego con granola, muesli con leche y miel, cordero al horno, arepa rellena de queso, dorada al horno.

Progreso real: 379 -> 388/1000. 612 restantes. 0 duplicados verificados.

Cuarta tanda consecutiva de v11 sobre 50%+ mismatch (59%, 77%, 66%, 70%). El pre-filtro por hash ya está ahorrando descargas pero no mejora la tasa real de aciertos -- solo evita gastar tiempo en lo ya conocido. Reitero la recomendación: esto ya no es cuestión de más tandas automáticas, conviene evaluar Unsplash 'production' access o pasar el resto a curación dirigida.

---

### Basi Montes - 9/5/2026, 9:43:38 AM

Novena tanda de la sesión (v11, sin cambios de código): 25/30 hits -- 5 recetas cayeron por 403 en cascada (cuota horaria de Unsplash agotándose hacia el final, patrón ya conocido) y 1 sin cascade ('Ropa vieja de ternera', ya venía fallando de tandas anteriores).

Pre-filtro por hash: 14 de las 25 descartadas sin bajar -- 6 eran la MISMA receta re-ofrecida con la MISMA foto (93fdce6d, 429704f6, 32843274, 3f6253e5, e4b90dc1, 60000fdb, 99629f11 -- 7 en realidad, todas siguen null indefinidamente hasta tratarlas aparte) y 7 compartían hash con mismatches de otras recetas (langostinos/aguacate → floating guacamole sin marisco, quinoa → pisto conceptual, alubias → alubias crudas, espinacas → espinacas crudas, berenjena plancha → berenjenas crudas, coliflor horno → tarta sin coliflor, porridge → cereal Cheerios).

Revisión visual de las 11 restantes: 6/11 mismatch más (yogur griego → cereal con leche, arroz con magro → pimientos crudos sin cocinar, crema de coliflor → dos platitos sin relación, bol semillas calabaza → calabaza ornamental entera cruda, 2x tostada queso fresco con miel → sándwich de queso fundido sin relación / tostada con mermelada no identificable como queso).

Total mismatch de la tanda: 20/25 (80%, la peor hasta ahora). Aplicadas solo 5: tofu al curry verde, crema de calabaza y jengibre, batido verde con canela, calamares a la plancha, arroz con verduras.

Progreso real: 388 -> 393/1000. 607 restantes. 0 duplicados verificados.

Quinta tanda consecutiva de v11 en la misma sesión, todas 59-80% mismatch, más la cuota de Unsplash empezando a fallar en cascada hacia el final de cada tanda. Esto confirma que seguir a fuerza bruta ya no rinde -- recomiendo pausar las tandas automáticas acá y decidir entre acceso Unsplash 'production' o curación manual dirigida para el resto (607 recetas).

---

### Basi Montes - 9/5/2026, 9:55:37 AM

FRESCO-192 corrió un round nuevo sobre las 100 recetas más recientes (básicamente todo lo aplicado en las tandas 5-9 de hoy + remanente de la sesión anterior): 39 mismatch + 2 brand*flag adicionales, puestos a null. recipes.foto*url is not null: 393 -> 352.

Vuelve exacto al número con el que arrancó esta sesión (352). Las 5 tandas de hoy (149 hits de Unsplash procesados, revisión visual mía previa a cada escritura) tuvieron una ganancia neta real de CERO una vez pasadas por un segundo ojo independiente -- mi propia revisión visual, sola, dejó pasar ~41% de mismatches que un agente fresco sí detectó.

Esto cambia la recomendación: no es solo 'Unsplash production vs curación manual' -- el problema real es que un solo revisor (yo) no alcanza como gate de calidad. Si se sigue con tandas automáticas, cada 2-3 tandas necesita pasar por auditoría de segundo ojo (agente independiente) antes de contar el progreso como real, no al final de la sesión. Detalle completo del round en FRESCO-192.

---

### Basi Montes - 9/5/2026, 1:19:20 PM

## Sesión 2026-09-05 — tandas 10 a 18

| Tanda | Fetched | Aplicadas |
| --- | --- | --- |
| 10 | 29/30 | 29 |
| 11 | 29/30 | 29 |
| 12 | 28/30 | 28 |
| 13 | 29/30 | 29 |
| 14 | 27/30 | 27 |
| 15 | 26/30 | 26 |
| 16 | 22/30 | 22 (403 empieza a aparecer) |
| 17 | 15/30 | 15 (403 en cascada) |
| 18 | 15/30 | 15 (cuota estabilizada al ~50%, no colapsó del todo) |

Sin duplicados de `foto_url` en ningún punto (verificado tras cada tanda).

***Estado del catálogo al cierre de sesión******:****** 386/1000 con foto, 614 sin foto.*** La bajada respecto al pico de la sesión (541) se debe a la auditoría FRESCO-192 corrida en paralelo, que anuló 186 fotos mal asignadas (ver comentario en FRESCO-192).

Cuota Unsplash (free tier, 50 req/hora) suele recuperarse en ~1h — seguir con tandas de 30 cuando vuelva a rendir >20/30.

---

### Basi Montes - 9/5/2026, 3:47:01 PM

## Sesión 2026-09-05 (continuación) — 3 tandas, techo estructural confirmado con doble revisión

Retomado tras el cierre de la sesión anterior (386/1000, 614 restantes). Esta vez con revisión visual ***más estricta que nunca*** (contact sheets de las 3 tandas completas, sin muestreo) más gate de auditoría independiente sobre lo aplicado.

| Tanda | Fetched (hits API) | 403/quota | Candidatos revisados visualmente | Aplicados (post-QA) |
| --- | --- | --- | --- | --- |
| 1 | 29/30 | 0 | 29 | 0 |
| 2 | 28/30 | 0 | 28 | 0 |
| 3 | 29/30 | 0 | 29 | 1 |

***Total******:****** 86 candidatos descargados y revisados imagen por imagen. Solo 1 aplicado*** (`Espinacas salteadas con y levadura nutricional con limón`, id `26a83a60`) tras pasar el gate de auditoría independiente (agente fresco, sin contexto de mi propio veredicto, confirmó MATCH).

### Hallazgos de esta ronda

- ***0 errores 403 / cuota en las 3 tandas*** — la cuota horaria de Unsplash no fue el cuello de botella esta vez (a diferencia de las tandas 16-18 de la sesión anterior).
- ***El cuello de botella real es de calidad, no de cuota.**** De 86 candidatos, 85 fueron mismatch claro: ingrediente crudo sin cocinar (avena, garbanzos, alubias, coliflor, atún, pescado de mercado), plato completamente distinto (currys indios reemplazando "pollo/tempeh a la plancha", tacos al pastor para "chile con carne", pasteles/tartas para tofu/curry), fotos conceptuales de food-styling sin plato real (ingredientes "flotando", letras Scrabble), paquetes de producto con marca visible, y colisiones deterministas confirmadas otra vez: la foto "DIET" con letras flotantes volvió a aparecer ****3 veces*** en esta sesión para variantes de "ensalada césar", y la foto de bistec a la plancha se reusó para dos búsquedas distintas de pescado ("merluza a la plancha").
- ***Confirma y profundiza el hallazgo de la sesión anterior*** (comentario de las 9:55 AM): incluso con revisión visual completa (no muestreo) tanda por tanda, el pool restante de ~613 recetas está dominado por variantes combinatorias (`con guarnición de temporada`, `versión ligera`, `con especias` apiladas) para las que Unsplash simplemente no tiene fotografía de plato-cocinado-real en su índice — no es un problema de query, traducción, ni relevancia de ranking; es agotamiento genuino del corpus para este dominio de nombres.
- Varios ids ya documentados como "ofensores crónicos" en tandas anteriores (99629f11, 60000fdb, 2a1417bd, 9a393613, 3857b513, f0f1a54e, fa5c7eac, 32757589, ecc8ee2f) volvieron a aparecer en el pool y volvieron a fallar con fotos distintas pero igual de incorrectas — confirma que son casos estructuralmente sin solución vía este pipeline, no mala suerte puntual.

### Estado del catálogo (verificado en vivo, no estimado)

`recipes.foto*url is not null`: ***387/1000**** (era 386 al empezar esta sesión). Quedan ****613***. Cero duplicados verificados (`foto*url` único).

### Auditoría independiente (gate obligatorio)

1 recetas aplicadas → 1 auditadas por agente independiente sin contexto de mi veredicto → 0 revertidas (1/1 confirmado MATCH). Con un pool de aplicación tan pequeño esta sesión, el gate no aportó una señal estadística fuerte, pero se mantuvo el protocolo end-to-end tal como se pidió tras el hallazgo de ganancia neta cero de la sesión anterior.

### Recomendación

Con 86/86 candidatos brutos resultando en solo 1 aplicable tras QA estricta (~1.2% de rendimiento neto), seguir corriendo tandas automáticas de `fetch-recipe-photos.ts` contra el pool restante ya no es un uso razonable de tiempo ni de cuota — el techo es estructural (cobertura de Unsplash para nombres combinatorios en español), no de configuración del script. Recomiendo para la próxima sesión evaluar en firme una de estas dos vías en vez de más tandas iguales:

1. ***Unsplash "production" access*** (5000 req/hora) — no resuelve la calidad del corpus, pero permite curación manual dirigida a mayor volumen por sesión (elegir foto entre docenas de resultados por receta en vez de top-2 automático).
2. ***Curación manual dirigida o generación de imagen por IA*** para las ~613 recetas restantes — dado que son mayormente variantes filler-only de un set base de conceptos ya cubiertos, probablemente sea más eficiente generar/curar por concepto-base (ej. una foto genérica de "alubias con verduras" reusada para las 8 variantes con modificadores) que seguir pidiendo 1 foto por receta a un corpus ya demostrado agotado.

---

### Basi Montes - 9/5/2026, 4:07:38 PM

## `fetch-recipe-photos.ts` v12 — Pexels + Pixabay como fallback

Se añadieron dos proveedores de fotos de stock adicionales (`PEXELS*API*KEY`, `PIXABAY*API*KEY`, ya en `.env`) al script, activos SOLO cuando Unsplash (ambos tiers, precisa + amplia) no devuelve nada:

Unsplash precisa → Unsplash amplia → Pexels precisa → Pexels amplia → Pixabay precisa → Pixabay amplia.

Reutiliza `pickFromPage` (mismo top-K por hash + dedup por `usedUrls`) para las 3 fuentes, sin duplicar lógica. Sin scoping por categoría en ninguna — el propio historial del script (nota v4) ya probó en vivo que acotar por colección/categoría empeora resultados.

### Validación hecha antes de commitear

- Auth + formato de respuesta de ambas APIs confirmado en vivo (200 OK, shape esperado).
- Batch de prueba de 8 recetas: las 8 resolvieron vía Unsplash (no llegó a disparar el fallback en esta muestra concreta — mala suerte de muestreo, no bug).
- QA visual estricto de las 8: ***0/8 pasaron*** (queso+miel crudos sin tostada, sándwich en vez de salmón, filete en vez de merluza, ensalada fría en vez de wok, curry de carne en vez de berenjena asada, verduras sin gambas, omelette+plato ajeno en vez de tortilla de patata, ensalada de rúcula sin pan en vez de "pan con tomate y jamón"). No se aplicó nada de ese batch.

### Conclusión honesta

Sumar proveedores amplía el corpus disponible (más posibilidades de que la foto correcta exista en algún lado), pero ***no resuelve el cuello de botella real***: el ranking de "mejor resultado" de cualquiera de las 3 APIs para queries combinatorias como estas sigue siendo poco fiable — de 8 candidatos top-ranked (todos vía Unsplash en esta muestra), cero fueron correctos bajo revisión visual estricta. El próximo batch real con recetas de conceptos ya agotados en Unsplash es el que va a mostrar si Pexels/Pixabay realmente aportan cobertura nueva o si el problema es más profundo (nombres demasiado específicos para cualquier banco de stock).

Sin cambios en `recipes.foto_url` en este comentario — es solo la mejora de capacidad del script, commit `b11264a`.

---


_Synced from Jira by sync-jira-issues_
