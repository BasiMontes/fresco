# Audit 8 - consolidated findings

Date: 2026-11-03. Commit audited: `71ab0864` (staging); production `main` at `bc75ab81` (docs-only delta). Method: 13 read-only axis audits run by subagents in 5 waves, brief in `00-brief.md`, one report per axis in this folder (`w1-*` to `w5-*`). No Jira card was created by this document.

Process note: this pass was run while the audit-7 remediation epic FRESCO-986 was still open (status `Listo`, 38 children `Finalizada`, 3 `Listo`, 3 `Rechazos`, 1 `Aplazada`, 1 `Blocked`). `audit-process.md` section 2 says a new pass waits for the open epic to close. The owner explicitly chose to run it anyway on 2026-11-03; findings should be appended to FRESCO-986, not spun into a parallel epic.

Verification status: every finding below is as reported by the axis auditor. The coordinator did not re-run the evidence. No audit-8 finding was independently reproduced by a second reader, and no score is given: the reports count findings, they do not carry a rubric score.

## 1. Counts

| Severity | Raw | After merging 5 duplicate pairs |
|---|---|---|
| BLOCKER | 0 | 0 |
| HIGH | 2 | 2 |
| MEDIUM | 23 | 19 |
| LOW | 33 | 33 |
| INFO | 10 | 9 |
| Total | 68 | 63 |

Merged pairs (survivor first): A8-PAY-02 absorbs A8-PRIV-01; A8-SUPPLY-01 absorbs A8-OPS-01; A8-SAFEA-02 absorbs A8-SAFEB-03; A8-SAFEA-03 absorbs A8-SAFEB-02; A8-ABUSE-02 absorbs A8-API-03.

Per axis (raw): AUTHZ 4 (2M 2L), PAY 6 (2M 3L 1I), SAFEA 8 (1H 5M 1L 1I), SAFEB 7 (3M 3L 1I), PRIV 5 (1M 4L), API 3 (2L 1I), SUPPLY 6 (1M 3L 2I), LOGIC 8 (2M 6L), UI 1 (1M), TEST 6 (2M 3L 1I), OPS 4 (1M 1L 2I), LAUNCH 5 (2M 3L), ABUSE 5 (1H 1M 2L 1I).

Coverage: 658 active recipes read (both halves, 120 new ones from FRESCO-953 included); 16 live SELECTs for AUTHZ; 9 production GETs for API, 9 for LAUNCH; the full unit suite ran (5506 pass, 656 skip) plus 4 randomized runs.

## 2. HIGH

| ID | Finding | Confidence | Link to audit 7 |
|---|---|---|---|
| A8-SAFEA-01 | "Ensalada cesar" (`ensalada-cesar-al-estilo-mediterraneo-con-guarnicion-de-temporada`) declares `sin_huevo` with no `huevo` or `pescado` tag; its sibling "Ensalada César con pollo" tags both for the same dressing | PLAUSIBLE | still open from A7-SAFEA-22 |
| A8-ABUSE-01 | FRESCO-1006 guards only `/api/auth/guest-email`; a guest session can call Supabase `PUT /auth/v1/user {email}` directly with no captcha and no app limit; the 3/h limit is keyed on a guest `user.id` that a disposable guest rotates (`lib/auth/turnstile-verify.ts` itself says Supabase does not enforce captcha there) | PLAUSIBLE, not exercised | still open from A7-ABUSE-02 |

## 3. MEDIUM

| ID | Finding | Link to audit 7 |
|---|---|---|
| A8-PAY-02 (+A8-PRIV-01) | Checkout creates the Stripe customer up front with email and `supabase_user_id` (`lib/billing/checkout-guard.ts:58`); account deletion finds customers only by stored id or sessions completed in 72 h (`_shared/stripe-billing.ts:373`); an abandoned checkout is never erased and `account_erasures` records `stripe: none`. GDPR art. 17. Fix: `customers.search` on `metadata['supabase_user_id']` | new |
| A8-PAY-03 | Daily reconcile cron has no Stripe-mode guard; with a key of the other mode `resource_missing` reads as "subscription ended" and downgrades paying customers; the documented go-live rollback triggers exactly that (PLAUSIBLE) | new |
| A8-AUTHZ-01 | `reassign_guest_data` blanks only allergen matches; diet, disliked ingredients and inactive recipes still land in the account's menu (sibling of the fixed `copy_meal_plan_to_week`) | sibling of A7-AUTHZ-01 (per the auditor) |
| A8-AUTHZ-04 | Password change and guest email change are enforced by the app only; server side depends on a hosted Auth toggle that cannot be read; GoTrue can be called directly for the email change, skipping captcha and rate limit (PLAUSIBLE) | still open from A7-AUTHZ-05 |
| A8-SAFEA-02 (+A8-SAFEB-03) | `sin_gluten=true` on about 26 rice and stew recipes (10 in first half, 16 in second) that use a stock only in the steps; the repo oracle does not read it | new pattern |
| A8-SAFEA-03 (+A8-SAFEB-02) | Curry dishes (4 in first half, 6 green-curry tofu and 3 "Curry de leche de coco" in second) with no `mostaza` tag and no paste listed, claimed vegano and `sin_gluten` (PLAUSIBLE) | A7-SAFEB-11 still open |
| A8-SAFEA-04 | 3 recipes use an unspecified "bebida vegetal" in vegano or `sin_lactosa` claims | new |
| A8-SAFEA-05 | Falafel con salsa de yogur: only chickpeas listed, `sin_gluten` and `sin_huevo` true, no `sesamo` | new |
| A8-SAFEA-06 | "Pad thai de gambas" (`pad-thai-de-gambas-b41`): `sin_huevo` true, no `pescado` tag | not stated |
| A8-SAFEB-01 | `kosher=true` on monkfish in `rape-plancha-verduras` and `pescado-blanco-papillote-limon` (CONFIRMED from recipe text) | new |
| A8-SUPPLY-01 (+A8-OPS-01) | `bun audit`: 7 vulnerabilities, 1 critical (`dompurify` 3.4.16 under `posthog-js`, shipped to the browser) and 3 high (2 `happy-dom`, dev only); the `override` floor `^3.4.16` sits inside the vulnerable range, 3.4.17 exists; weekly workflow red 2026-10-26 and 2026-11-02 with no issue opened; Dependabot shows 0 alerts. Reachability needs PostHog project compromise | new |
| A8-LOGIC-01 | Fresh seafood and meat priced as tins or whole pieces: "Mejillones al vapor" 1 kg shows 29 EUR (estimate 4 EUR), 300 g of bacalao shows 34,51 EUR | new |
| A8-LOGIC-06 | Shopping-list "Total estimado" comes from `estimateMenuCost` dictionary portions, 1.5-2x the sum of its own lines (217 vs 134 EUR over 8 weeks) and about 2.5x the stored 74-100 EUR range | new |
| A8-TEST-01 | Stripe webhook unit test mocks `constructEvent` and nothing pins its arguments; no merge-blocking gate sends a forged or tampered signature; deleting the verification line turns only one test red | new |
| A8-TEST-04 | `test:random` order dependence: run with `--seed=703177167` gives 4 failures, all in the `/update-password current password (FRESCO-1015)` component tests, each at the 15 s timeout; 2 of 4 randomized runs failed. Cause not isolated | not stated (audit 6 had order dependence) |
| A8-UI-01 | Every page without its own metadata (4 legal pages, `/sobre-nosotros`, the 404) declares the HOME as canonical (`app/layout.tsx:108`); confirmed on production for `/legal/privacidad`; the sitemap lists those URLs | new |
| A8-ABUSE-02 (+A8-API-03) | `/api/waitlist` has no captcha, only 5 signups per IP per hour; each distinct address triggers a mail from the account that also sends Stripe confirmations (PLAUSIBLE; double opt-in design accepted) | not stated |
| A8-LAUNCH-01 | Production has `GMAIL_SMTP_APP_PASSWORD`, so the subscription confirmation and the waitlist double opt-in go through Gmail; the privacy policy names Resend for that mail and Google only for login and reset mail | new |
| A8-LAUNCH-02 | Nothing records that a confirmation mail reached a non-owner mailbox, which the go-live doc requires (`pending_confirmation_emails` 0 rows, `billing_mode.stripe_livemode` false); fix: `--ack email-delivery` in the go-live script (PLAUSIBLE) | new |

## 4. LOW

| ID | Finding | Link to audit 7 |
|---|---|---|
| A8-PAY-01 | A subscription in `unpaid` or `paused` is locked out of checkout (409 "Ya tienes Fresco Pro.") and the portal (404) | new |
| A8-PAY-04 | Frozen `fresco-dev` deploy (2026-10-02) is still the handler behind its Stripe endpoint; the go-live doc says it refuses test events, which is false for that build | still open from A7-PAY-03 |
| A8-PAY-05 | Nothing reads `?checkout=success`; the Free upsell shows until the webhook lands | residual of A7-PAY-02 |
| A8-AUTHZ-02 | `authenticated` can still UPDATE `meal_plan_recipes.dia`/`meal_plan_id` and `meal_plans.semana_iso`/`user_id`/`advertencias`/`explicacion_aprendizaje`/`coste_estimado`; only `coste_estimado` is written by the client; own rows only | still open from A7-AUTHZ-03 |
| A8-AUTHZ-03 | `get_safe_ingredient_substitutes` still executable by `anon` | still open from A7-AUTHZ-04 |
| A8-SAFEA-07 | 20 recipes `vegetariano` with feta, queso azul or mozzarella (animal rennet convention), 4 of them new | convention |
| A8-SAFEB-04 | `halal` and `kosher` true on `pollo-teriyaki-con-arroz-b60` (mirin or sake) | new |
| A8-SAFEB-05 | `ingredientes_cantidades` omits "caldo de verduras" in 10 rows | new |
| A8-SAFEB-06 | `bajo_fodmap=true` on whole avocado and large sweet-potato portions (about 17 rows) | not stated |
| A8-PRIV-02 | Data export omits `recipe_user_feedback` although the policy discloses it | new |
| A8-PRIV-03 | Server-side PostHog events keep using the stale boolean `analytics_consent` after the cookie decision expires | new |
| A8-PRIV-04 | `health_data` is not in the re-consent set and the trigger accepts any version | remainder of A7-PRIV-06 |
| A8-PRIV-05 | PostHog erasure with `not_configured` is final and never retried (PLAUSIBLE) | new |
| A8-API-01 | Waitlist confirm/remove token travels in the page URL and reaches PostHog and Sentry (`app/providers/posthog-provider.tsx:68-85`); code reading only | new |
| A8-API-02 | Non-UUID `nueva_recipe_id` in `update-recipe-status` answers 500 and pages Sentry (22P02 from `get_filtered_recipes(p_recipe_id uuid)`) | remainder of A7-API-05 |
| A8-SUPPLY-02 | `post-deploy-smoke.yml` expands `deployment_status.target_url` inline in `run:` (lines 106-123) in a job holding `LIVE_E2E_ENV_FILE`; needs repo write access | new |
| A8-SUPPLY-03 | `pr-check.yml` has no `permissions:` block | A7-SUPPLY-03 second half |
| A8-SUPPLY-04 | `refresh-supermarket-prices.yml` and `spike-supermarket-probe.yml` lack `persist-credentials: false`; spike inlines a dispatch input | new |
| A8-LOGIC-02 | Generic 0,80 EUR per unit fallback mis-prices piece-counted items | residue of A7-LOGIC-01 |
| A8-LOGIC-03 | Per-row `Math.ceil` before summing overbuys fractional pieces (7 half-lemons list as 7 lemons) | residue of A7-LOGIC-02 |
| A8-LOGIC-04 | Onboarding uses `getIsoWeek(new Date())` in UTC; in the first 1-2 hours of Monday in Madrid the first menu is for the previous week | new |
| A8-LOGIC-05 | "Usar este menú" (`copy_meal_plan_to_week`) turns `excluida` slots into `pendiente` with no recipe ("Sin receta") | new |
| A8-LOGIC-07 | Pro history exclusion falls back only when a meal type is empty, not when merely too small (10 safe lunches, 7 cooked, 4 lunches empty) | A7-LOGIC-09 half fixed |
| A8-LOGIC-08 | Menu generated mid-week (a Friday) spends best picks and budget on days already past | new |
| A8-TEST-02 | Allergen oracle: 0 problems on 658 live recipes but misses tortilla, wrap, penne, cheddar, pecanas, dijon and never reads `nombre` | follow-up of A7-TEST-01 (oracle now reads steps) |
| A8-TEST-03 | Daily Turnstile widget check covers staging only; production is a manual run | A7-TEST-06 partial |
| A8-TEST-05 | Coverage denominators leave out `proxy.ts` and root `instrumentation*.ts`; honest floor is 92.5, not 92.0 | new |
| A8-OPS-02 | Waitlist confirmation failure is `console.error` only (no Sentry) and returns 502 | sibling of A7-OPS-03 |
| A8-ABUSE-03 | Waitlist mail failure leaves the row throttled: the retry answers 200 "pending" and sends nothing for 10 minutes | new |
| A8-ABUSE-04 | Image optimizer still open to any Unsplash `/photo-*` or Pexels `/photos/**` URL with any query string | not stated |
| A8-LAUNCH-03 | Pre `og:image` points at the SSO-protected third host | residue of A7-LAUNCH-07 |
| A8-LAUNCH-04 | Landing FAQ for coeliacs still answers "Sí" with no label caveat | not stated |
| A8-LAUNCH-05 | Home `lastmod` in the sitemap is hard-coded to 2026-09-12 | residue of A7-LAUNCH-08 |

## 5. INFO

- A8-SAFEA-08: incomplete ingredient lists that break no flag.
- A8-SAFEB-07: `paleo` true with wine (10 rows), `vegetariano` true with unspecified-rennet cheese.
- A8-SUPPLY-05: owner and admin identities in the public repo grew (26 email hits, from 14); still open from A7-SUPPLY-05.
- A8-SUPPLY-06: no CodeQL or code scanning; still open from A7-SUPPLY-06.
- A8-ABUSE-05: card-less 7-day trial is once per account, not per person; already known as C-22 / FRESCO-923.
- A8-PAY-06: `activateProPlan` ignores the affected row count (second half of A7-PAY-07).
- A8-OPS-03: `RESEND_API_KEY` is set in no Vercel scope; all outbound mail rides one Gmail account (known: FRESCO-886).
- A8-OPS-04: scheduled monitors run every 3-9 h; external monitor existence unverifiable (known: FRESCO-951).
- A8-TEST-06: the A7-TEST-08 tautologies are unchanged and `fast-check` still appears in one file.
- (merged) A8-API-03: waitlist can mail third-party addresses, bounded; see A8-ABUSE-02.

## 6. Cross-cutting patterns

- Stock or sauce named only in the recipe steps: root of A8-SAFEA-02, A8-SAFEB-03, A8-SAFEA-03, A8-SAFEB-02 and A8-TEST-02. About 26 `sin_gluten` claims depend on it and the repo oracle reads none of it.
- Fix covers the path the auditor probed, not its sibling: A8-ABUSE-01 (app route guarded, Supabase endpoint not), A8-AUTHZ-01 (copy function filters, reassign does not), A8-OPS-02 (subscription mail reported, waitlist mail not), A8-AUTHZ-02/-03 (some columns and functions revoked, others not).
- Claims in docs or UI stronger than the facts: privacy policy names Resend while mail goes through Gmail (A8-LAUNCH-01); go-live doc says the frozen dev deploy refuses test events (A8-PAY-04); coeliac FAQ (A8-LAUNCH-04); `paleo`, `keto`, `bajo_fodmap`, `halal` and `kosher` shown as tag pills and catalogue filters (`lib/recipes/labels.ts:20`, `components/recipes/recipe-library.tsx:28`) while only `keto` and `halal` exist as profile diets.
- Alerts that go nowhere: weekly dependency audit red twice with a critical and no issue (A8-SUPPLY-01/A8-OPS-01); waitlist mail failure invisible to Sentry (A8-OPS-02); one random-order failure whose name was lost (A8-TEST-04).

## 7. Re-verification of audit 7, as reported per axis

| Axis | Reported verdict |
|---|---|
| AUTHZ | A7-AUTHZ-01, -02, A6-S1 and audit-5 B2 fixed and verified; -03 and -04 partly fixed; -05 server side unverifiable |
| PAY | 9 of 10 fixed (01, 02, 04, 05, 06, 08, 09, 10 and 07 in the checkout route); 03 still open. 01 and 02 verified in code only, no Stripe call made |
| SAFE | about 18 of 23 first-half items fixed and 5 still open; 10 of 13 second-half fixed, A7-SAFEB-11 open, A7-SAFEB-10 partial. The 120 new recipes of FRESCO-953 are clean for allergens and `sin_*` flags |
| PRIV | 4 fixed (02, 03, 04, 05), 01 fixed in the browser with the server mirror open, 06 partial |
| API | 01 to 04 fixed, 05 fixed except A8-API-02, no regression |
| SUPPLY | 3 fixed (01, 02, 04), 03 half fixed, 05, 06, 07 open, 08 not re-probed. FRESCO-1081 and FRESCO-1082 diffs clean, all actions SHA-pinned |
| LOGIC | 9 of 10 fixed, A7-LOGIC-09 partial; 01 and 02 fixed for the listed cases with residue |
| UI | 16 of 17 fixed, A7-UI-10 partial (6 verified live, 11 from code) |
| TEST | 7 fixed (01 to 05, 07, 09), 06 partial, 08 open (INFO) |
| OPS | 3 fixed (02, 03, 05), 01, 04, 06 open or unverifiable |
| LAUNCH | 02, 03, 05, 06 fixed; 01 and 04 fixed in code only; 07 and 08 fixed except the og:image and the sitemap `lastmod` |
| ABUSE | 03, 04, 05 fixed; 01 partial; 02 open; 06 unchanged and accepted |

## 8. Not verified (limits of this pass)

- Every authenticated screen was not exercised live. The login form needs a Turnstile token; headless Chrome never completed it and the auditor did not bypass it. The Configuración and FAQ modals (FRESCO-1074), the profile layout and all in-app screens were read from code only. `/signup` and `/forgot-password` timed out in the UI script.
- Hosted Auth settings: current-password enforcement, email-change limits, anonymous sign-in limits, email quota. Whether `TURNSTILE_SECRET_KEY` is set in production. Resend and Vercel plan quotas.
- Stripe: no call was made; payment end to end, dunning and the live flip were not run.
- DB integration and e2e counts (need Docker), and the coverage run itself.
- About 130 generated plant, tamari and tofu recipes in the first half were checked by script and by reading the hit rows, not every row by eye.
- The `SAFEB` and `TEST` auditors each reported once as "waiting on own background work"; `TEST` later finished and upgraded A8-TEST-04 (included above). No later notification superseded the `SAFEB` report used here.
- One stray 2-byte `placeholder.txt` was written by the UI auditor into a mistyped scratchpad directory outside the repo; harmless.

## 9. Corrections to the record

- FRESCO-908 (human allergen review) is `Finalizada` (2026-10-23), closed on an AI review that the owner accepted as "no es una revisión humana" (ADR-0066). `revision-alergenos-2026-10-16.csv` still has `revisada_por_fecha` empty in 538 of 538 rows. The audit-7 consolidated text that calls it pending predates the closure.
- The audit-7 consolidated figure of 158 recipes with some defect was never re-measured as a single number here; audit 8 counts by finding, not by recipe.

## 10. Launch gate (from the LAUNCH axis)

Blocking before charging real users: autónomo alta with NIF and full address (the alta is free, the cuota is the cost); Vercel Pro and Supabase Pro (no free path); the Stripe live-flip checklist; one real confirmation-email delivery test. A free-only public launch is not blocked by the LAUNCH axis. Full gate table with the free path per item: `w5-02-launch.md`.

## 11. Suggested order of work (not a plan, no cards created)

1. A8-ABUSE-01 and A8-PAY-02/PRIV-01: the HIGH and the GDPR gap.
2. A8-SUPPLY-01: raise the `dompurify` override floor and open an issue on audit failure.
3. A8-SAFEA-01, then the stock-in-steps cluster (A8-SAFEA-02/-03, A8-SAFEB-01): fix the data and extend the oracle to steps and `nombre`.
4. A8-TEST-04 and A8-TEST-01: the order-dependent `/update-password` tests, and a real-signature webhook test in a merge-blocking gate.
5. A8-LAUNCH-01/-02 before any real charge; A8-UI-01 (per-page canonical) as a one-file fix.
