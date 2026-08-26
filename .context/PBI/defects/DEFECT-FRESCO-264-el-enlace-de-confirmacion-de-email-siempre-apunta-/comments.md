# Comments for FRESCO-264

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-264)

---

### Basi Montes - 8/25/2026, 8:59:11 PM

## Actual Result (Comportamiento)

El enlace de confirmación del email de signup en staging redirige y autentica al usuario en `fresco-pro.vercel.app` (producción), dejando la sesión de `fresco-pre.vercel.app` (staging) sin iniciar.

## Expected Result (Output)

El enlace de confirmación debería mantener al usuario en el mismo entorno donde se registró (staging → staging, producción → producción).

## Error Type

Integration

## Severity

Crítica — cualquier registro iniciado en staging termina en el entorno equivocado; bloquea pruebas de QA fiables en staging y puede confundir a testers/beta users con acceso solo a staging.

## Test Environment

Staging (origen del registro) / Production (destino final tras confirmar)

## Workaround

Ninguno automatizable. Tras confirmar el correo, el usuario/QA debe navegar manualmente de vuelta a la URL de staging para continuar la sesión ahí (la cuenta ya existe en la misma base de datos Supabase compartida entre entornos).

---


_Synced from Jira by sync-jira-issues_
