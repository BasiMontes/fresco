# EPIC: Registro Progresivo

**Jira Key:** [FRESCO-18](https://basiliomontescastano.atlassian.net/browse/FRESCO-18)
**Priority:** Medium
**Status:** Finalizada
**Total Story Points:** 0

---

## Description

***Source spec******:*** FR-7.1

Registro Progresivo pide a una invitada que cree una cuenta solo después de haber visto ya su menú semanal generado (`user-journeys.md`, Jornada 1, Paso 5) — nunca antes. El disparador de registro es el propio botón de "conservar este menú", planteado como una forma de guardar algo que ya se vio con valor, no como una pared de pago que bloquea el acceso al producto.

Técnicamente, esta épica se apoya en la conversión de sesión que Supabase Anonymous Sign-In ya soporta de forma nativa (`updateUser()` con email y contraseña, ver ADR-0003): la cuenta de invitada se convierte en una cuenta permanente conservando el mismo `user_id`, de modo que el menú generado durante la visita de invitada no se pierde ni requiere reasignación de datos en el caso general. ADR-0003 también señala un riesgo real para esta épica: la verificación de email antes de fijar contraseña puede introducir fricción (dominios rechazados, límites de envío) que esta épica debe tener en cuenta explícitamente, no asumir como un problema resuelto.

***Valor de negocio******:*** es el mecanismo de conversión de Modo Invitado — sin Registro Progresivo, una visitante puede ver el valor del producto pero no tiene ningún camino para conservarlo, lo que anula el propósito de negocio de dejarla entrar sin registro previo.

---

## User Stories

| Key | Story | Points | Priority | Status |
| --- | ----- | ------ | -------- | ------ |
| [FRESCO-19](https://basiliomontescastano.atlassian.net/browse/FRESCO-19) | Registro Progresivo | Solicitar registro tras ver el menú generado | - | Medium | Finalizada |

---

## Metadata

- **Created:** 7/31/2026
- **Updated:** 7/31/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** master-sprint-2, mvp

---

_Synced from Jira by sync-jira-issues_
