# Tarea: Añadir regiones aria-live a errores y loading de formularios

**Jira Key:** [FRESCO-45](https://basiliomontescastano.atlassian.net/browse/FRESCO-45)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de accesibilidad de sesión.

***Qué:*** `sessionError`/`generateError`/`household*validation*message` en `app/onboarding/page.tsx` y `loginError`/`signupError`/`reassignError` en login/signup son `<p>` planos sin `role=\"alert\"` ni `aria-live`, a diferencia de `components/ui/alert-banner.tsx:36-37` (que sí lo hace bien) y del calendario. El spinner `generating_hint` también es silencioso.

***Severidad:*** real (WCAG 4.1.3). Esfuerzo bajo-medio.

---

## Fields

### Clasificación

0|i000br:

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
