# EPIC: Suscripción Pro (Stripe)

**Jira Key:** [FRESCO-227](https://basiliomontescastano.atlassian.net/browse/FRESCO-227)
**Priority:** High
**Status:** Finalizada
**Total Story Points:** 0

---

## Description

Habilita el upgrade self-serve a Pro vía Stripe, reemplazando el CTA "Próximamente" deshabilitado que hoy vive en `/profile` (`app/(app)/profile/page.tsx`).

***Reversión de una decisión de alcance previa, explícita.*** `.context/PRD/mvp-scope.md` y el propio código documentaban que el pago self-serve quedaba deliberadamente fuera del MVP — el founder cobra manualmente vía un proceso de "concierge validation" mientras dura la validación. Esta épica revierte esa decisión por confirmación explícita del usuario en sesión (no es scope creep sin aprobar).

***Datos de pricing (fuente******:****** ****`.context/business/business-model.md`****, no inventar otros)******:*** Free €0 (1 menú/semana, sin memoria entre semanas) · Pro €4.99/mes (el sistema aprende: evita repetir descartados, prioriza cocinados, ajusta cantidades) · trial de 7 días sin tarjeta requerida al inicio · nunca bajar de €4.99/mes.

***Nota técnica para Stage 1 de ***`/sprint-development`: evaluar si la elección Stripe Checkout vs Payment Links vs Elements + el modelo de estado dirigido por webhooks amerita un ADR (arquitectónico y difícil de revertir una vez elegido el proveedor de pagos) — no se decide aquí, se decide en la planificación de implementación de la Story 1.

Refinamiento de FRESCO-219.

---

## User Stories

| Key | Story | Points | Priority | Status |
| --- | ----- | ------ | -------- | ------ |
| [FRESCO-228](https://basiliomontescastano.atlassian.net/browse/FRESCO-228) | Suscripción | Actualizar a Pro desde el perfil | - | High | Finalizada |
| [FRESCO-230](https://basiliomontescastano.atlassian.net/browse/FRESCO-230) | Suscripción | Reflejar el estado real de mi suscripción | - | High | Finalizada |
| [FRESCO-231](https://basiliomontescastano.atlassian.net/browse/FRESCO-231) | Suscripción | Gestionar o cancelar mi suscripción desde el perfil | - | Medium | Finalizada |
| [FRESCO-232](https://basiliomontescastano.atlassian.net/browse/FRESCO-232) | Suscripción | Saber si mi pago falló | - | Medium | Finalizada |

---

## Metadata

- **Created:** 8/17/2026
- **Updated:** 8/19/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** mvp-scope-reversal, payments

---

_Synced from Jira by sync-jira-issues_
