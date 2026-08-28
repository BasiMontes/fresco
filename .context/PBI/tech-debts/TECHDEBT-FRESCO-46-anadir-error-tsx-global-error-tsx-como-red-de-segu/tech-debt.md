# Tarea: Añadir error.tsx / global-error.tsx como red de seguridad

**Jira Key:** [FRESCO-46](https://basiliomontescastano.atlassian.net/browse/FRESCO-46)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de resiliencia UX de sesión.

***Qué:*** no existe ningún `error.tsx` ni `global-error.tsx` en `app/`. Si algún Server Component lanza sin try/catch local (o una página futura olvida el patrón ya establecido en /menu, /calendar, /recipes, /shopping-list), Next.js cae a su página de error genérica sin estilo, no una de marca.

***Severidad:*** media. Esfuerzo bajo.

---

## Fields

### Clasificación

0|i000bz:

### customfield_10000

{repository={count=2, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":2,"lastUpdated":"2026-08-02T17:15:00.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":2,"name":"GitHub"},"GitHub":{"count":2,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/2/2026
- **Updated:** 8/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
