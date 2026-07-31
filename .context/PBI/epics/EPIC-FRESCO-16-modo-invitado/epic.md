# EPIC: Modo Invitado

**Jira Key:** [FRESCO-16](https://basiliomontescastano.atlassian.net/browse/FRESCO-16)
**Priority:** Medium
**Status:** Finalizada
**Total Story Points:** 0

---

## Description

***Source spec******:*** FR-6.1, FR-6.2

Modo Invitado permite a una visitante por primera vez generar un menú semanal completo sin crear una cuenta, eliminando la fricción de un registro obligatorio antes de que haya visto ningún valor del producto (`user-journeys.md`, Jornada 1 — Guest Happy Path). Esta épica resuelve el gap de autenticación de invitados documentado en `business-api-map.md`: toda Edge Function de generación exige una sesión de Supabase Auth válida, y ningún documento fuente especificaba cómo una visitante sin cuenta podía obtenerla.

La solución adoptada es Supabase Anonymous Sign-In (ver ADR-0003, Accepted): la sesión anónima es una sesión de Supabase Auth completa con un `auth.uid()` real, por lo que ninguna Edge Function ni política de RLS existente requiere cambios de código para aceptarla. Esto deja el camino abierto para que, más adelante, esa misma sesión se convierta en una cuenta permanente sin perder los datos generados durante la visita de invitado.

***Valor de negocio******:*** desbloquea la validación concierge del MVP — sin Modo Invitado, toda visitante debe registrarse antes de ver el producto, lo que contradice la promesa central de "ver el valor antes de comprometerse" y bloquea por completo cualquier flujo posterior de conversión progresiva a cuenta registrada.

---

## User Stories

| Key | Story | Points | Priority | Status |
| --- | ----- | ------ | -------- | ------ |
| [FRESCO-17](https://basiliomontescastano.atlassian.net/browse/FRESCO-17) | Modo Invitado | Generar un menú sin crear cuenta | - | Medium | Finalizada |

---

## Metadata

- **Created:** 7/31/2026
- **Updated:** 7/31/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** master-sprint-2, mvp

---

_Synced from Jira by sync-jira-issues_
