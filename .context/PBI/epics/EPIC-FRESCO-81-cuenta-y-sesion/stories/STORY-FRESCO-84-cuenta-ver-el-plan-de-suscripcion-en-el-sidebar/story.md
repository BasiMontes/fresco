# Cuenta | Ver el plan de suscripción en el sidebar

**Jira Key:** [FRESCO-84](https://basiliomontescastano.atlassian.net/browse/FRESCO-84)
**Epic:** [FRESCO-81](https://basiliomontescastano.atlassian.net/browse/FRESCO-81) (Cuenta y Sesión)
**Type:** Historia
**Status:** Finalizada
**Priority:** Medium
**Story Points:** -

---

## Overview

## User story

***Como*** Laura, la planificadora agotada
***Quiero*** ver qué plan tengo (Free o Pro) en el pie de la barra lateral, junto a mis datos de cuenta
***Para*** confirmar de un vistazo si tengo activas las funciones Pro, sin tener que navegar a otra pantalla

## Definition of done

- [ ] Etiqueta de plan visible en el footer de cuenta del sidebar, junto a nombre/email
- [ ] Reusa `getUserPlan()` (`lib/api/user-profile.ts`) — sin duplicar la lectura del campo `plan`
- [ ] Revisado en light y dark mode
- [ ] Revisado responsive
- [ ] Code review aprobado
- [ ] Desplegado a producción (proyecto `solo-main`, sin staging intermedio)
- [ ] Criterios de aceptación validados

---

## Traceability

### Historia (1)

- [FRESCO-82](https://basiliomontescastano.atlassian.net/browse/FRESCO-82): Cuenta | Ver datos de la cuenta y cerrar sesión desde el sidebar _(Finalizada)_

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** new-feature, post-mvp

---

_Synced from Jira by sync-jira-issues_
