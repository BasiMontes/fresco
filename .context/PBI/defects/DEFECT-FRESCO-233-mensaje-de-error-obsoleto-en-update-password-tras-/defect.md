# DEFECT: Mensaje de error obsoleto en /update-password tras corregir el mismatch de contraseñas

**Jira Key:** [FRESCO-233](https://basiliomontescastano.atlassian.net/browse/FRESCO-233)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

En `/update-password`, si el usuario escribe una contraseña y una confirmación distintas y confirma, ve correctamente el mensaje "Las contraseñas no coinciden.". Pero si corrige la confirmación para que ambas coincidan y a la vez deja una contraseña de menos de 6 caracteres, el segundo envío se bloquea silenciosamente por la validación nativa `minLength=6` del input ***antes*** de que el JS re-valide el formulario — y el mensaje "Las contraseñas no coinciden." se queda visible en pantalla, describiendo un problema que ya no es real.

## Por qué importa

El usuario ve un error que ya no explica el bloqueo real (contraseña demasiado corta, no contraseñas distintas). No impide seguir corrigiendo el formulario, pero confunde sobre qué hay que arreglar de verdad.

## Alcance

Revisar el componente de `/update-password` (mismo patrón de guard usado en login/signup/forgot-password, ver FRESCO-114): el mensaje de error debería limpiarse o recalcularse en cada intento de envío, no solo cuando el JS llega a ejecutar su propia validación.

## Cómo reproducir

1. Ir a `/update-password` con una sesión de recuperación válida (o cualquier sesión activa, la pantalla no distingue).
2. Escribir una contraseña válida y una confirmación distinta. Confirmar. Aparece "Las contraseñas no coinciden."
3. Corregir la confirmación para que coincida con la contraseña, pero dejar ambas con menos de 6 caracteres (ej. `"123"` / `"123"`). Confirmar de nuevo.
4. El envío se bloquea por la validación nativa `minLength=6` (sin popup visible en algunos navegadores/CLI), y el mensaje "Las contraseñas no coinciden." del paso 2 sigue en pantalla.

## Evidencia

Encontrado en vivo con Playwright CLI contra staging (`fresco-pre.vercel.app`) durante el barrido QA sistemático del 2026-08-19. Ver `.context/qa/regression.feature` (sección Autenticación, escenario "Un mensaje de error obsoleto puede confundir sobre el problema real de la contraseña").

---

## Metadata

- **Created:** 8/19/2026
- **Updated:** 8/25/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
