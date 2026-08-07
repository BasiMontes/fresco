# DEFECT: Banner "función Pro" del Calendario es falso — marcar cocinado/descartado funciona igual en Free

**Jira Key:** [FRESCO-103](https://basiliomontescastano.atlassian.net/browse/FRESCO-103)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/calendar/calendar-grid.tsx` (`learning*free*tier_notice`, `handleMarkEstado`, `SlotCell`)
- ***Cuenta usada***: plan Free (`plan_tag` = "Plan Free")
- El banner visible en `/calendar` dice literalmente: **"Marcar un plato como cocinado o descartado es una función de nivel Pro — tu menú actual no se ve afectado."**
- Al hacer click en el check de "marcar cocinado" de cualquier plato pendiente, el marcado ***se guarda de verdad**** vía `updateRecipeStatus` y ****persiste tras recargar la página***.
- Según el propio comentario del código, este marcado es un ***estado terminal, de una sola vía*** ("queda fijado — no puede volver a cambiarse").
- No existe ningún check de `userPlan` en `handleMarkEstado` ni en el render de los botones de marcado — el banner no refleja ningún comportamiento real de bloqueo.
- ***Evidencia***: `[data-testid=calendar*slot*lunes*desayuno*estado*badge]` = "Cocinado" antes y después de recargar, en una cuenta con `plan*tag` = "Plan Free".

## Por qué importa

El marcado es, según el propio código, un estado terminal de una sola vía (no se puede revertir). Una usuaria Free que confía en el aviso "tu menú no se ve afectado" puede terminar con un cambio irreversible que creía sin efecto.

## Alcance

Se deja la decisión de negocio ***abierta*** — no se asume cuál de las dos es la correcta:

1. Corregir el aviso para reflejar la realidad: el marcado ***sí**** persiste en Free, lo Pro-only es el **aprendizaje* del menú futuro (no el marcado en sí).
2. Agregar el check de `userPlan` real en `handleMarkEstado` para que el marcado efectivamente no aplique en Free, si esa es la intención de negocio original.

## Cómo reproducir

1. Loguearse con una cuenta plan Free.
2. Ir a `/calendar`, leer el aviso: "Marcar un plato como cocinado o descartado es una función de nivel Pro — tu menú actual no se ve afectado."
3. Click en el check (marcar cocinado) de cualquier plato pendiente.
4. Recargar la página.
5. Observar que el estado "Cocinado" persiste — el aviso era falso.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/7/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
