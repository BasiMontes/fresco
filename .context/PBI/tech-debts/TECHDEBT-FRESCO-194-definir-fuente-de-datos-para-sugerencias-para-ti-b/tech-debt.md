# Tarea: Definir fuente de datos para "Sugerencias para ti" + badge "Nuevo" en lista de compra

**Jira Key:** [FRESCO-194](https://basiliomontescastano.atlassian.net/browse/FRESCO-194)
**Status:** Listo
**Type:** Tarea

---

## Description

## Qué

El mockup de FRESCO-191 (Stitch, screenshot + HTML en la tarjeta) trae dos elementos que quedaron fuera de la implementación por falta de dato real:

- Carrusel "Sugerencias para ti": 3 cards (icono, nombre, precio, botón "+ Añadir") con scroll horizontal.
- Badge "Nuevo" en el primer ítem de una categoría.

## Por qué quedó afuera

Ninguno tiene una fuente de datos real hoy:

- No existe concepto de "sugerido" en el modelo — ni recetas frecuentes, ni favoritos vinculados a ingredientes faltantes, ni catálogo de "cosas que sueles comprar".
- No hay tracking de recencia en `shopping_lists` — cada lista se genera de cero por semana, sin diff contra la anterior, así que no hay señal de "esto es nuevo desde la última vez".

## Necesita definir antes de implementar

1. Qué significa "sugerido": ¿ingredientes de recetas favoritas que faltan en la lista actual? ¿ítems recurrentes en listas pasadas (requeriría guardar historial)? ¿catálogo random?
2. Si hace falta persistir algo nuevo (ej. comparar contra la lista anterior del mismo usuario) para el badge "Nuevo".
3. El botón "+ Añadir" del carrusel necesita una acción real de añadir ítem suelto a la lista — hoy la lista solo se genera completa desde el menú semanal, no hay "añadir ítem manual".

## Referencia

Mismo mockup que FRESCO-191: `screen*fresco*lista*realista*moderna.png` / `code*fresco*lista*realista*moderna.html` (adjuntos en esa tarjeta).

---

## Fields

### Clasificación

0|i0018n:

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=4}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":4,"lastUpdated":"2026-08-14T20:34:34.000+0200","stateCount":4,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"GitHub":{"count":2,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":2,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/14/2026
- **Updated:** 8/14/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
