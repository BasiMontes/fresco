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

### Basi Montes - 8/17/2026, 9:12:56 PM

QA en staging (fresco-pre.vercel.app): con un usuario en plan Free, en /profile la tarjeta "Pásate a Fresco Pro" muestra el botón con el texto "Próximamente" y en estado disabled — no lleva a ningún flujo de pago/checkout.

Pasos: 1) iniciar sesion con un usuario Plan Free. 2) ir a /profile. 3) localizar la tarjeta "Pasate a Fresco Pro".

Esperado (AC): al tocar el boton, la usuaria deberia ser llevada a completar el pago de la suscripcion Pro (con opcion de prueba de 7 dias sin tarjeta), y tras completar el pago el perfil deberia mostrar el plan Pro activo.

Observado: el boton esta deshabilitado y no hace nada. El propio comentario en el codigo (app/(app)/profile/page.tsx, commit 6e3263d) confirma que el boton "still needs to be wired to the real checkout flow once STORY-FRESCO-228 ships" - es decir, el checkout de Stripe todavia no esta conectado en el commit desplegado a staging. Ninguno de los 3 escenarios de AC (iniciar checkout, trial sin tarjeta, pago activa Pro) es alcanzable.

---

### Basi Montes - 8/18/2026, 5:22:31 PM

## Spec Implementation Plan (Dev)

## Goal

Wire the disabled "Pásate a Fresco Pro / Próximamente" CTA on `/profile` to a real Stripe Checkout flow: click → redirect to hosted Checkout (Pro €4.99/mes, 7-day trial, no card required at start) → on payment completion the webhook flips `user_profiles.plan` to `pro` → user sees Pro active back in the app.

Architecture decision (Stripe Checkout, hosted, `subscription` mode, webhook-only writer of subscription state) recorded in ***ADR-0007*** — see `.context/ADR/ADR-0007-stripe-checkout-hosted-webhook-driven-subscription.md` (Status: Proposed, pending human accept).

## Acceptance Test Plan mapping

Source: `comments.md` (custom field over 255-char cap, fallback comment).

| AC scenario | Implementation step |
| --- | --- |
| Iniciar checkout desde el perfil | `UpgradeToProButton` client component → `POST /api/stripe/checkout` → redirect to `session.url` |
| Trial sin tarjeta | Checkout Session created with `trial*period*days: 7`, `payment*method*collection: 'if_required'` |
| Pago completado activa Pro | `POST /api/stripe/webhook` handles `checkout.session.completed`, updates `user*profiles.plan/stripe*customer*id/stripe*subscription*id/plan*expires_at` via service-role client |

Scope: CTA visible only for `plan === 'free'` (already true today). Price shown €4.99/mes (already in the card copy — no change needed there). Out of scope: multiple plan tiers beyond Free/Pro, discounts/coupons.

## Tasks

1. ***Migration*** — `supabase/migrations/<ts>*add*stripe*columns*to*user*profiles.sql`: `stripe*customer*id text unique`, `stripe*subscription*id text unique` on `user*profiles`. Nullable, no default. Applied via Supabase MCP `apply*migration`.
2. `bun add stripe` — official Node SDK.
3. `lib/stripe.ts` — server-only singleton `stripe` client, fails fast if `STRIPE*SECRET*KEY` missing (same fail-fast-public-method pattern as `api/config/env.ts`).
4. `lib/supabase/service.ts` — new service-role Supabase client factory (bypasses RLS), for the webhook handler only — analogous to `lib/supabase/server.ts` but keyed with `SUPABASE*SERVICE*ROLE_KEY`, never imported from a Client Component.
5. `app/api/stripe/checkout/route.ts` — `POST`: read authenticated user via `createClient()` (cookie-based), 401 if none; create Checkout Session (`mode: 'subscription'`, `price: process.env.STRIPE*PRICE*ID*PRO`, `trial*period*days: 7`, `payment*method*collection: 'if*required'`, `client*reference*id: user.id`, `success*url`/`cancel*url` back to `/profile`); return `{ url }`.
6. `app/api/stripe/webhook/route.ts` — `POST`: verify signature (`stripe.webhooks.constructEvent`, raw body, `STRIPE*WEBHOOK*SECRET`); on `checkout.session.completed`, extract pure helper `resolveProUpdateFromSession(session, subscription)` → `{ userId, stripeCustomerId, stripeSubscriptionId, planExpiresAt }`; write via service-role client. Non-2xx only on signature failure (Stripe retries on non-2xx, so downstream errors after verification still return 200 + log, per Stripe's own recommendation, to avoid retry storms on a bug).
7. `components/profile/upgrade-to-pro-button.tsx` — new Client Component wrapping the existing `Button`: `onClick` → POST checkout route → `window.location.href = url`; loading state (disable + spinner text) while awaiting; error toast (Sonner, already in repo) on failure.
8. `app/(app)/profile/page.tsx` — swap the hardcoded `disabled`/"Próximamente" `Button` (L169-172) for `<UpgradeToProButton />`; trim the now-stale doc-comment paragraph (L22-32) that explains why it's disabled.
9. `.env.example` — document `STRIPE*SECRET*KEY`, `STRIPE*PRICE*ID*PRO`, `STRIPE*WEBHOOK_SECRET` under a new "Stripe (EPIC-FRESCO-227)" section.
10. ***Unit test*** — `resolveProUpdateFromSession` pure helper (`lib/stripe.test.ts` or colocated): maps a fake session+subscription to the expected update shape; no network.

## Technical decisions (story-local, non-ADR)

- Webhook returns 200 even on a downstream DB-write failure after signature verification passes, to avoid Stripe retry storms; the failure is logged with the event id for manual replay. (If this needs alerting later, that's a follow-up story, not blocking 228.)
- `plan*expires*at` on trial start = the subscription's `trial*end` (unix seconds → ISO); once trial converts to active billing, a later event would update it to `current*period_end` — but 228's scope only needs the trial-start write since AC 3 only asks that Pro shows active after payment, not the full lifecycle (that's FRESCO-230).

## Review Workload Forecast

Estimated: 300 additions + 15 deletions = 315 total lines
400-line budget risk: Medium
Chain strategy: single PR (cohesive feature, under budget — no chaining needed)
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
