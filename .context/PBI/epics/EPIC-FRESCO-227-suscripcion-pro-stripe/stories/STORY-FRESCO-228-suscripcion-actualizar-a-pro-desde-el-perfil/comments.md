# Comments for FRESCO-228

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-228)

---

### Basi Montes - 8/17/2026, 5:28:26 PM

## Acceptance Criteria

```gherkin
Scenario: Iniciar checkout desde el perfil
  Given estoy en mi perfil con plan Free
  When toco el botón de actualizar a Pro
  Then soy llevada a completar el pago de la suscripción Pro

Scenario: Trial sin tarjeta
  Given empiezo el proceso de actualizar a Pro
  When llego a la pantalla de pago
  Then se me ofrece un periodo de prueba de 7 días sin necesidad de tarjeta

Scenario: Pago completado activa Pro
  Given completé el pago de la suscripción Pro
  When vuelvo a la app
  Then mi perfil muestra el plan Pro activo
```

---

### Basi Montes - 8/17/2026, 5:28:27 PM

## Scope

- CTA de actualizar visible en /profile para usuarias con plan Free
- Precio mostrado: €4.99/mes
- Trial de 7 días sin tarjeta requerida al inicio

---

### Basi Montes - 8/17/2026, 5:28:28 PM

## Out Of Scope

- Múltiples niveles de plan más allá de Free/Pro
- Descuentos, cupones o precios promocionales

---


_Synced from Jira by sync-jira-issues_
