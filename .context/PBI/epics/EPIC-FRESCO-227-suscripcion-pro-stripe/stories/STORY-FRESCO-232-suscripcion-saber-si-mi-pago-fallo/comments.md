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

### Basi Montes - 8/17/2026, 9:12:37 PM

QA en staging (fresco-pre.vercel.app) — marcado como NO VERIFICABLE: el escenario de "pago fallido" no es alcanzable porque el checkout de pago Pro en sí todavía no está implementado.

***Verificado******:***

- En `/perfil`, la tarjeta "Pásate a Fresco Pro" muestra el botón "Próximamente" deshabilitado — no hay ningún flujo de checkout Stripe real al que suscribirse.
- Búsqueda en todo el repositorio (`rg -il stripe`) no encuentra ninguna integración de Stripe (ni checkout, ni webhook, ni endpoint de suscripción) salvo un comentario de código en `app/(app)/profile/page.tsx` que documenta explícitamente que el checkout real queda pendiente de STORY-FRESCO-228 ("self-serve payment via Stripe is now in scope... but this button still needs to be wired to the real checkout flow once STORY-FRESCO-228 ships").

***Impacto en los 3 escenarios del AC******:***

- "Pago fallido me avisa": no aplica — no existe forma de tener una suscripción Pro activa vía pago propio, así que no puede fallar un cobro.
- "Reintento exitoso restaura Pro": no aplica por el mismo motivo.
- "Pago sigue fallando revierte a Free": no aplica por el mismo motivo.

Esta historia depende de que STORY-FRESCO-228 (checkout Stripe) esté implementado y desplegado antes de poder verificarse. Tal como está hoy en staging, ninguno de los tres escenarios de AC es alcanzable. Se deja en Control de calidad sin transicionar — recomiendo devolverla a backlog/bloqueada hasta que FRESCO-228 esté en staging, en vez de mantenerla en esta columna.

---


_Synced from Jira by sync-jira-issues_
