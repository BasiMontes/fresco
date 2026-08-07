# DEFECT: Registro progresivo no completa la conversión de cuenta — invitada pierde acceso si pierde la sesión

**Jira Key:** [FRESCO-89](https://basiliomontescastano.atlassian.net/browse/FRESCO-89)
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Qué se observa

***Dónde***: `app/signup/page.tsx` (`handleSubmit`), flujo `/signup`

***Pasos para reproducir***:

1. Entrar sin login, completar onboarding, generar un menú de invitada.
2. Ir a `/signup` ("Guardar mi menú"), completar con un email genuinamente nuevo + password válida, aceptar términos, enviar.
3. La app redirige a `/menu` mostrando el menú (aparenta éxito).
4. Limpiar cookies/localStorage (simula cerrar el navegador / cambiar de dispositivo) e ir a `/login` con ese mismo email + password.

***Esperado***: tras "crear cuenta", el login con esas credenciales debería funcionar en cualquier momento — esa es la garantía central de "registrar una cuenta" en vez de seguir como invitada.

***Observado***: el login falla con "Invalid login credentials". Verificado contra la base de datos real: `client.auth.updateUser({email, password})` sobre un usuario anónimo en este proyecto de Supabase no cambia el email de forma inmediata — sólo encola un cambio pendiente (`new*email` seteado, `email` sigue en `""`, `is*anonymous: true`, `email*change*sent_at` presente). El código de `handleSubmit` no contempla este caso: si `updateUser()` no devuelve `error`, asume éxito y hace `router.push('/menu')` sin ningún mensaje de "revisa tu correo para confirmar". El usuario cree que su cuenta y su menú están a salvo, pero en realidad siguen atados 100% a la sesión anónima original — si esa sesión se pierde, todo es irrecuperable.

***Bug relacionado (mismo root cause)***: el flujo de "email ya registrado" (`emailConflict` / `reassignGuestData`, pensado exactamente para este caso — ver ADR-0004/FRESCO-20) tampoco se dispara. Probado con el email de la cuenta `USER*EMAIL*PRE`: `updateUser()` devuelve el mismo 200 "pendiente" en vez de un `error.code === 'email_exists'`, así que la UI de reasignación de cuenta nunca aparece.

***Evidencia***: request `PUT /auth/v1/user` → 200, body `{"email":"","new*email":"qa-test-...@fresco.qa","is*anonymous":true,...}`; intento posterior de login con esas credenciales → `POST /auth/v1/token?grant_type=password` → 400, "Invalid login credentials".

## Por qué importa

Este es el mecanismo central de conversión invitada → cuenta (Modo Invitado + Registro Progresivo, FRESCO-16/18/19). Sin este fix, la promesa de "probá antes de registrarte" es una trampa: la usuaria cree que guardó su cuenta pero en realidad sigue 100% atada a la sesión anónima original. Si pierde esa sesión (cierra el navegador, cambia de dispositivo, limpia cookies), pierde el acceso permanentemente sin ninguna forma de recuperación.

## Alcance

1. Investigar por qué `updateUser()` no aplica el cambio inmediato en este proyecto de Supabase — revisar la configuración de doble opt-in de email change en Auth settings.
2. Decidir el fix: desactivar ese doble opt-in para este caso específico, o rediseñar el flujo para manejarlo correctamente (mostrar "revisa tu correo para confirmar" y no redirigir como éxito hasta que la confirmación se complete).
3. Incluye el bug relacionado de la misma causa raíz: el flujo de "email ya registrado → reasignar cuenta" (`emailConflict`/`reassignGuestData`, ADR-0004/FRESCO-20) tampoco se dispara nunca por el mismo motivo — se prueba y se corrige con el mismo fix.

## Cómo reproducir

1. Entrar sin login, completar onboarding, generar un menú de invitada.
2. Ir a `/signup` ("Guardar mi menú"), completar con un email genuinamente nuevo + password válida, aceptar términos, enviar.
3. La app redirige a `/menu` mostrando el menú (aparenta éxito).
4. Limpiar cookies/localStorage (simula cerrar el navegador / cambiar de dispositivo) e ir a `/login` con ese mismo email + password.
5. El login falla con "Invalid login credentials".

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/7/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
