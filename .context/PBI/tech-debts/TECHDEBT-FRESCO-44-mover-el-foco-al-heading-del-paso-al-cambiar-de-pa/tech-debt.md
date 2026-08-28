# Tarea: Mover el foco al heading del paso al cambiar de paso en el onboarding

**Jira Key:** [FRESCO-44](https://basiliomontescastano.atlassian.net/browse/FRESCO-44)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de accesibilidad de sesión.

***Qué:*** las llamadas a `setStep` en `app/onboarding/page.tsx:331,338` no van acompañadas de ningún `ref.focus()` — un usuario de teclado o lector de pantalla que avanza del paso 2 al 3 no recibe ninguna señal de que el contenido cambió.

***Severidad:*** real (WCAG 2.4.3). Esfuerzo medio.

---

## Fields

### Clasificación

0|i000bj:

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
