# DEFECT: /menu: iconos de Corazón y Notificaciones muy pequeños

**Jira Key:** [FRESCO-155](https://basiliomontescastano.atlassian.net/browse/FRESCO-155)
**Priority:** Medium
**Status:** WIP
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `app/(app)/menu/page.tsx` (líneas ~129-134), iconos `Heart` (Favoritos) y `Bell` (Notificaciones) en la cabecera de `/menu`.
- Hallazgo directo del user: los iconos de Corazón y Notificaciones se ven muy pequeños.

## Cambio propuesto

- Aumentar el tamaño de ambos iconos (hoy `size-[22px]` vía `<Heart className="size-[22px]" />` / `<Bell className="size-[22px]" />`), y revisar el `variant="icon" size="sm"` de `buttonVariants` que los envuelve — puede que el tamaño del botón contenedor también necesite subir para que el icono no quede apretado dentro.

## Alcance

- Solo la cabecera de `/menu` (los dos botones de acción). No toca el resto de usos de `Heart`/`Bell` en otras pantallas (p.ej. `favorite-toggle-button.tsx`) salvo que la revisión confirme la misma inconsistencia ahí.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
