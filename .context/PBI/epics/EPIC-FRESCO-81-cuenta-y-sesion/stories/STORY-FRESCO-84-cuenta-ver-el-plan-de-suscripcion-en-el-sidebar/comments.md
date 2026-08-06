# Comments for FRESCO-84

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-84)

---

### Basi Montes - 8/6/2026, 11:12:41 AM

## Acceptance Criteria

```gherkin
Feature: Plan de suscripción en el sidebar

Scenario: Ver mi plan Free en el pie de la barra lateral
  Given que mi cuenta tiene el plan Free
  When abro cualquier pantalla de la aplicación con sesión activa
  Then veo una etiqueta "Free" junto a mis datos de cuenta en el pie de la barra lateral

Scenario: Ver mi plan Pro en el pie de la barra lateral
  Given que mi cuenta tiene el plan Pro
  When abro cualquier pantalla de la aplicación con sesión activa
  Then veo una etiqueta "Pro" junto a mis datos de cuenta en el pie de la barra lateral

Scenario: Ver mi plan Family en el pie de la barra lateral
  Given que mi cuenta tiene el plan Family
  When abro cualquier pantalla de la aplicación con sesión activa
  Then veo una etiqueta "Family" junto a mis datos de cuenta en el pie de la barra lateral

Scenario: La etiqueta no aparece sin sesión activa
  Given que no inicié sesión
  When estoy en la pantalla de acceso o de registro
  Then no veo ninguna etiqueta de plan en la barra lateral
```

---

### Basi Montes - 8/6/2026, 11:12:42 AM

## Scope

- Ver una etiqueta con su plan actual (Free, Pro o Family) junto a sus datos de cuenta en el pie de la barra lateral.
- La etiqueta refleja el plan real de su cuenta en cada carga de pantalla.

---

### Basi Montes - 8/6/2026, 11:12:44 AM

## Out Of Scope

- Cambiar, actualizar o cancelar el plan desde este componente (futura historia de gestión de suscripción/billing).
- Mostrar detalles de facturación (fecha de renovación, método de pago, historial de cobros).
- Explicar o promocionar las diferencias entre planes (upsell) desde este componente.

---

### Basi Montes - 8/6/2026, 11:12:45 AM

## Business Rules Specification

- La etiqueta de plan sigue la misma regla de visibilidad que el resto del footer de cuenta (FRESCO-82): solo se muestra con sesión activa.
- El texto de la etiqueta es "Free plan" / "Pro plan" (terminología canónica de business/domain-glossary.md) — nunca describir el plan como un nivel de acceso o permiso.

---


_Synced from Jira by sync-jira-issues_
