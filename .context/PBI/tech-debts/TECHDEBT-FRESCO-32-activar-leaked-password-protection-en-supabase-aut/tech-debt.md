# Tarea: Activar leaked-password protection en Supabase Auth

**Jira Key:** [FRESCO-32](https://basiliomontescastano.atlassian.net/browse/FRESCO-32)
**Status:** Blocked
**Type:** Tarea

---

## Description

***Origen:*** auditoría de seguridad de sesión (Supabase Advisors, categoría security).

***Qué:*** `auth*leaked*password_protection` está deshabilitado en el proyecto Supabase. Esta feature de Supabase Auth chequea contraseñas nuevas contra HaveIBeenPwned.org y rechaza las comprometidas.

***Por qué importa:*** protección estándar contra credential-stuffing con bajo esfuerzo de implementación — es un toggle en la config de Auth, no requiere cambios de código.

***Cómo:*** activar vía Supabase Dashboard (Authentication → Policies) o Management API (`PATCH /v1/projects/{ref}/config/auth`).

***Severidad:*** baja (hygiene), esfuerzo trivial.

---

## Fields

### Clasificación

0|i0008v:

### customfield_10000

{deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-02T15:16:11.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, repository={count=2, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":2,"lastUpdated":"2026-08-02T17:15:00.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":2,"name":"GitHub"},"GitHub":{"count":2,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-02T17:16:11.000+0200","topEnvironments":[{"lastUpdated":"2026-08-02T15:16:11.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/1/2026
- **Updated:** 8/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
