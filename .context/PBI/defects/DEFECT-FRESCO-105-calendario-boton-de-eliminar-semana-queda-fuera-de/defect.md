# DEFECT: Calendario: botón de eliminar semana queda fuera de pantalla en mobile (375px)

**Jira Key:** [FRESCO-105](https://basiliomontescastano.atlassian.net/browse/FRESCO-105)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `app/(app)/calendar/page.tsx` (header `flex items-center justify-between` con `h1` + `WeekNavigation` + `DeleteWeekButton`)
- Viewport 375×812 (mobile), `/calendar` con un menú generado.
- El botón de eliminar semana (ícono papelera) queda casi totalmente fuera del viewport: `getBoundingClientRect().x = 374.6` sobre un ancho de pantalla de 375px.
- `document.body.scrollWidth` (411px) supera `window.innerWidth` (375px) — la página entera gana un scroll horizontal no deseado de 36px.
- ***Evidencia***: screenshot `calendar-mobile-375.png` (no se ve el ícono de papelera junto a "3–9 AGO"); confirmado con `getBoundingClientRect()` + `document.body.scrollWidth`.

## Por qué importa

En la práctica, la acción de "eliminar semana" es inalcanzable en mobile sin provocar ese scroll horizontal accidental. Es la única forma de eliminar un menú semanal y queda efectivamente oculta en el viewport más común (375px).

## Alcance

Todos los controles del header (`h1` + `WeekNavigation` + `DeleteWeekButton`) deberían caber o reorganizarse (wrap) dentro de los 375px de ancho, sin generar scroll horizontal en la página.

## Cómo reproducir

1. Configurar viewport a 375×812.
2. Ir a `/calendar` con un menú generado para la semana.
3. Inspeccionar la posición del botón de eliminar semana (ícono papelera) junto al header: `getBoundingClientRect().x = 374.6` vs. ancho de pantalla 375px.
4. Verificar `document.body.scrollWidth` = 411px vs. `window.innerWidth` = 375px.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
