# Tarea: Diferenciar mensajes de error del calendario según tipo de fallo

**Jira Key:** [FRESCO-47](https://basiliomontescastano.atlassian.net/browse/FRESCO-47)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de resiliencia UX de sesión.

***Qué:*** `CalendarGrid` (`components/calendar/calendar-grid.tsx:147,185`) muestra 'No se pudo guardar el nuevo orden/estado del plato. Vuelve a intentarlo.' para cualquier fallo (red, 409, 500 por igual), a diferencia del onboarding que sí distingue el caso 422 con un mensaje específico.

***Severidad:*** baja. Esfuerzo bajo.

---

## Fields

### Clasificación

0|i000c7:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/2/2026
- **Updated:** 8/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
