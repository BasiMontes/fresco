# Audit 8 - Axis PRIV (privacy, GDPR / LOPDGDD / LSSI)
- Commit: staging 71ab0864, date 2026-11-03

## 1. Scope
Code read: delete-account/index.ts, _shared/{stripe-billing,account-erasure,posthog,posthog-erasure}.ts, lib/billing/checkout-guard.ts, app/api/stripe/checkout/route.ts, lib/api/profile-export.ts, lib/consent/cookie-consent.ts, components/auth/analytics-consent-sync.tsx, lib/posthog/server.ts, lib/legal/{consent,consent-status}.ts, app/api/{consents,waitlist,waitlist/confirm}/route.ts, legal-content-data.ts (privacy), reassign-guest-data (PostHog), sentry configs; migrations 20261017190000, 20261019150000/160000/170000/180000.
DB: 10 read-only SELECT runs (FK delete rules of all public tables with user_id, policies, counts only, cron.job names). Production HTTP: 0 requests. No login.

## 2. Findings (by severity)

### A8-PRIV-01 - Account deletion never erases the Stripe customer of an abandoned checkout (email + user id stay in Stripe forever)
- Severity: MEDIUM. Confidence: CONFIRMED (code path). Status vs audit 7: NEW (consequence of FRESCO-1002 creating the customer up front; the payments lead is confirmed).
- Evidence:
  - `lib/billing/checkout-guard.ts:58-61`: `stripe.customers.create({ metadata: { supabase_user_id: userId }, ...(email ? { email } : {}) }, ...)` is called inside `ensureCheckoutCustomer` BEFORE the Checkout Session exists (`app/api/stripe/checkout/route.ts:168`). `user_profiles.stripe_customer_id` is written only by the webhook (comment `route.ts:74`), so a user who opens Pro checkout and leaves has a Stripe customer with email and user id but `stripe_customer_id = null`.
  - `supabase/functions/delete-account/index.ts:118-121`: `customerId = profile?.stripe_customer_id ?? null; if (!customerId && !user.is_anonymous) customerId = await findStripeCustomerForUser(...)`.
  - `_shared/stripe-billing.ts:373-376`: that lookup lists `checkout.sessions` with `status: 'complete'` and `created >= now-72h` and matches `client_reference_id`. An abandoned (`open`/`expired`) session never matches, and a completed one older than 72 h is out of window. Result `null` -> `index.ts:170` records `stripe: 'none'` in `account_erasures` and no `customers.del` runs (`:339` only runs with a customerId).
  - Notable: the metadata the customer is created with (`supabase_user_id`) is already how `ensureCheckoutCustomer` finds it (`customers.search`, `checkout-guard.ts:50`), but `StripeBillingClient` in `_shared/stripe-billing.ts:33` exposes no `search`.
- Impact: a user who clicked "Pasar a Pro" and never paid, then deletes the account, keeps name-less but identifying data (email, internal user id) at Stripe indefinitely, while the privacy policy says personal data is erased within 30 days and the erasure record says `stripe: none`. GDPR art. 17 gap, grows with every abandoned checkout (same customer is reused, so one per user).
- Reproduction: not executed (deleting an account is a mutation). Path: pre account -> POST /api/stripe/checkout (customer created) -> close tab -> delete account -> Stripe test-mode dashboard still lists customer with `supabase_user_id`.
- Fix: in `findStripeCustomerForUser` (or before it) add `customers.search({ query: "metadata['supabase_user_id']:'<id>'" })` and delete every match via `cancelStripeBillingForCustomer`; keep the checkout-session scan only as a fallback for the index lag (search lags up to a minute). Test: unit test with a fake client where the customer has no completed session and no stored id and assert `customers.del` is called; one for a session outside 72 h.

### A8-PRIV-02 - Data export omits `recipe_user_feedback` (cooked/discarded marks) although the policy says they are recorded
- Severity: LOW. Confidence: CONFIRMED. Status: NEW (A7 checklist 2 said export covers every table; it does not).
- Evidence: `lib/api/profile-export.ts:32-38` reads profile, meal_plans, shopping_lists, recetas_propias, favorites, user_consents, push_subscriptions only. `public.recipe_user_feedback` (columns user_id, recipe_id, cocinada_at, descartada_at) has user_id with ON DELETE CASCADE (query q1) and 0 browser policies (`select from pg_policies where tablename='recipe_user_feedback'` -> no rows), so the user-scoped client could not read it even if asked. Rows today: 7 rows, 3 users. Policy `legal-content-data.ts:176/184`: "Si marcas una receta como cocinada o descartada, registramos esa señal".
- Impact: the access/portability right (art. 15/20) is incomplete for a data category the policy itself discloses; behaviour data tied to the person.
- Reproduction: `rg recipe_user_feedback lib/api/profile-export.ts app/api/profile/export` -> no hits.
- Fix: add a service-role (or SECURITY DEFINER, user-scoped) read of that table to `readUserDataForExport` and the CSV; test that the export contains a seeded mark.

### A8-PRIV-03 - Server-side PostHog events keep running on a stale analytics consent after the cookie decision expires or the texts change
- Severity: LOW. Confidence: CONFIRMED (code). Status: STILL-OPEN, partial of A7-PRIV-01 (browser cookie now versioned; the server mirror is not).
- Evidence: `cookie-consent.ts` now stores `decision~version~epoch` and `parseCookieConsent` returns null for another version (fixed). But `components/auth/analytics-consent-sync.tsx:`  `if (decision === null || !hasSupabaseSessionCookie()) { return; }` never writes on a null decision, and `lib/posthog/server.ts:54` / `_shared/posthog.ts:47` read only `user_profiles.analytics_consent === true`, a bare boolean with no version or date. After a `LEGAL_TEXTS_VERSION` bump (or cookie clear / 1-year max-age expiry) the banner reappears but the DB value stays `true`, so the Stripe funnel events and `send-weekly-reengagement-push` events (precisely for users who do not come back) continue until the person decides again. Live: 1 profile has `analytics_consent = true`.
- Impact: consent withdrawn-by-expiry or invalidated by new texts is not honoured server-side; and the controller still cannot show when a signed-in user consented (evidence lives only in the browser cookie).
- Reproduction: code path; no mutation done.
- Fix: when the cookie is absent/outdated for a signed-in user, sync `false` (or null) to `analytics_consent`; store `analytics_consent_at` + `analytics_consent_version` and require the current version in both `hasAnalyticsConsent` helpers. Test: unit test of the sync with `decision === null` and a db test for a stale version suppressing the event.

### A8-PRIV-04 - Re-consent does not cover `health_data`; the trigger accepts any version, so the reworded halal/religion consent never reaches earlier consenters
- Severity: LOW. Confidence: CONFIRMED. Status: STILL-OPEN A7-PRIV-06 (text fixed, version enforcement not).
- Evidence: `lib/legal/consent.ts:24` text now names the religious belief (fixed) and `legal-content-data.ts:176/180` too. But `lib/legal/consent-status.ts` `REQUIRED_CONSENTS = ['age_14','terms','privacy']` excludes `health_data`, so `ReconsentDialog` never asks for the reworded text; the trigger from `20261014100000` still accepts a `health_data` row of any version. Live: 1 profile has `dieta_halal = true` and 0 `health_data` rows at `provisional-2026-10-19` (and 0 at any version = the known legacy row, health_no_consent_any = 1 of 7 profiles).
- Impact: today one user; structurally every future halal user who consented under an older text keeps processing under it.
- Fix: ask for `health_data` at the current version when the profile holds allergens or halal; make the trigger compare against the current version. Test as in A7-PRIV-06.

### A8-PRIV-05 - `account_erasures.posthog = 'not_configured'` is final: a missing PostHog secret silently skips erasure for good
- Severity: LOW. Confidence: PLAUSIBLE. Status: NEW.
- Evidence: `_shared/posthog-erasure.ts` returns `'not_configured'` when `POSTHOG_API_HOST/PROJECT_ID/PERSONAL_API_KEY` are unset; `account-erasure.ts` stores `pending_posthog_distinct_id` only for `'failed'`, and `retry-posthog-erasures` selects only `posthog = 'failed'`. Live today: 3 rows `not_found`, 1 `deleted`, 1 `not_found`+stripe cancelled, 0 `not_configured`, 0 pending, so the secrets are set in prod now. A new environment or a rotated key would lose the person id with no retry.
- Fix: treat `not_configured` as `failed` (queue the id) outside local; test that it is queued.

## 3. A7 findings re-verified
| A7-ID | Verdict | Evidence |
|---|---|---|
| A7-PRIV-01 cookie consent unversioned | FIXED for browser cookie; server mirror still open | `cookie-consent.ts` `accepted~<version>~<epoch>`, `parseCookieConsent` null on other version; server gap = A8-PRIV-03 |
| A7-PRIV-02 no terms/privacy/age consent, no re-ask | FIXED (mechanism) | `consent-status.ts` `getMissingConsents`, `ReconsentDialog` in `app/(app)/layout.tsx:88`; live 6 of 12 non-anonymous users have no current `privacy` row and will be asked; fails open on read error by design |
| A7-PRIV-03 waitlist | FIXED | `20261019180000`: double opt-in via POST button (scanner-safe), 7d/12m retention cron `purge-waitlist-signups` active, token removal, browser INSERT revoked, policy section "Lista de Espera" present, 0 rows |
| A7-PRIV-04 guest retention + PostHog | FIXED | `cleanup_abandoned_guests` queues `account_erasures`; policy now says "a los 3 días de haberse creado la sesión"; cron active; 0 guests, 0 pending |
| A7-PRIV-05 sexo | FIXED | `20261019160000`; `information_schema` shows no `sexo` column (only `nombre` of the pair) |
| A7-PRIV-06 halal/art. 9 | PARTIAL, STILL-OPEN | text fixed, versioning not: A8-PRIV-04 |
| A7 "Stripe customer retention" (could-not-verify) | STILL-OPEN, now confirmed as A8-PRIV-01 | |

## 4. Checklist items that found NOTHING
- Server events without consent gate: all 6 call sites (webhook x5, grant-pro, weekly push) go through helpers that read `analytics_consent === true`, fail closed on read error.
- PII in Sentry/PostHog: Sentry `sendDefaultPii` not set, no `setUser`; browser Sentry only after consent (`sentry-consent-gate`); PostHog autocapture off, person properties only `plan`/`is_guest`.
- Orphans after deletion: all user tables (favorites, meal_plans, pending_confirmation_emails, push_subscriptions, rate_limits, rate_limit_exempt_users, recetas_propias, recipe_user_feedback, shopping_lists, user_consents) CASCADE from auth.users; `account_erasures` holds only a SHA-256.
- Consent registry integrity: INSERT revoked from clients, `record_consents` service-role only, 100-row cap.
- Banner equal weight (Rechazar/Aceptar same variant) unchanged after the FRESCO-1073 card redesign.
- Guest reassign path: alias merges the guest person into the target, so deleting the target's person covers it.
- Logs: no email/token in `console.*` of waitlist, consents, export routes.
- Third-party list: policy names Supabase, Stripe, PostHog, Sentry, Vercel, Resend, Cloudflare, Google, push providers; no other processor found in code.

## 5. Could not verify
- Stripe-side state (customers left after deletion): no Stripe read allowed; A8-PRIV-01 is code-path only.
- Whether PostHog/Sentry secrets are set in every environment (only the 5 `account_erasures` rows suggest prod works).
- Sentry IP-storage setting and retention; Supabase backup retention vs the "30 days" claim.
- Live signup writing the three registration consents (no account creation allowed).
- Minor: the policy sentence that billing and push events are recorded "no dependen de la analítica que aceptas o rechazas" does not match code, which suppresses them without consent (safe direction, INFO).
- INFO: waitlist confirmation mail is sent from the Resend sandbox sender, so real recipients will not get it until a domain exists (already known, FRESCO-886); signup then returns 502 and the row lives 7 days.

## 6. Hygiene
secrets_materialized: none
cleaned: yes
