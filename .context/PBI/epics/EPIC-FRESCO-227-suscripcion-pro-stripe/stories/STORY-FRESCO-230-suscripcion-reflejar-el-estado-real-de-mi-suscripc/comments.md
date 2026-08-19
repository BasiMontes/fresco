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

### Basi Montes - 8/17/2026, 9:10:30 PM

QA verificado en staging (fresco-pre.vercel.app): revisé el código fuente y la app en vivo (cuenta Pro de prueba) para comprobar la sincronización automática del plan tras el pago. No existe ninguna integración de pagos (sin Stripe, sin webhook, sin lógica de sincronización de plan) en ningún punto de la app ni del repositorio. En /profile, la tarjeta de upgrade para usuarios Free muestra un botón deshabilitado con la etiqueta "Próximamente", y ni siquiera la cuenta Pro de prueba tiene sección de facturación o gestión de suscripción. Ninguno de los 3 escenarios de los criterios de aceptación (pago exitoso activa Pro, renovación mensual mantiene Pro, cancelación revierte a Free) tiene mecanismo alguno implementado detrás.

Esperado: el plan de la cuenta se actualiza automáticamente según el estado real del pago.
Observado: el plan es un valor estático en base de datos; no hay ningún flujo de pago/checkout ni webhook que lo actualice.


---

### Basi Montes - 8/18/2026, 7:12:04 PM

## Spec Implementation Plan (Dev)

## Goal

Keep `user_profiles.plan` correct automatically as the subscription's real state changes over time — renewal keeps Pro, actual end-of-period cancellation reverts to Free — extending the same webhook (`app/api/stripe/webhook/route.ts`) FRESCO-228 built, per its own doc comment ("FRESCO-230 adds its own case to this same handler").

## Status note

Ticket was `Rechazos` (rejected) from a 2026-08-17 QA pass — that QA comment is now stale: it correctly found zero Stripe integration existed at all, which FRESCO-228 has since shipped. Re-opened to `WIP`.

## Acceptance Test Plan mapping

Source: `comments.md` (fallback comment, same 255-char cap as 228).

| AC scenario | Implementation step |
| --- | --- |
| Pago exitoso activa Pro automáticamente | Already covered by FRESCO-228's `checkout.session.completed` handler — no new code |
| Renovación mensual mantiene Pro | New `customer.subscription.updated` case: when `status === 'active'`, refresh `plan*expires*at` from the subscription item's `current*period*end`, keep `plan: 'pro'` |
| Cancelación revierte a Free al fin del periodo pagado | New `customer.subscription.deleted` case (fires when Stripe actually ends the subscription, not when the user merely requests cancellation): set `plan: 'free'` |

Scope: only reacts to Stripe's event stream — this story does not add any cancel/manage UI (that's FRESCO-231). Out of scope: partial-refund proration, per-change email notifications.

## Technical decisions

- ***API version note***: the pinned `stripe` API version (`2026-07-29.dahlia`) moved `current*period*end`/`current*period*start` off the top-level `Subscription` object onto each `SubscriptionItem` (`subscription.items.data[0].current*period*end`) — confirmed via the installed SDK's own `.d.ts`. Do not read a top-level `subscription.current*period*end`, it no longer exists on this API version's type.
- ***User lookup by customer id***: `customer.subscription.updated`/`.deleted` events carry no `client*reference*id` (that only exists on Checkout Sessions) — look up the `user*profiles` row by `stripe*customer_id` (written by FRESCO-228's `checkout.session.completed` handler) instead.
- ***Mid-cycle cancel request is a no-op here***: when a user cancels, Stripe sets `cancel*at*period*end: true` and fires `customer.subscription.updated` with `status` still `active` — per AC ("cancelación mantiene Pro hasta el final del periodo ya pagado"), this event should NOT downgrade the plan; only the eventual `customer.subscription.deleted` (when the period actually ends) does. The `active`-status branch above already handles this correctly by construction (it only ever sets `pro`, never `free`) — no extra `cancel*at*period*end` branching needed.
- ***No new DB columns.*** `plan` + `plan*expires*at` (both pre-existing) are sufficient.

## Tasks

1. `app/api/stripe/webhook/route.ts` — extend the event-type switch: add `customer.subscription.updated` and `customer.subscription.deleted` cases alongside the existing `checkout.session.completed`.
2. `lib/stripe.ts` — add two pure helpers next to `resolveProUpdateFromSession`, same style (no network, unit-testable): `resolveRenewalUpdate(subscription)` → `{ stripeCustomerId, planExpiresAt }` (throws if `status !== 'active'` or the item/period data is missing); `resolveCancellationCustomerId(subscription)` → `stripeCustomerId` (throws if missing).
3. Webhook route: for each new case, look up the `user*profiles.id` by `stripe*customer*id` via the service-role client, then write the update (`plan: 'pro'` + `plan*expires_at` for renewal; `plan: 'free'` for cancellation). If no matching row is found, log + no-op (same non-2xx-avoidance posture as the existing catch block) — this can legitimately happen for a customer created outside this app's flow.
4. Unit tests for both new helpers in `lib/stripe.test.ts`, same fixture style as the existing ones.

## Review Workload Forecast

Estimated: 90 additions + 5 deletions = 95 total lines
400-line budget risk: Low
Chain strategy: single PR
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
