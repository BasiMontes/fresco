# Tarea: Añadir labels accesibles a los inputs de login/signup

**Jira Key:** [FRESCO-41](https://basiliomontescastano.atlassian.net/browse/FRESCO-41)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de accesibilidad de sesión.

***Qué:*** `app/login/page.tsx` (email/password) y `app/signup/page.tsx` (email/password/confirmar password) renderizan `<Input placeholder=\"Correo electrónico\" />` sin ningún `<label>` ni `aria-label` asociado — a diferencia del paso 3 del onboarding, que sí envuelve el input en un `<label>` real.

***Severidad:*** real (WCAG 1.3.1/3.3.2). Esfuerzo bajo.

---

## Fields

### Clasificación

0|i000av:

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
