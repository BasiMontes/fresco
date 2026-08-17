# DEFECT: Revisar borde lateral grueso en banner de error del calendario (posible tell de UI generada por IA)

**Jira Key:** [FRESCO-148](https://basiliomontescastano.atlassian.net/browse/FRESCO-148)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa
components/calendar/calendar-grid.tsx:273 — el banner de error del drag-swap (`role="alert"`) usa `border-l-4 border-error` (borde izquierdo grueso de color).

Detectado por el hook de diseño impeccable como patrón 'side-tab accent border' — el tell más reconocible de UI generada por IA.

## Contexto
No es código de esta sesión (no se tocó al implementar FRESCO-87). Evaluado en el momento: es un banner de alerta (no una card de contenido genérica), y el borde-izquierdo-de-color es un patrón reconocido en alertas (Material Design, GitHub flash banners), no necesariamente el mismo problema que un side-tab decorativo en una card normal. Podría ser un falso positivo del hook, pero queda para revisión humana con el design system real (DESIGN.md) antes de decidir.

## Alcance
Revisar contra DESIGN.md si el patrón de alerta actual encaja con el sistema de diseño, o si conviene un tratamiento más sutil (fondo tintado, icono, borde más fino, etc). Si se confirma que es intencional, cerrar como falso positivo.

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
