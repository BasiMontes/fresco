# Tarea: Arreglar salto de nivel de heading (h1→h3) en páginas del shell

**Jira Key:** [FRESCO-39](https://basiliomontescastano.atlassian.net/browse/FRESCO-39)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de accesibilidad de sesión.

***Qué:*** `/menu`, `/recipes`, `/profile`, `/calendar` renderizan `<h1 class="text-h2">` seguido directo de `<h3>` (vía CardTitle en `components/ui/card.tsx:41`, hardcodeado como h3, o el título de RecipeCard en `components/recipe/recipe-card.tsx:82`). No existe ningún `<h2>` real en esas páginas.

***Severidad:*** menor/moderada (buena práctica WCAG 1.3.1, no un fallo duro). Esfuerzo bajo.

---

## Fields

### Clasificación

0|i000af:

### customfield_10000

{repository={count=3, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":3,"lastUpdated":"2026-08-02T01:47:46.000+0200","dataType":"repository"},"byInstanceType":{"GitHub":{"count":3,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":3,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/2/2026
- **Updated:** 8/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
