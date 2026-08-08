# DEFECT: Signup de invitada acepta password débil antes del OTP, desperdicia el roundtrip de email

**Jira Key:** [FRESCO-123](https://basiliomontescastano.atlassian.net/browse/FRESCO-123)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

Qué se observa

Dónde: app/signup/page.tsx (handleSubmit, rama invitada; Input de password ~líneas 306-312)

Pasos para reproducir:
1. Como invitada con menú generado, ir a /signup.
2. Rellenar email nuevo válido + password "123" (3 caracteres).
3. Aceptar términos, enviar.

Esperado: password débil rechazada de inmediato, antes de gastar el roundtrip de email real.

Observado: la app acepta "123" sin ninguna validación y avanza directo a la pantalla "Revisa tu correo" (paso de OTP). El campo password no tiene minLength ni pattern, y handleSubmit (rama invitada) solo llama updateUser({ email }) — el password no se toca hasta handleVerifyOtp tras confirmar el OTP real. Resultado: la usuaria completa toda la fricción de email (esperar el código, copiarlo, pegarlo) para recién ahí, potencialmente, enterarse de que su password es rechazada por Supabase.

Evidencia: app/signup/page.tsx líneas 178-201 (handleSubmit), 306-312 (Input password), línea 129 (handleVerifyOtp → updateUser({password})).

Por qué importa

UX rota: fricción real (email + código) desperdiciada antes de un error evitable con validación client-side de 1 línea. No es bloqueante (el usuario puede reintentar) pero es una mala primera impresión en el flujo de conversión más importante de la app.

Alcance

Añadir validación de longitud mínima (y opcionalmente fuerza) al campo password ANTES de permitir el submit del paso 1 — mismo criterio que Supabase usa server-side (mínimo 6 caracteres, ver weak_password en lib/auth-errors.ts), para que el rechazo sea inmediato y no dependa del roundtrip de OTP.

Cómo reproducir

Ver Pasos para reproducir arriba.


---

## Metadata

- **Created:** 8/8/2026
- **Updated:** 8/8/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** major, qa-sweep-2026-08-08

---

_Synced from Jira by sync-jira-issues_
