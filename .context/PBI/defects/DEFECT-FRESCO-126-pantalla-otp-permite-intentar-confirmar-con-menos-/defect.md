# DEFECT: Pantalla OTP permite intentar confirmar con menos de 6 dígitos

**Jira Key:** [FRESCO-126](https://basiliomontescastano.atlassian.net/browse/FRESCO-126)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

Qué se observa

Dónde: app/signup/page.tsx (pantalla OTP, Input otp*code*input)

Pasos para reproducir:
1. Llegar a la pantalla "Revisa tu correo" (paso OTP del signup de invitada).
2. Escribir solo 2 dígitos ("12").
3. Click en "Confirmar código".

Esperado: el botón debería mantenerse deshabilitado hasta que haya exactamente 6 dígitos, evitando una request innecesaria.

Observado: el botón está habilitado y la request se envía igual. El servidor responde 403 y la app muestra correctamente el error traducido en español ("El código expiró o no es válido. Solicita uno nuevo.") — no se filtra ningún error crudo, así que el impacto es solo una request desperdiciada, no un problema de UX visible grave.

Por qué importa

Impacto bajo — el manejo de error ya es correcto, esto es solo una validación client-side ausente que evitaría una request innecesaria.

Alcance

Añadir validación de longitud exacta (6 dígitos numéricos) al Input antes de habilitar el botón "Confirmar código", mismo patrón que ya usa `disabled={isVerifyingOtp || !otpCode}` pero con chequeo de longitud/formato.

Cómo reproducir

Ver Pasos para reproducir arriba.


---

## Metadata

- **Created:** 8/8/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** minor, qa-sweep-2026-08-08

---

_Synced from Jira by sync-jira-issues_
