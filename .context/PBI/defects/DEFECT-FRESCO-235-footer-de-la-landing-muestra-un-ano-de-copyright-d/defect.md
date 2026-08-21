# DEFECT: Footer de la landing muestra un año de copyright desactualizado (2025)

**Jira Key:** [FRESCO-235](https://basiliomontescastano.atlassian.net/browse/FRESCO-235)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

El footer de la landing pública (`/`) muestra "© 2025 Fresco · Hecho con cariño (y muchas lentejas)" — el año está fijo (hardcodeado), no se calcula dinámicamente, así que ya no coincide con el año real.

## Por qué importa

Cosmético, baja severidad, pero es visible en la primera pantalla que ve cualquier visitante nuevo — un detalle así puede leerse como dejadez/abandono del sitio.

## Alcance

Reemplazar el año fijo del footer por `new Date().getFullYear()` (o equivalente), para que no vuelva a quedar desactualizado.

## Cómo reproducir

1. Visitar `/` sin sesión (o con sesión, el footer es el mismo).
2. Bajar hasta el final de la página.
3. Leer el texto de copyright.

## Evidencia

Encontrado en vivo con Playwright CLI contra staging (`fresco-pre.vercel.app`) durante el barrido QA sistemático del 2026-08-19. Ver `.context/qa/regression.feature` (nueva sección "Landing pública (/)", escenario "El copyright del footer muestra un año desactualizado").

---

## Metadata

- **Created:** 8/19/2026
- **Updated:** 8/19/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
