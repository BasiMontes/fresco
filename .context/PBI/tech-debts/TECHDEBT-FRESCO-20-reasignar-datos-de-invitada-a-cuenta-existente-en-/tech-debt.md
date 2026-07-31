# Tarea: Reasignar datos de invitada a cuenta existente en conflicto de email (FRESCO-19)

**Jira Key:** [FRESCO-20](https://basiliomontescastano.atlassian.net/browse/FRESCO-20)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Source spec******:*** FR-7.1 (FRESCO-19 edge case, deferred by explicit user decision)

Cuando una invitada intenta convertir su sesión anónima con un email que ya pertenece a otra cuenta existente, FRESCO-19 detecta el conflicto y la dirige a iniciar sesión — pero no reasigna sus datos (menú generado, perfil) a esa cuenta existente. Esta tarea cubre esa reasignación real.

Requiere diseño explícito antes de escribir código: `meal*plans`/`shopping*lists` referencian `user*profiles(id)` por FK, y `user*profiles.id` ES el `auth.users.id` — no existe una operación nativa de "fusionar dos usuarios" en Supabase Auth. Hace falta decidir: qué prueba de propiedad de la cuenta existente se exige antes de mover filas, qué RPC privilegiado (`SECURITY DEFINER`, patrón ya usado en `swap*meal*plan*slots`/`jsonb*set*comprado`) ejecuta el movimiento, en qué transacción, y qué pasa con la fila `auth.users`/`user*profiles` de la sesión anónima una vez reasignados sus datos.

Ver ADR-0003 (Consequences) — este riesgo ya estaba nombrado ahí como "not treat the happy path as only path".

---

## Fields

### Clasificación

0|i00067:

### customfield_10000

{}

---

## Metadata

- **Created:** 7/31/2026
- **Updated:** 7/31/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** master-sprint-2, tech-debt

---

_Synced from Jira by sync-jira-issues_
