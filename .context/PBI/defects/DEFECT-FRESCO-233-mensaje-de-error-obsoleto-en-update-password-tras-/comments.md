# Comments for FRESCO-233

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-233)

---

### Basi Montes - 8/19/2026, 4:42:16 PM

## Actual Result

El mensaje "Las contraseñas no coinciden." permanece visible tras un segundo intento de envío que en realidad falló por longitud mínima (`minLength=6`), no por mismatch.

## Expected Result

El mensaje de error debería reflejar la causa real del bloqueo en cada intento de envío, o limpiarse si ya no aplica.

## Error Type

Functional

## Severity

Menor

## Test Environment

Staging

---


_Synced from Jira by sync-jira-issues_
