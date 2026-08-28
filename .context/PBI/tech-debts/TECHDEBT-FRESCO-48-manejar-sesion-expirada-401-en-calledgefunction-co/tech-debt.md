# Tarea: Manejar sesión expirada (401) en callEdgeFunction con redirect a /login

**Jira Key:** [FRESCO-48](https://basiliomontescastano.atlassian.net/browse/FRESCO-48)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de resiliencia UX de sesión.

***Qué:*** `callEdgeFunction` en `lib/api/edge-functions.ts` lanza un `EdgeFunctionError` genérico para cualquier status no-2xx, incluido 401. Todos los consumidores (onboarding, generador de lista de compra, calendario) solo distinguen 422/409 y caen a un mensaje genérico 'no pudimos...' ante un JWT expirado — el usuario nunca ve 'tu sesión expiró, volvé a iniciar sesión'. `app/signup/page.tsx:114-117` ya reconoce en un comentario haber parcheado un caso relacionado (401 crudo) solo para el caso puntual de anti-enumeración en signup, sin generalizar el fix.

***Severidad:*** media (confusión real de usuario, baja frecuencia). Esfuerzo medio.

---

## Fields

### Clasificación

0|i000cf:

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
