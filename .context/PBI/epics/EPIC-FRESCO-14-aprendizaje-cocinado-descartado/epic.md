# EPIC: Aprendizaje Cocinado/Descartado

**Jira Key:** [FRESCO-14](https://basiliomontescastano.atlassian.net/browse/FRESCO-14)
**Priority:** Medium
**Status:** Listo
**Total Story Points:** 0

---

## Description

Cubre la interfaz para que cualquier usuaria marque cada plato de su menú semanal como cocinado, descartado, o cambiado por otra receta, alimentando el mecanismo de aprendizaje cocinado/descartado. El backend (la función de actualización de estado y el disparador de aprendizaje en base de datos) ya está completo y probado; hoy no existe ninguna interfaz — ni en el calendario ni en la tarjeta de receta — desde la que registrar este estado.

El registro del toggle es universal para todos los niveles (Free y Pro); lo que difiere es la aplicación de ese historial a la generación futura, que solo ocurre para usuarias Pro y solo cuando existen al menos dos semanas de historial real — esa aplicación queda gateada en el tiempo y es una capacidad futura, separada de esta historia fundacional. Depende de Generación de Menú (FRESCO-6) — necesita un menú generado y persistido para poder marcar sus platos.

Valor de negocio: es el primer paso operativo del moat de aprendizaje que sostiene el precio de Pro; sin el registro, la aplicación posterior del historial no tiene datos que leer (pasos del recorrido de Laura como usuaria Free y Pro).

---

## User Stories

| Key | Story | Points | Priority | Status |
| --- | ----- | ------ | -------- | ------ |
| [FRESCO-15](https://basiliomontescastano.atlassian.net/browse/FRESCO-15) | Aprendizaje | Marcar un plato del menú como cocinado o descartado | - | Medium | Finalizada |
| [FRESCO-22](https://basiliomontescastano.atlassian.net/browse/FRESCO-22) | Aprendizaje | Mostrar explicación visible cuando el menú se ajusta por historial Pro | - | Medium | Finalizada |

---

## Metadata

- **Created:** 7/27/2026
- **Updated:** 7/31/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
