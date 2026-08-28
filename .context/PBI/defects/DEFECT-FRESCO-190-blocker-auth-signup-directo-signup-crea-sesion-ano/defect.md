# DEFECT: [BLOCKER] Auth: signup directo (/signup) crea sesión anónima huérfana en vez de loguear la cuenta real creada

**Jira Key:** [FRESCO-190](https://basiliomontescastano.atlassian.net/browse/FRESCO-190)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

***Severidad******:****** BLOCKER***

***Dónde***: `app/signup/page.tsx` líneas 218-241 (rama `signUp()` plana, dentro de `handleSubmit`), y `app/onboarding/page.tsx` líneas 110-129 (`ensureGuestSession()`)

## Pasos para reproducir

1. Navegador limpio (sin cookies)
2. Ir directo a `/signup` (NO vía onboarding invitado)
3. Completar email nuevo único + password + aceptar términos
4. Pulsar "Crear cuenta"

## Esperado

Tras un signup exitoso con email+password, o bien se establece sesión real, o se muestra claramente "revisa tu correo para confirmar tu cuenta" sin crear una sesión invitada paralela y desconectada que enmascara el problema.

## Observado

Redirige a `/onboarding` "Paso 1 de 4". El JWT de la cookie `sb-...-auth-token` decodificado muestra `"email":"", "identities":[], "is_anonymous":true` — un usuario anónimo nuevo y no relacionado, no la cuenta recién creada. Reproducido 2 veces con emails distintos, mismo resultado.

### Root cause

`signUp()` sí crea la cuenta real (200, éxito), pero este proyecto requiere confirmación de email, así que no establece sesión. El código de `handleSubmit` redirige a `/onboarding` incondicionalmente en éxito sin comprobar si Supabase devolvió sesión. El efecto `ensureGuestSession()` de onboarding entonces no encuentra sesión y llama `signInAnonymously()`, creando en silencio una identidad invitada desconectada.

### Agravante

Intentar loguear después con esas mismas credenciales muestra "Confirma tu email antes de iniciar sesión" pero no existe ningún botón de reenvío de email de confirmación en `/login` — la cuenta real queda inalcanzable.

### Nota

Distinto de FRESCO-89 (esa cubre la conversión invitado→cuenta vía `updateUser()` sobre sesión anónima existente; este bug es la rama de signup directo sin sesión invitada previa, mismo archivo pero rama de código distinta).

---

## Metadata

- **Created:** 8/11/2026
- **Updated:** 8/17/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
