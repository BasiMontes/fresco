# Comments for FRESCO-230

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-230)

---

### Basi Montes - 8/17/2026, 5:28:44 PM

## Acceptance Criteria

```gherkin
Scenario: Pago exitoso activa Pro automáticamente
  Given completé el pago de mi suscripción
  When el pago se confirma
  Then mi cuenta pasa a plan Pro sin que tenga que hacer nada más

Scenario: Renovación mensual mantiene Pro
  Given tengo una suscripción Pro activa
  When se renueva el cobro mensual
  Then sigo teniendo plan Pro sin interrupción

Scenario: Cancelación revierte a Free al fin del periodo pagado
  Given cancelé mi suscripción Pro
  When termina el periodo que ya pagué
  Then mi cuenta pasa a plan Free
```

---

### Basi Montes - 8/17/2026, 5:28:45 PM

## Scope

- Cambios de estado de la suscripción (activa, renovada, cancelada) se reflejan en mi plan sin acción manual
- Cancelación mantiene Pro hasta el final del periodo ya pagado

---

### Basi Montes - 8/17/2026, 5:28:46 PM

## Out Of Scope

- Prorrateo de reembolsos parciales
- Notificación por email de cada cambio de estado

---

### Basi Montes - 8/17/2026, 5:28:48 PM

## Business Rules Specification

- Ninguna acción manual del founder debe ser necesaria para reflejar el estado de pago — elimina el proceso concierge manual actual para usuarias que pasan a Pro por este flujo

---


_Synced from Jira by sync-jira-issues_
