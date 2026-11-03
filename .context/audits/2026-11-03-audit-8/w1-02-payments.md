# Audit 8 - Axis PAY

Commit: 71ab0864 (staging). Date: 2026-11-03. Auditor: subagent w1-02.

## 1. Scope
- Code read in full: `app/api/stripe/{webhook,checkout,portal,pro-price}/route.ts`, `app/api/cron/stripe-reconcile/route.ts`, `lib/stripe.ts` (lines 30-438), `lib/billing/{stripe-mode,grant-pro,subscription,checkout-guard,checkout-sweep,refund,refund-handler,dispute,dispute-handler,reconcile,stripe-errors,webhook-events,handled-events}.ts`, `supabase/functions/generate-meal-plan/entitlement.ts`, `supabase/functions/_shared/stripe-billing.ts`; ranges of `lib/legal/{pro-terms,consent-store}.ts`, `docs/workflows/stripe-go-live.md`, `scripts/check-stripe-*.ts`, `vercel.json`, `app/api/stripe/webhook/route.test.ts` (test titles).
- Read-only DB: 10 SELECTs via `supabase db query --linked` (billing_mode value/grants/RLS/policies, live `prevent_client_subscription_writes` source, user_profiles billing aggregates, stripe_webhook_events counts, triggers, policies, `record_consents` source, cron.job, job_heartbeat, pending_confirmation_emails, profile-less accounts). Live state: 0 `pro` rows (2 free rows with test ids, 5 free without), 169/169 webhook events completed, `billing_mode.stripe_livemode = false`, reconcile heartbeat `2026-11-03 04:17:03Z`, 0 pending confirmation emails.
- `vercel inspect https://fresco-dev.vercel.app` (read-only). 0 HTTP requests to production. No Stripe calls.
- API version: `2026-10-28.endive` appears in `lib/stripe.ts:88`, `supabase/functions/_shared/stripe-billing.ts:16`, `scripts/check-stripe-{go-live,endpoints}.ts`, `tests/{fixtures,test-helpers}.ts`, `tests/steps/suscripcion.steps.ts` (x9); `node_modules/stripe/cjs/apiVersion.js` default is the same string; Edge `deno.json` pins `npm:stripe@23.1.0`; no `new Stripe(` without `apiVersion`. All agree.

## 2. Findings

### A8-PAY-01 - A user in Stripe `unpaid` (or `paused`) is locked out of both checkout and the billing portal, and told "Ya tienes Fresco Pro."
- Severity: LOW (MEDIUM if the dunning rule is ever left on "mark unpaid"). Confidence: PLAUSIBLE (code path CONFIRMED; trigger needs a subscription in `unpaid`/`paused`. `docs/workflows/stripe-go-live.md` row `dunning` requires "cancel the subscription" as the final action, owner-acknowledged with `--ack dunning`, which keeps `unpaid` from arising, but `paused` and `incomplete` stay reachable and the dashboard rule is not machine-verified).
- Status vs audit 7: NEW (introduced by the FRESCO-1002 fix of A7-PAY-02).
- Evidence:
  - Webhook `exhausted` branch downgrades the profile to Free on `unpaid` but the subscription stays alive at Stripe and the ids stay on file: `app/api/stripe/webhook/route.ts:313-320` (`downgradeToFree`), comment 314-319 ("without necessarily canceling the subscription outright").
  - Checkout then asks Stripe: `lib/billing/checkout-guard.ts:17` `ENDED_STATUSES = ['canceled','incomplete_expired']`, `:67-68` `hasLiveSubscription` returns true for every other status, so `unpaid`/`paused`/`incomplete` are "live"; route returns `409 'Ya tienes Fresco Pro.'` (`app/api/stripe/checkout/route.ts:169-171`).
  - The portal refuses anyone whose profile is not `pro`: `app/api/stripe/portal/route.ts:70-72` -> `404 'No se encontró tu suscripción.'`.
  - So the only two self-service doors (pay again / update the card in the portal) are both closed; nothing cancels the `unpaid` subscription for them either.
- Impact: a customer whose card failed past the dunning window, and whose account is set to keep the subscription `unpaid`, cannot pay again or fix the card from the app and is told they already have Pro while the app shows Free. Support-only recovery; churn that looks like a bug.
- Reproduction: not executed (needs a failing renewal in test mode). Steps: test card 4000 0000 0000 0341 on a subscription, let dunning exhaust with "mark unpaid", log in, press "Pásate a Pro" -> 409; press "Gestionar mi suscripción" (hidden for Free in UI; direct POST) -> 404.
- Fix: let the portal open for any profile with a `stripe_customer_id` whose Stripe subscription is not ended (or whenever `payment_failed_at`/`unpaid`); in `hasLiveSubscription` treat only `trialing|active|past_due` as "already subscribed" and for `unpaid|paused|incomplete` return a 409 that points to the portal ("Actualiza tu método de pago"). Test: checkout route test "customer with an `unpaid` subscription -> not 'Ya tienes Fresco Pro.'" and portal test "free profile with unpaid subscription -> session created".

### A8-PAY-02 - Stripe customers created up front by checkout (email stored at Stripe) are never erased with the account unless a session completed in the last 72 h
- Severity: MEDIUM (GDPR art. 17 gap, personal data at a processor). Confidence: CONFIRMED (code path), not executed.
- Status vs audit 7: NEW (side effect of FRESCO-1002: before it, no customer existed until payment).
- Evidence:
  - `lib/billing/checkout-guard.ts:58-60` creates a customer for every checkout attempt with `{ metadata: { supabase_user_id }, email }`, profile untouched (`:7-11`).
  - Account deletion only knows a customer through `user_profiles.stripe_customer_id` (written by the webhook after a completed checkout) or `findStripeCustomerForUser`, which lists only `status: 'complete'` sessions of the last 72 h: `supabase/functions/_shared/stripe-billing.ts:366-384`; `delete-account/index.ts:118-121`. It never searches `metadata['supabase_user_id']`, which is how the checkout route itself finds the customer (`checkout-guard.ts:50-52`).
  - A user who opened "Pásate a Pro", saw Stripe Checkout and left (session expires in ~32 min, `checkout-guard.ts:28`) has a customer with their email and no `stripe_customer_id` on the profile; deleting the account leaves that customer at Stripe forever. Same for a user who paid more than 72 h before deleting and whose webhook never landed.
- Impact: erased users keep an identifiable Stripe record (email, id link `supabase_user_id`), contradicting the erasure promise and ADR-0043's intent ("end the Stripe billing and erase").
- Reproduction: not executed (would need a Stripe call). Test mode: start checkout, abandon, delete account via the app, then `stripe customers search metadata['supabase_user_id']:'<uuid>'` still returns the customer.
- Fix: in `delete-account`, when `profile.stripe_customer_id` is null also `customers.search({query: "metadata['supabase_user_id']:'<id>'"})` and run `cancelStripeBillingForCustomer` on every hit. Test: edge unit test "no stored id but a metadata customer exists -> customers.del called".

### A8-PAY-03 - The daily reconcile cron has no Stripe-mode guard: with a key of the other mode it reads every live-mode subscription as `resource_missing` and downgrades paying customers
- Severity: MEDIUM. Confidence: PLAUSIBLE (code path CONFIRMED; needs the documented rollback or a wrong key on the production scope; not executed).
- Status vs audit 7: NEW (FRESCO-1001 put the mode guard on the webhook, checkout and grant only).
- Evidence:
  - `app/api/cron/stripe-reconcile/route.ts:135-139`: `StripeError.code === 'resource_missing'` -> `target = { action: 'downgrade' }` ("treat exactly like a `customer.subscription.deleted`"). A key of the other mode answers exactly `resource_missing` for objects of the first mode (the go-live doc itself relies on that: "The production reconcile cron downgrades their old test subscription when the live key cannot find it", `docs/workflows/stripe-go-live.md` "After the flip").
  - The loop selects no mode: `lib/billing/reconcile.ts:27` selects `id, plan, plan_expires_at, payment_failed_at, stripe_subscription_id` (no `stripe_livemode`), and the route never calls `environmentLivemode()` / `readDatabaseLivemode()` (`rg "stripe-mode" app/api/cron` -> 0 matches; imports at route.ts:1-13).
  - `docs/workflows/stripe-go-live.md` "Rolling back": "update public.billing_mode set stripe_livemode = false together with the test keys on the production scope. Charges already made in live mode stay in Stripe". After that rollback the next 04:17 UTC run (cron `stripe-reconcile-subscriptions`, `17 4 * * *`, active) retrieves live-mode ids with a test key, gets `resource_missing` for each, and sets `plan: 'free'` for every real subscriber, while Stripe keeps billing them (their subscriptions are untouched) and their webhooks are refused (profile mode live vs DB test).
- Impact: customers who are paying lose Pro until the keys are restored, and nothing in the rollback text warns about it. Any future key mix-up on the production scope does the same silently (Sentry only sees `reconciled` warnings via console).
- Reproduction: not executed (needs live keys). Unit-level: feed `route.test.ts` a Stripe stub that throws `resource_missing` for a profile with `stripe_livemode: true` under a test key and observe `plan` written to `free`.
- Fix: at the top of the cron, `environmentLivemode()` vs `readDatabaseLivemode()`; on mismatch return 500 + Sentry and touch nothing. Select `stripe_livemode` in `listSubscribedProfiles` and `continue` (log) for profiles whose mode differs from the key's, instead of downgrading on `resource_missing`. Add the warning to the rollback section. Test: cron route test "profile of the other mode + resource_missing -> not downgraded".

### A8-PAY-04 - STILL-OPEN A7-PAY-03: the frozen fresco-dev deploy (2026-10-02, before every mode and claim guard) is still the live handler behind the `fresco-dev` Stripe endpoint, and the go-live doc says it is refused
- Severity: LOW (go-live gate; exploiting it needs a TEST-mode secret key or a dashboard resend, i.e. the owner, because fresco-pre now answers 503 on checkout once the database is live). Confidence: CONFIRMED for the deploy age and the doc claim; the Stripe endpoint state is not readable.
- Evidence:
  - `vercel inspect https://fresco-dev.vercel.app` -> `dpl_5Y7kMsqrEPUoikV91S1WMNSPT9Tb`, `created Fri Oct 02 2026 20:42:39 +0200 [32d ago]`, Ready. `vercel.json` still `git.deploymentEnabled.dev: false`.
  - `lib/billing/stripe-mode.ts` was added by `c6a0a5be` on 2026-10-17 (FRESCO-1001), 15 days after that build, so that deploy has no mode check, no `stripe_livemode` write, no FRESCO-1002 live re-read.
  - `docs/workflows/stripe-go-live.md` "The flip": "From this moment the events of `fresco-pre` and `fresco-dev` (test mode) are refused by every deploy" is false for the frozen dev deploy; only the owner-run `scripts/check-stripe-endpoints.ts` (exit 1 on an enabled endpoint pointing at a frozen deploy) stands between that and a live database.
- Impact: after go-live, any test-mode `checkout.session.completed` delivered to the dev endpoint (dashboard resend, a test session made with the test key by the owner or the e2e suite) is handled by the old code and writes Pro on the shared live row.
- Reproduction: not executed (would write). Read-only facts above.
- Fix: delete/disable the Stripe `fresco-dev` endpoint now (owner), or redeploy dev at the current SHA and re-enable it; make `check-stripe-endpoints` a required step in the flip section (it is only referenced from the checklist). Test: the script already is the control; add it to `required_checks` or the flip runbook as step 0.

### A8-PAY-05 - Returning from Checkout shows the Free upsell until the webhook lands; the CTA then answers "Ya tienes Fresco Pro." (residual UX of A7-PAY-02)
- Severity: LOW. Confidence: CONFIRMED (code), not executed.
- Evidence: `success_url` is `/profile?checkout=success` (`app/api/stripe/checkout/route.ts:186`) and `rg "checkout=success|checkout=cancelled"` over app/components/lib finds only those two lines, so nothing reads the parameter (same as audit 7). The double-purchase is now stopped server-side (`checkout/route.ts:169-171` 409 from Stripe, `checkout-guard.ts:196` expiry of other sessions), but the person sees "Pásate a Pro" and, if they press it, an error that says what is true yet reads as a bug.
- Impact: paying customers who see Free for the seconds-to-minutes of webhook latency may contact support or retry.
- Fix: read `?checkout=success` on /profile and show "Estamos activando tu plan" with a short refresh poll of `getUserPlan`; disable the CTA while it shows. Test: component test for the pending state.

### A8-PAY-06 - INFO: `activateProPlan` still ignores the affected row count (second half of A7-PAY-07)
- Severity: INFO. Confidence: CONFIRMED (code). `lib/billing/subscription.ts:56-71` `.update(...).eq('id', userId)` with no `.select()`; the checkout route now refuses a missing profile (`route.ts:137-139`, FIXED), so only a profile deleted between checkout and webhook reaches it, and account deletion cancels the subscription first. Live: `select count(*) from auth.users u where not is_anonymous and not exists (profile)` -> 5 (same as audit 7), all unable to start checkout now.
- Fix: `.select('id')` and throw on 0 rows. Test: subscription.test "activateProPlan throws when no row matched".

## 3. A7 findings re-verified

| A7-ID | Verdict | Evidence |
|---|---|---|
| A7-PAY-01 (no livemode guard) | FIXED in code (end-to-end not executable) | `lib/billing/stripe-mode.ts:66-94` two layers (key prefix + `billing_mode`); webhook `route.ts:127-148` refuses before the claim, `grant-pro.ts:34-37` again, checkout 503 `checkout/route.ts:97-110`, `stripe_livemode` stored (`subscription.ts:62`) and compared (`profileHoldsOtherMode`). `billing_mode`: RLS on, no policy, only `service_role` SELECT (live grants query), value false. Trigger now also guards `stripe_livemode` (live source). Residuals: A8-PAY-03, A8-PAY-04 |
| A7-PAY-02 (double checkout / refund mis-target) | FIXED in code, new side effects | up-front customer + `hasLiveSubscription` + idempotency bucket + `expires_at` + expire siblings (`checkout-guard.ts`); refund resolves the charge's own subscription (`refund.ts:71-92`, `refund-handler.ts:34-41`, test at `route.test.ts:559`). New: A8-PAY-01, A8-PAY-02, A8-PAY-05 |
| A7-PAY-03 (frozen dev deploy) | STILL-OPEN | deploy still 2026-10-02; see A8-PAY-04 (script exists, endpoint state unverifiable) |
| A7-PAY-04 (disputes) | FIXED | `HANDLED_EVENT_TYPES` has `charge.dispute.created`; `dispute-handler.ts` cancels only the charge's own subscription and reports to Sentry; go-live script checks the endpoint subscription |
| A7-PAY-05 (late `updated` re-grants) | FIXED | `route.ts:279-287` decides from `retrieveLiveSubscription`; `deleted` re-checks (`:387-393`); tests `route.test.ts:595,617,638` |
| A7-PAY-06 (waiver not enforced) | FIXED | `checkout/route.ts:147-156` requires a `withdrawal_waiver` row of the current version in the last 30 min (`hasRecordedConsent`); `record_consents` writes one per purchase. Not linked to the session id (accepted) |
| A7-PAY-07 (no profile) | PARTIAL: checkout side FIXED (`route.ts:137-139` 409); `activateProPlan` row count STILL-OPEN as INFO A8-PAY-06 |
| A7-PAY-08 (no go-live checklist) | FIXED | `docs/workflows/stripe-go-live.md` + `scripts/check-stripe-go-live.ts` (portal default config, endpoint events, prices tax_behavior, env var names, dunning ack). Gap: rollback text, A8-PAY-03 |
| A7-PAY-09 (refund failure 200, no retry) | FIXED | `route.ts:237-240` transient Stripe errors -> 500 after releasing the claim (`stripe-errors.ts`); test `route.test.ts:676` covers the non-transient 200 |
| A7-PAY-10 (unbounded past_due grace) | FIXED | `entitlement.ts:19-55` 30-day cap from the first failure; webhook stamps `payment_failed_at` only once (`route.ts:296-298`) |

## 4. Checklist items that found nothing

1. Entitlement without verified paid state: grant requires `payment_status` in {paid, no_payment_required}, live subscription trialing/active, Pro price id (`lib/stripe.ts:215-234`); client cannot write plan/Stripe columns (live trigger source incl. `stripe_livemode`); no DELETE policy; price id is server-side by `parseProInterval` (untrusted input coerced); orphan `pro` rows without subscription are swept daily.
2. Entitlement not revoked after cancel/failed payment/dispute/refund: `deleted`, `unpaid`, refund (full, current period, own subscription), dispute all end in `downgradeToFree`; Edge gate adds `plan_expires_at` + 30-day grace. Only gap: A8-PAY-01 (unpaid subscription lock-out), A8-PAY-03 (cron on wrong key).
3. Webhook replay / out of order: claim by `event.id` with TTL 5 min > `maxDuration` 60 s, compare-and-swap takeover, release on failure (`webhook-events.ts`); stale `updated`/`deleted` neutralised by a live re-read. Signature on raw body, missing header/secret -> 400. Live: 169 events, 169 completed, 0 open claims.
4. Race `checkout.session.completed` vs `customer.subscription.*`: an `updated` that wins is dropped by the stored-id check and self-heals via the grant's live read, the 48 h checkout sweep and the daily reconcile; no double grant found (funnel/email fire only when the stored id changes).
5. Service-role writes reachable from user input: checkout/portal/pro-price use the cookie client; the only service client in checkout is a fixed `billing_mode` read. `stripe_webhook_events` closed to client roles.
6. Trial once per account: server-side via stored Stripe ids (`isTrialAvailable`), `trial_period_days` only when no ids, `missing_payment_method: 'cancel'`; repeat via new accounts is the known FRESCO-923 decision.
7. Success/cancel URL open redirect: URLs are built from `request.nextUrl.origin` plus fixed paths; the browser's own Host decides it, so no third party controls the victim's redirect. Portal `return_url` same.
8. API version drift: 10 call sites + SDK default + Edge pin agree. Webhook handlers read only version-stable event fields (ids, `status`, `livemode`, `customer`, `charge.refunded/created/payment_intent`, `payment_status`) and re-read subscriptions with the pinned SDK, so an older endpoint payload version does not change behaviour (see section 5 for what could not be proven).
9. Tests that assert only the happy path: `webhook/route.test.ts` has 76 tests including mode mismatch both ways, fail-closed unknown key, stale `active`, stale `deleted`, other-subscription refund, unpaid checkout, in-flight 409, non-transient 200. The gaps are exactly the new findings (no test for `unpaid` lock-out, cron mode, up-front customer erasure).
10. Stripe/SDK range: `package.json` `^23.1.0` vs Edge `npm:stripe@23.1.0`; every client passes `apiVersion` explicitly, so a later 23.x cannot change the wire version. INFO only.

## 5. Could not verify

- Stripe dashboard state (existence and `api_version` of the dev/pre/pro webhook endpoints, `enabled_events`, dunning rule, default portal configuration, VAT): no Stripe reads allowed. The `api_version` an endpoint delivers is not checked by `check-stripe-endpoints.ts`; I argued from the fields the handlers use, not from a delivered payload.
- Every money flow end to end (double checkout race, refunds, disputes, the flip): would need payments.
- Whether `customers.search` lag or an idempotency replay after a customer deleted in the dashboard can break checkout (customer create is keyed `fresco-customer:<userId>` for 24 h): PLAUSIBLE, LOW, not pursued.
- Vercel/Supabase secret values by name only; not read.

## 6. Hygiene
- secrets_materialized: none
- cleaned: yes (no scratch files created beyond this report)
