# Tarea: Añadir aria-current='page' al link de navegación activo

**Jira Key:** [FRESCO-40](https://basiliomontescastano.atlassian.net/browse/FRESCO-40)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de accesibilidad de sesión.

***Qué:*** `components/layout/sidebar.tsx:33-40` y `components/layout/bottom-tab-bar.tsx:24-33` calculan `isActive` desde el pathname pero nunca setean `aria-current=\"page\"` en el link activo — un usuario de lector de pantalla no tiene forma de saber en qué sección está.

***Severidad:*** real (WCAG 4.1.2/1.3.1). Esfuerzo bajo.

---

## Fields

### Clasificación

0|i000an:

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
