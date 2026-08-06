# DEFECT: Cambiar a botón primario el 'Ver mi plan semanal'

**Jira Key:** [FRESCO-73](https://basiliomontescastano.atlassian.net/browse/FRESCO-73)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

`components/menu/calendar-suggestion-banner.tsx:15-26` — el botón "Ver mi plan semanal" usa `variant: 'secondary'` (outline), no el botón primario de la app.

## Nota importante — decisión de diseño previa

El propio comentario del componente (líneas 6-14) justifica DELIBERADAMENTE el variant actual: DESIGN.md permite solo un botón `action` por pantalla, y la card "Cocinar ya" en la misma pantalla ya usa `action`.

Cambiar a `default` (primario) ***no viola*** esa regla — `default` ≠ `action`, son variantes distintas — pero sí revierte una decisión tomada a propósito en su momento. Documentar en el ticket que se está revirtiendo esa decisión de forma consciente, no ignorándola.

## Alcance

Único call site en todo el código (confirmado por grep) — cambio acotado a una línea (`variant: 'secondary'` → `variant: 'default'`).

---

## Metadata

- **Created:** 8/4/2026
- **Updated:** 8/5/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
