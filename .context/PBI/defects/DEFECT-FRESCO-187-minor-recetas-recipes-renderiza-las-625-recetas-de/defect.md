# DEFECT: [MINOR] Recetas: /recipes renderiza las 625 recetas del catálogo sin paginación ni virtualización

**Jira Key:** [FRESCO-187](https://basiliomontescastano.atlassian.net/browse/FRESCO-187)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

***Severidad******:****** MINOR***

***Dónde***: página `/recipes`

## Observado

No existe ningún trigger de "cargar más"/infinite-scroll en `/recipes` — las 625 recetas están todas presentes en el DOM de una sola vez. Por contraste, la sección "Últimas recetas añadidas" de `/menu` sí implementa un botón "Ver recetas siguientes" funcional que agrega de a poco.

## Impacto

Riesgo de escalabilidad/performance en el catálogo principal a medida que crezca el número de recetas.

---

## Metadata

- **Created:** 8/11/2026
- **Updated:** 8/17/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
