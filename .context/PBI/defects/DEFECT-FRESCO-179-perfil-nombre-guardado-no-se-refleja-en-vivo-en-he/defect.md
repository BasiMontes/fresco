# DEFECT: Perfil: nombre guardado no se refleja en vivo en header/sidebar

**Jira Key:** [FRESCO-179](https://basiliomontescastano.atlassian.net/browse/FRESCO-179)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/profile/nombre-form.tsx` — tras guardar el nombre exitosamente, el estado local del form se actualiza pero el saludo del header (`/profile`'s card superior) y el sidebar no se refrescan.
- Hallazgo del QA sweep (agente Lista+Perfil, MINOR): el guardado funciona y persiste (confirmado tras recarga manual), pero el saludo sigue diciendo "Hola" sin nombre hasta refrescar la página.

## Cambio propuesto

- Llamar `router.refresh()` tras un guardado exitoso en `NombreForm`, para que el Server Component de `/profile` (que lee `nombre` fresco) y `Sidebar`/`SidebarAccount` se actualicen sin recarga manual.

## Alcance

- Solo `nombre-form.tsx`'s `handleSubmit`.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
