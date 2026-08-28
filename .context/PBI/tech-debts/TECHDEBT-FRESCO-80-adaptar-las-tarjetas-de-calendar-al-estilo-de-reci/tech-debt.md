# Tarea: Adaptar las tarjetas de /calendar al estilo de RecipeCard (foto, tag, meta)

**Jira Key:** [FRESCO-80](https://basiliomontescastano.atlassian.net/browse/FRESCO-80)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Pedido

Adaptar las tarjetas de receta de `/calendar` (grilla semanal) al mismo componente/estilo visual usado en `/menu` — foto (o placeholder por categoría), categoría, título, tag de dieta, meta (tiempo/dificultad) — en vez del formato compacto actual (solo ícono + nombre en una línea).

## Estado actual (evidencia real)

`components/calendar/calendar-grid.tsx`, `SlotCell` (líneas 342-437): cada slot es una fila compacta — ícono de categoría (`RecipeSlotIcon`, 14px) + nombre de la receta en una línea, sin foto, sin tag de dieta, sin meta de tiempo/dificultad. El propio comentario del componente ya documenta la razón de esto a propósito (líneas 439-444): **"this grid's 7-column width has no room for **`RecipeCard`**'s full image-area treatment, so this is the compact version"** — es un trade-off consciente de densidad (7 días visibles a la vez), no un descuido.

Cada columna de día es `w-64` (256px), con 3 slots apilados (desayuno/comida/cena) dentro de esa columna, en una fila con scroll horizontal (`overflow-x-auto`).

## Complejidad real a tener en cuenta (no resuelta acá, para la sesión de implementación)

- ***Drag and drop***: cada slot es un nodo `@dnd-kit` (`useDraggable` + `useDroppable`) con un handle dedicado (`GripVertical`) — al crecer la card con imagen, hay que decidir dónde va el handle y que el área de imagen no interfiera con el gesto de arrastre.
- ***Botones de marcar cocinado/descartado***: hoy están apilados debajo de la fila compacta (decisión ya tomada a propósito por un hallazgo en vivo — ver comentario líneas 392-398, colapsaban contra el nombre de la receta compitiendo por ancho). Necesitan un lugar real en el nuevo layout.
- ***Altura de columna***: si cada slot crece a tamaño `RecipeCard` (imagen 4:3 + texto), la columna del día se alarga bastante — puede necesitar su propio scroll vertical, o aceptar columnas más altas.
- ***Ancho de columna***: `w-64` (256px) es más angosto que el `w-60` (240px) que usan las cards de "hoy"/"Últimas recetas" en `/menu` — hay margen para igualar, pero confirmar con mockup/referencia antes de fijar el ancho final.

## Referencia

`components/recipe/recipe-card.tsx` (`RecipeCard`) — mismo componente ya usado en `/menu` (hoy + últimas recetas), `/recipes` y `/favoritos`.

---

## Fields

### Clasificación

0|i000jj:

### customfield_10000

{deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-05T22:36:26.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, repository={count=3, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":3,"lastUpdated":"2026-08-06T00:35:09.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":3,"name":"GitHub"},"GitHub":{"count":3,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-06T00:36:26.000+0200","topEnvironments":[{"lastUpdated":"2026-08-05T22:36:26.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
