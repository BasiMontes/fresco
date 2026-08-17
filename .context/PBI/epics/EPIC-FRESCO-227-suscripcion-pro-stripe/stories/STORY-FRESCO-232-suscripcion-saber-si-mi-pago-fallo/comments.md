# Comments for FRESCO-232

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-232)

---

### Basi Montes - 8/17/2026, 5:29:18 PM

## Acceptance Criteria

```gherkin
Scenario: Pago fallido me avisa
  Given mi suscripción Pro intenta renovarse
  When el cobro falla
  Then veo un aviso en mi perfil explicando que el pago falló

Scenario: Reintento exitoso restaura Pro sin fricción
  Given tuve un pago fallido
  When actualizo mi método de pago y el reintento funciona
  Then mi cuenta sigue en plan Pro sin interrupción visible

Scenario: Pago sigue fallando revierte a Free
  Given mi pago falló y no se resolvió
  When se agota el periodo de gracia
  Then mi cuenta pasa a plan Free
```

---

### Basi Montes - 8/17/2026, 5:29:19 PM

## Scope

- Aviso visible en /profile cuando un pago falla
- Periodo de gracia antes de revertir a Free
- Reintento de pago actualizado restaura Pro automáticamente

---

### Basi Montes - 8/17/2026, 5:29:20 PM

## Out Of Scope

- Recordatorios por email de pago fallido (posible follow-up)
- Reintentos automáticos programados por la app (Stripe ya maneja reintentos de cobro)

---


_Synced from Jira by sync-jira-issues_
