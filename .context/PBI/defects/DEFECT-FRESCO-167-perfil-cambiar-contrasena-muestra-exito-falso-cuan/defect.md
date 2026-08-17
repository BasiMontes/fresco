# DEFECT: Perfil: 'Cambiar contraseña' muestra éxito falso cuando la API falla

**Jira Key:** [FRESCO-167](https://basiliomontescastano.atlassian.net/browse/FRESCO-167)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/profile/ayuda-section.tsx`, `handleSendPasswordReset()` (agregado hoy en FRESCO-161) — llama `client.auth.resetPasswordForEmail(email)` sin chequear el `{ error }` que devuelve (no lanza excepción en fallo real de API).
- Hallazgo del QA sweep (agente Lista+Perfil, MAJOR): un 400 real de `auth/v1/recover` (confirmado por red) igual muestra "Te enviamos un enlace...". No es solo un problema de cuentas invitadas — cualquier fallo real (rate-limit, red) para un usuario real quedaría igual silenciado como si hubiera funcionado.

## Cambio propuesto

- Capturar `{ error }` del retorno de `resetPasswordForEmail()` y, si existe, mostrar un mensaje de fallo en vez de `resetSent(true)`. Mantener la postura anti-enumeración existente (no revelar si el email existe) — el chequeo es solo para errores reales de API (400/5xx/red), no para "email no existe".

## Alcance

- Solo `ayuda-section.tsx`'s `handleSendPasswordReset`. No toca `app/forgot-password/page.tsx` (tiene el mismo patrón sin-catch, pero no fue reportado por el QA sweep en ese flujo — evaluar por separado si aplica igual ahí).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
