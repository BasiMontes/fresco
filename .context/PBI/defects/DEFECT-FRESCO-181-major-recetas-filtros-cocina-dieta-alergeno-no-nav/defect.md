# DEFECT: [MAJOR] Recetas: filtros (Cocina/Dieta/Alérgeno) no navegables con flechas de teclado, rompe patrón ARIA listbox

**Jira Key:** [FRESCO-181](https://basiliomontescastano.atlassian.net/browse/FRESCO-181)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

***Severidad******:****** MAJOR***

***Dónde***: componente Dropdown usado en `/recipes` (el mismo rediseñado en FRESCO-160)

## Pasos para reproducir

1. En `/recipes`, abrir cualquier filtro (ej. "Filtrar por cocina") con teclado/click
2. Presionar flecha abajo/arriba

## Esperado

Navegación completa por teclado en los 3 filtros (Cocina: 8 opciones, Dieta: 7, Alérgeno: 7) sin depender de Tab secuencial.

## Observado

Las flechas no hacen nada — ninguna opción recibe foco/highlight. La única forma de moverse es Tab, y cada Tab solo llega a la **siguiente** opción en secuencia (cada opción es su propio tab-stop en vez de un listbox con roving-tabindex) — presionar flecha abajo con una opción enfocada mueve el foco al botón disparador del **siguiente filtro**, cerrando el dropdown actual sin querer.

El dropdown sí usa roles ARIA reales `listbox`/`option` (no un `<select>` nativo — el rediseño de FRESCO-160 sigue en pie), pero no implementa el patrón de teclado estándar WAI-ARIA listbox (flecha arriba/abajo mueve la opción activa, Enter/Espacio selecciona, Escape cierra devolviendo foco al trigger).

Escape sí funciona correctamente. La selección por mouse funciona bien (filtros combinan correctamente en AND).

## Impacto

Usuario de solo-teclado o lector de pantalla no puede operar los filtros eficientemente.

---

## Metadata

- **Created:** 8/11/2026
- **Updated:** 8/17/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
