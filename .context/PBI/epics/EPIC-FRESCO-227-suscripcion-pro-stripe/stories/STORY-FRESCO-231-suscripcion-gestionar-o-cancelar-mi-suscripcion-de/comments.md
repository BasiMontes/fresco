# Comments for FRESCO-231

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-231)

---

### Basi Montes - 8/17/2026, 5:29:03 PM

## Acceptance Criteria

```gherkin
Scenario: Acceder a gestión de suscripción
  Given tengo una suscripción Pro activa
  When entro a mi perfil
  Then puedo abrir la gestión de mi suscripción

Scenario: Cancelar la suscripción
  Given estoy en la gestión de mi suscripción
  When elijo cancelarla
  Then veo confirmado que seguiré teniendo Pro hasta el fin del periodo ya pagado

Scenario: Ver mi próximo cobro
  Given tengo una suscripción Pro activa
  When abro la gestión de mi suscripción
  Then veo la fecha y el monto de mi próximo cobro
```

---

### Basi Montes - 8/17/2026, 5:29:04 PM

## Scope

- Acceso a portal de gestión de suscripción desde /profile
- Cancelación autogestionada, sin intervención manual
- Visibilidad de próximo cobro (fecha y monto)

---

### Basi Montes - 8/17/2026, 5:29:05 PM

## Out Of Scope

- Cambiar el método de pago desde dentro de la propia app (se delega al portal de Stripe)
- Pausar la suscripción (solo cancelar/reactivar)

---


_Synced from Jira by sync-jira-issues_
