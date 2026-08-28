# DEFECT: Calendario: la columna DESAYUNO/COMIDA/CENA se mueve al hacer scroll horizontal (móvil y escritorio)

**Jira Key:** [FRESCO-271](https://basiliomontescastano.atlassian.net/browse/FRESCO-271)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Contexto

Reporte del usuario (grabación de pantalla, 26 ago 2026, `fresco-dev.vercel.app/calendar`): al hacer scroll horizontal en el calendario semanal, la columna de etiquetas de comida ("DESAYUNO", "COMIDA", "CENA") también se mueve en vez de quedarse fija. Reportado tanto en móvil como en escritorio.

Esto ***no es un hallazgo nuevo de arquitectura*** — es la tercera vez que este síntoma exacto se reporta:

- ***FRESCO-170***: primer intento. CSS Grid con `gridAutoFlow: column` hace que `position: sticky; left: 0` no funcione (el "containing block" de cada label es su propia celda de ~90px, no la fila completa como en una `<table>`). Se sustituyó por una sincronización manual: en cada evento `scroll` del contenedor, se aplica `translateX(scrollLeft)` a cada label vía DOM directo.
- ***FRESCO-222***: el fix de FRESCO-170 se notaba igual en móvil — el evento `scroll` se dispara mucho más despacio que el compositor durante el scroll por inercia táctil, así que la label quedaba un frame por detrás y se leía como "se mueve". Se cambió a `requestAnimationFrame` leyendo `scrollLeft` en cada frame de pintado, en vez de esperar al evento `scroll`.

Verificado en código el 26 ago 2026 (`components/calendar/calendar-grid.tsx`, líneas ~121-177): el fix de FRESCO-222 sigue en HEAD, es el código actualmente desplegado en `dev` (el propio comentario documenta ambos fixes con detalle).

***Intenté reproducir con la grabación aportada*** (extraje frames a 1fps del vídeo completo y a 8fps en la ventana exacta del scroll) y en todos los frames que pude inspeccionar la etiqueta "DESAYUNO" se mantiene en la misma posición horizontal — no logré confirmar visualmente el desplazamiento a partir de los frames extraídos. Eso no significa que no ocurra: puede ser un desajuste de un frame muy puntual (justo lo que FRESCO-222 ya intentó cerrar) que un muestreo a 8fps no captura, o un caso nuevo (drag-and-drop de una tarjeta en vez de scroll simple, velocidad de scroll distinta, u otra ruta de scroll que no pasa por el mismo listener).

## Solución propuesta

No asumir causa ni tocar código todavía — dos fixes previos ya apuntaron a este síntoma exacto y no lo resolvieron del todo según este reporte. Reproducir en vivo primero (Playwright con captura de frames durante el scroll, o grabación a más fps que la aportada) para confirmar si es:

1. Una regresión real del mecanismo rAF de FRESCO-222 (algo lo dejó de ejecutar, o un handler nuevo interfiere), o
2. Un caso no cubierto por el fix (p. ej. arrastrar una tarjeta con dnd-kit dispara su propio auto-scroll, que quizá no dispara el mismo `scroll`/rAF loop), o
3. Un jank puntual de un frame que técnicamente sigue existiendo pero es mucho más raro que antes de FRESCO-222.

## Plan de acción

1. Reproducir en vivo (`fresco-dev.vercel.app/calendar`, móvil y escritorio) con Playwright, capturando frames durante el scroll a alta frecuencia (o `page.video()` a más fps que una grabación de pantalla estándar).
2. Si se reproduce arrastrando una tarjeta (dnd-kit) en vez de con scroll simple: revisar si el auto-scroll de `dnd-kit` mueve `scrollerRef` por una vía que no dispara el mismo bucle de `requestAnimationFrame`.
3. Si se reproduce con scroll simple: instrumentar (`console.log` temporal o Performance panel) el desfase real entre `scroller.scrollLeft` y `label.style.transform` frame a frame.
4. Solo entonces aplicar el fix — con la causa confirmada, no repitiendo el patrón de las dos iteraciones anteriores.

---

## Metadata

- **Created:** 8/26/2026
- **Updated:** 8/26/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-dojo

---

_Synced from Jira by sync-jira-issues_
