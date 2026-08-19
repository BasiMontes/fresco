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

### Basi Montes - 8/17/2026, 8:54:58 PM

QA FALLIDO en staging (fresco-pre.vercel.app). La historia pide: acceder a la gestión de la suscripción Pro desde el perfil, poder cancelarla (manteniendo acceso hasta fin de periodo) y ver la fecha/monto del próximo cobro. Ninguna de estas tres funcionalidades existe en /profile ni en ningún otro punto de la app desplegada.

Repro:
1. Login en staging con cuenta QA (plan Free).
2. Ir a /profile.
3. La única pieza relacionada con Pro es la tarjeta 'Pásate a Fresco Pro', con un botón 'Próximamente' deshabilitado -- no hay checkout, no hay forma de tener una suscripción Pro activa.
4. Se revisaron también los 3 modales de la sección Ayuda (Configuración, FAQ, Privacidad) por si la gestión de suscripción estuviera ahí -- ninguno menciona suscripción, Pro ni Stripe.
5. Búsqueda en el código (rg 'suscripci|subscription|stripe' sobre app/) confirma que solo existe esa tarjeta con el botón deshabilitado; no hay ninguna sección de gestión/cancelación de suscripción implementada en ningún archivo.

Esperado: acceder a gestión de suscripción, cancelarla viendo que se retiene Pro hasta fin de periodo, y ver fecha/monto del próximo cobro.
Observado: no existe ningún punto de entrada a gestión de suscripción; el propio comentario en el código de app/(app)/profile/page.tsx indica que el checkout self-serve vía Stripe (EPIC-FRESCO-227) todavía necesita conectarse (pendiente de STORY-FRESCO-228), y no hay evidencia de que exista aún la pantalla de gestión/cancelación en absoluto.

Esta historia parece no implementada todavía, o depende de un prerequisito (checkout Stripe) que aún no ha llegado a staging.

---

### Basi Montes - 8/17/2026, 9:10:25 PM

QA FALLIDO en staging (fresco-pre.vercel.app). Re-verificado con una cuenta con Plan Pro activo real (no solo Free), para descartar que el problema anterior fuera de plan incorrecto.

Repro:
1. Login en staging con cuenta de Plan Pro real.
2. Ir a /profile -- se confirma el badge "Plan Pro" junto al email.
3. No existe ninguna sección de gestión ni cancelación de suscripción en toda la página. Las únicas secciones son: Tu nombre, Preferencias, Ayuda (Configuración/FAQ/Privacidad/Términos), Cuenta (Cerrar sesión, Backup CSV) y Zona de peligro (Eliminar cuenta).
4. No se muestra en ningún punto la fecha ni el monto del próximo cobro.
5. La tarjeta "Pásate a Fresco Pro" correctamente no aparece para este usuario (ya es Pro), pero no la sustituye ninguna sección de gestión de suscripción.
6. Se abrió el modal "Configuración" de Ayuda: no menciona suscripción, Pro ni Stripe.

Esperado: acceder a gestión de suscripción desde el perfil, poder cancelarla (reteniendo Pro hasta fin del periodo pagado) y ver fecha/monto del próximo cobro.
Observado: ninguna de las tres funcionalidades existe en la app desplegada, ni siquiera para una cuenta con Plan Pro activo.

Confirma el hallazgo de la verificación anterior (hecha con cuenta Free), esta vez descartado el plan como causa. La historia no está implementada en staging.

---

### Basi Montes - 8/19/2026, 11:15:36 AM

## Spec Implementation Plan (Dev)

## Goal

Let a Pro user manage/cancel her subscription from `/profile` via Stripe's hosted Customer Portal — same "hosted surface over custom UI" philosophy ADR-0007 established for checkout (Scope explicitly delegates payment-method changes to the Stripe portal; the portal natively shows next-invoice date/amount, satisfying that AC without any custom UI for it).

## Status note

Ticket was `Rechazos` (rejected 2026-08-17, twice, pre-FRESCO-228) — stale, zero Stripe integration existed at the time. Re-opened to `WIP`.

## Pre-work already done (Stripe account setup)

The Stripe test account had ***zero*** Customer Portal configurations — `billingPortal.sessions.create` would 400 without one. Created a default configuration via the API (`bpc*1U65aCGyXX8lW4CXCuJ71BCn`, `active: true`, `is*default: true`): `subscription*cancel` enabled in `at*period*end` mode (matches AC "sigo teniendo Pro hasta el fin del periodo"), `payment*method*update` enabled (Scope explicitly delegates this to the portal), `invoice*history` + `customer*update` (email only) enabled. No `subscription*update` (no multi-tier plans exist). This is test-mode only — production will need the same one-time configuration once live keys are in use (tracked in the same test/live-mode-split TODO as FRESCO-228/230).

## Acceptance Test Plan mapping

| AC scenario | Implementation step |
| --- | --- |
| Acceder a gestión de suscripción | New `ManageSubscriptionButton` client component on `/profile`, rendered when `plan === 'pro'` (mirrors `UpgradeToProButton`'s free-plan card, opposite condition) → `POST /api/stripe/portal` → redirect to the returned Billing Portal `url` |
| Cancelar la suscripción (retiene Pro hasta fin de periodo) | Native Stripe Portal behavior — the account-level configuration above sets cancellation mode to `at*period*end`. No app code writes anything here; FRESCO-230's `customer.subscription.deleted` handler already downgrades to Free when the period actually ends. |
| Ver mi próximo cobro (fecha y monto) | Native Stripe Portal UI — shown automatically once the customer lands in the portal, `invoice_history` feature enabled. No custom UI. |

Scope: portal access only for `plan === 'pro'` users; out of scope: in-app payment-method form (delegated to portal), pause (portal doesn't offer it, only cancel/reactivate).

## Technical decisions

- ***No new DB columns, no new webhook event types.*** The portal doesn't need app-side state — FRESCO-230's existing `customer.subscription.updated`/`.deleted` handlers already react to whatever the user does inside the portal (cancel, reactivate, payment-method change doesn't affect `plan`).
- ***Customer id source***: `app/api/stripe/portal/route.ts` reads the authenticated user's `stripe*customer*id` from `user_profiles` (written by FRESCO-228's checkout handler). If null (e.g., a `plan: 'pro'` row set some other way, or a `family` plan with no individual Stripe customer), return a friendly 4xx — the button surfaces that as an inline error, same pattern as `UpgradeToProButton`.
- `return_url`: back to `/profile`, same-origin pattern as the checkout route (`request.nextUrl.origin`).

## Tasks

1. `app/api/stripe/portal/route.ts` — `POST`: auth check (401 if none); read `stripe*customer*id` from `user*profiles` via the existing cookie-scoped server client (RLS already restricts to the caller's own row, no service-role client needed here — this is a read of the user's OWN data, unlike the webhook); 404-style JSON error if missing; `stripe.billingPortal.sessions.create({ customer, return*url })`; return `{ url }`.
2. `components/profile/manage-subscription-button.tsx` — new Client Component, same shape as `upgrade-to-pro-button.tsx` (loading state, inline `role="alert"` error, no Sonner — matches the established repo convention).
3. `app/(app)/profile/page.tsx` — add a `plan === 'pro'` counterpart card ("Tu suscripción Pro" or similar) rendering `<ManageSubscriptionButton />`, symmetric to the existing `plan === 'free'` upsell card.
4. No new unit-testable pure logic here (unlike 228/230 — this route has no branching business logic worth extracting, it's a straight auth-check + one Stripe call + one DB read). No new tests planned; call this out explicitly in Stage 3 review as a deliberate scope call, not an oversight.

## Review Workload Forecast

Estimated: 90 additions + 5 deletions = 95 total lines
400-line budget risk: Low
Chain strategy: single PR
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
