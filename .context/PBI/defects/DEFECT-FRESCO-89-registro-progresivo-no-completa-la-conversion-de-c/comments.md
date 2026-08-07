# Comments for FRESCO-89

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-89)

---

### Basi Montes - 8/7/2026, 2:32:13 PM

## Fix implementado (2026-08-07)

***Root cause confirmado en vivo***: Supabase tiene `mailer*secure*email*change*enabled: true` + `mailer_autoconfirm: false` en el proyecto. Los docs oficiales de Supabase ("Convert an anonymous user to a permanent user") documentan que la conversión invitada→cuenta es un flujo de DOS pasos obligatorio: `updateUser({email})` primero, y solo tras verificar el código enviado al correo se puede `updateUser({password})`. El código anterior mandaba ambos juntos y asumía éxito inmediato.

***Fix***: `app/signup/page.tsx` — nueva pantalla intermedia de verificación por OTP (6 dígitos) entre el paso de email y el de password (`handleVerifyOtp`), con reenvío de código. `lib/auth-errors.ts` — mapeo de `otp_expired`.

***Bug relacionado (mismo root cause, Alcance #3)***: verificado en vivo (dos veces, incluida la llamada combinada original `updateUser({email, password})`) que Supabase encola el cambio con 200 sin error incluso cuando el email ya pertenece a otra cuenta confirmada — mismo comportamiento anti-enumeración que el proyecto ya documenta para `signUp()`. El conflicto (`email_exists`) ahora solo puede surgir dentro de `handleVerifyOtp`, y el código lo captura ahí.

***Verificado en vivo (Playwright, contra Supabase real)***:
- Signup con email nuevo → pantalla "Revisa tu correo" aparece correctamente.
- Código erróneo → error traducido correctamente al español.
- Paso 1 con email ya existente → sigue en 200-pendiente (confirma el bug relacionado), capturado ahora en el paso de verificación.

***Pendiente de QA manual*** (no automatizable sin fixture de lectura de inbox real): el tramo final del camino feliz (código real → password seteado → login sobrevive a perder la sesión anónima original) y el caso de conflicto de email de punta a punta. Ver `.context/qa/regression.feature` escenarios 3.3-3.6 (bitacora-tests.md) para el detalle.

Tests automatizados de `registro-progresivo-edge.steps.ts` que asumían detección instantánea del conflicto quedaron `test.skip()`'d con el motivo documentado, en vez de rojos silenciosos.

---


_Synced from Jira by sync-jira-issues_
