# Audit-7 wave 4, axis LAUNCH (w4-02)
Commit 1feb6062 (staging == prod 278d56fd). Date 2026-10-17. Legal items are PLAUSIBLE unless the code contradicts a stated obligation. I am not a lawyer.

## Findings

### A7-LAUNCH-01 HIGH CONFIRMED (norm: TRLGDCU art. 98.7 / Dir. 2019/770 durable-support confirmation)
Evidence: lib/email/resend.ts:4-11 `const SEND_FROM = 'Fresco <onboarding@resend.dev>'` with the author's own comment "Resend restricts an account with no verified domain to delivering only to the account owner's own address, so real customers will not receive this email". Send failure is caught and only logged (lib/billing/grant-pro.ts catch block, "subscription confirmation email failed"). Terms/UI promise it (lib/email/templates/subscription-confirmation.ts:139 cites art. 98.7).
Impact: every real subscriber pays/starts a trial without receiving the legally required confirmation (identity, price, renewal, how to cancel, waiver acknowledgement). Only a log line records it. w2-01 flagged the sender as "already known" and deferred consumer-law impact to this axis.
Reproduction: not executed (no payments, no email). Read-only code path above.
Fix: do not charge real users until a verified sender domain exists (frescoapp.es not bought, no-spend rule) OR send the confirmation through the already-working Gmail SMTP path / show it in-app + store it; alert when send fails. Test: grant-pro test that a send error surfaces a durable "confirmation pending" marker.

### A7-LAUNCH-02 MEDIUM CONFIRMED (norm: TRLGDCU art. 98.7 accuracy)
Evidence: lib/email/templates/subscription-confirmation.ts:160 hard-codes "Suscripción mensual con renovación automática" while the annual plan exists (components/profile/pro-checkout-summary.tsx Mensual/Anual, FRESCO-844); params (lines 10-17) carry no interval. lib/billing/grant-pro.ts:~108 `priceFormatted: formatChargedAmount(price?.unit_amount...)` and line 166 "Importe total cobrado" are printed even in the card-less 7-day trial, when nothing has been charged (lib/legal/pro-terms.ts PRO_TRIAL_SUBSCRIPTION_DATA).
Impact: an annual subscriber is told "mensual" with their annual price; a trial user is told "Importe total cobrado: X" though charged 0 until trial end. Misstated durable-support info.
Reproduction: read-only; render template with year price.
Fix: pass interval + trial flag, render "Plan anual, renovación cada año" and "Primer cobro de X el <fecha>; hoy 0 €". Test: template snapshot for month/year/trial.

### A7-LAUNCH-03 HIGH CONFIRMED (claim) / PLAUSIBLE (legal weight) (norm: TRLGDCU art. 20/27 and 60 misleading practices; safety)
Evidence: components/landing/faq-data.ts:19 `'Los filtros de alergias son absolutos. El sistema nunca incluye un alérgeno declarado, bajo ninguna circunstancia.'` (also emitted as FAQPage JSON-LD on pro, seen in the served HTML) and :27 "Sí, es uno de los casos más habituales [celíacos]". Contradicted by: (a) Terms section "Limitación de Responsabilidad" (components/legal/legal-content-data.ts ~line 127: "sigues siendo responsable de verificar que cada receta es segura"); (b) known gap in .context/audits/2026-10-12-definitive/04-critical-audit.md:102 (mustard/sulphites cannot be declared, "La app no avisa"); (c) w1-03 systemic findings (tamari/soy sauce gluten, A7-SAFEA-47); (d) .context/audits/revision-alergenos-2026-10-16.csv (untracked): 538 recipes, `revisada_por_fecha` empty in 538/538, i.e. no human has signed off the allergen/diet tags the "absolute" claim rests on (my keyword cross-check of ingredients vs tags found only false positives: coconut/almond milk, so no tag error found by that heuristic); (e) free-text allergy notes are persisted but not enforced (w3-01 line 86); trazas/cross-contamination are not modelled. No in-app allergen disclaimer found in components/menu, recipes, onboarding (rg 'verifica|trazas|puede contener' returned nothing relevant).
Impact: a coeliac or allergic user is promised an absolute guarantee in marketing and indexed rich results; an error is a safety event and a misleading-claim exposure.
Reproduction: read landing FAQ on https://fresco-pro.vercel.app (GET, done); no purchase needed.
Fix: reword to the true guarantee ("excluimos las recetas etiquetadas con los alérgenos que declaras, entre los 12 que cubrimos; revisa siempre la etiqueta"), list uncovered allergens, add a persistent disclaimer in menu/recipe/onboarding, finish the human review before launch. Test: copy lint test that fails on "nunca"/"absolut" in faq-data + e2e asserting disclaimer present.

### A7-LAUNCH-04 MEDIUM PLAUSIBLE (norm: TRLGDCU art. 60.2.c / 20.1 total price incl. taxes; RD 1619/2012 invoicing)
Evidence: lib/legal/pro-summary.ts describeProPrice adds "(IVA incluido)" only if `price.tax_behavior === 'inclusive'` (app/api/stripe/pro-price/route.ts `taxIncluded`); components/landing/pricing.tsx and final-cta.tsx ("sigue por 4,99€ al mes") contain no IVA wording (rg 'iva|impuesto' → no hits in them); checkout/route.ts sets no `automatic_tax`, no `tax_id_collection`, no `consent_collection.terms_of_service`; email comment: "Stripe doesn't break one out here (no automatic_tax)". Test upgrade-to-pro-button.test.tsx:101 pins that the UI says nothing about IVA when unspecified. The real Price's tax_behavior (test mode) not read (no Stripe calls).
Impact: if the live Price is `unspecified`, the user is never told whether 4,99 € includes IVA, and Stripe issues no VAT-itemised invoice; the email says "impuestos incluidos donde apliquen" regardless.
Reproduction: GET /api/stripe/pro-price on pre with the automation identity returns `taxIncluded`; not run (budget, and price is a Stripe-owned value).
Fix: set Prices to tax_behavior inclusive (or enable Stripe Tax once the autónomo is registered), always print "IVA incluido" on landing, summary and email. Test: pricing.test asserts the IVA phrase.

### A7-LAUNCH-05 MEDIUM PLAUSIBLE (norm: TRLGDCU art. 97.1.i/102 and Annex B: how to exercise withdrawal)
Evidence: Terms section "Suscripción, Renovación y Derecho de Desistimiento" (legal-content-data.ts ~137-138) states the 14-day right but gives no procedure, no model withdrawal form and no address; only the generic "Contacto" section. App code has no withdrawal/refund route: rg refund|desist in app/ finds only the webhook reaction to a manual dashboard refund (lib/billing/refund.ts, FRESCO-900). The contact is a personal Gmail (lib/legal/entity.ts:2).
Impact: a consumer cannot see how to withdraw; the refund depends on the founder noticing a Gmail and refunding by hand in Stripe. Cancel via "Gestionar mi suscripción" opens the Stripe portal (app/api/stripe/portal/route.ts:57); whether cancellation is enabled in the portal config is a Stripe setting I did not verify.
Reproduction: read Terms at https://fresco-pro.vercel.app/legal/terminos (200, 361 KB).
Fix: add "cómo desistir" (email + plazo + model form text) to Terms and checkout summary; document the refund runbook. Test: legal-content-data.test asserts the procedure text.

### A7-LAUNCH-06 LOW PLAUSIBLE (norm: LSSI-CE art. 22.2 + AEPD cookie guide)
Evidence: instrumentation-client.ts: Sentry is dynamically imported and `Sentry.init({dsn, tracesSampleRate: 0.1})` on idle for every visitor, no consent check (contrast ADR-0025 gating PostHog). Landing HTML carries `sentry-trace` and `baggage` meta tags. COOKIE_TABLE (components/legal/legal-content-data.ts) lists no Sentry item; privacy lists Sentry only as processor. PostHog gating itself is correct per ADR-0025 (not re-tested live).
Impact: error/perf telemetry with IP and URL goes to a US processor before any consent; arguably "necessary" but undeclared in the cookie policy. Overlaps w2.
Fix: declare Sentry in the cookie policy as technical/necessary (and document the necessity rationale in an ADR) or gate tracing on consent.

### A7-LAUNCH-07 MEDIUM CONFIRMED (SEO/duplicate content)
Evidence: GET robots.txt on fresco-pre and fresco-dev returns `Allow: /` identical to pro with a Sitemap line pointing at their own host; landing HTML on pre has self-canonical `https://fresco-pre.vercel.app` and no `<meta name=robots>`; response headers have no `x-robots-tag` (curl -D, pre). app/robots.ts / resolve-base-url.ts branch only the base URL, never the rules. Also on pre `og:image` points to `fresco-git-staging-basi-montes-projects.vercel.app` (a third host, Vercel-SSO protected per project.yaml) so shared previews of pre carry a broken image.
Impact: pre (and frozen dev) are indexable duplicates of the landing, competing with pro for the brand keywords once the sitemap/Search Console are submitted; stale staging copy can rank.
Reproduction: curl -s https://fresco-pre.vercel.app/robots.txt.
Fix: when VERCEL_ENV !== 'production' return `{rules:{userAgent:'*',disallow:'/'}}` and add `robots: {index:false}` metadata; derive OG origin from resolveBaseUrl not VERCEL_URL. Test: robots.test for preview env.

### A7-LAUNCH-08 LOW CONFIRMED (SEO)
Evidence: GET pro landing has no google-site-verification / msvalidate meta although app/layout.tsx:109-110 + lib/seo/site-verification.ts emit them from env GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION (variable names only; set/unset unverifiable by me beyond the absent tag). JSON-LD SoftwareApplication offers only Pro 4.99 monthly (lib/seo/structured-data.ts:46 comment: "the only prices that exist in the codebase") while the annual plan exists (FRESCO-844), so structured data can drift from the Stripe price shown in UI. sitemap.xml lists only "/" (lastmod hard-coded 2026-09-12 in app/sitemap.ts); /legal/* are not listed though indexable.
Impact: Search Console cannot be verified on pro; structured price can contradict the page.
Fix: set the two env vars on Vercel Production; generate offers from the same Stripe read or drop price from JSON-LD.

## Already known (not re-reported)
- Founder not registered as autónomo, NIF published, locality-only address (LSSI art. 10 gap), provisional legal texts, contact = Gmail, no owned domain / frescoapp.es unbought, Resend sandbox sender: 04-critical-audit C-07, lib/legal/entity.ts comments, w2-01 line 64-65, launch-checklist p4/p6/w9 (FRESCO-883/886). A7-LAUNCH-01 is the consumer-law consequence of that last one, not a duplicate of the domain gap.
- Supermarket licensing: Mercadona `riesgo-aceptado` (ADR-0028, MIT licence covers dataset code not Mercadona data, update 2026-10-06), Consum `riesgo-aceptado` (ADR-0037, terms read end to end, review date 2026-11-06, "lawyer opinion required BEFORE public launch" still open), kill-switch + withdrawal runbook (docs/workflows/supermarket-data-withdrawal.md), FRESCO-753 Awin rejected. No drift found: UI says "Precios orientativos de <cadenas>, con la fecha en que se observaron" (shopping-list-summary.tsx:41), per-item age shown (shopping-list-item-row.tsx:66), Terms section "Precios y enlaces de supermercados" present, no supermarket images/logos found in lib/grocery or next.config (rg thumbnail/imgix/.jpg: none), no price in CSV/export code path found (export-actions only builds blobs).
- Uncovered EU allergens (mustard, sulphites) known: 04-critical-audit.md:102.

## Checklist items that found nothing
1. Checkout pre-contract info: price/period/renewal/cancel route/trial terms/identity/waiver checkbox (unticked, gates the button, recorded server-side as consent kind `withdrawal_waiver`, lib/legal/consent.ts) are all present in components/profile/pro-checkout-summary.tsx. Trial once per account enforced (lib/legal/pro-terms.ts isTrialAvailable). Card-less trial ends with `missing_payment_method: 'cancel'`. No gap other than 01, 02, 04, 05. Price-change notice clause is absent from Terms (only "Modificaciones de estos Términos", 15 days): folded under LOW INFO, not scored.
2. Legal pages: /legal/terminos, /privacidad, /cookies, /contacto all GET 200 on pro with real titles (FRESCO-493 fixed, no longer modal-only). Cookie banner: PostHog init is gated per ADR-0025 (read, not re-run live). 404 returns real 404.
3. Supermarket data: nothing new (see above).
4. Savings claims: invented figures were removed (impact-stats.tsx comment FRESCO-370); annual saving is computed from Stripe prices (pro-summary.ts annualSavings). No "sin gluten" product claim beyond the FAQ above.
5. SEO: canonical self-referencing, OG/Twitter complete, JSON-LD parses as valid JSON (Organization, WebSite, SoftwareApplication, FAQPage), robots disallows authenticated routes, llms.txt exists (200), 404 real. Findings only 07, 08.
6. Launch readiness: signup is open (supabase/config.toml enable_signup = true, line 182/233) with CAPTCHA (Turnstile in CSP); account deletion path exists (components/profile/danger-zone.tsx, delete-account-dialog.tsx, ADR-0023/0043); CSV export of own data exists (ayuda-section.tsx:54).

## Could not verify
- Stripe Price `tax_behavior`, Billing Portal cancellation setting, Stripe-sent receipts/invoices, trial-ending emails (Stripe dashboard config; no Stripe calls allowed).
- SPF/DKIM/DMARC for hola.frescoapp@gmail.com (Gmail SMTP) and Resend (no domain): unverifiable from repo; impact: Auth mail via Gmail SMTP capped at 20/h (project.yaml memory), subscription confirmation undeliverable (A7-LAUNCH-01), no branded domain for support.
- Whether GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION are set on Vercel (names only; the tag is absent in served HTML).
- Mercadona dataset licence/ToS read live: relied on ADR-0028 update (not re-fetched). Consum robots.txt/ToS not re-fetched (ADR-0037 records a full read 2026-10-06).
- Live cookie-banner behaviour in a browser (network before consent): not run, code/ADR only.

Requests used on production/pre: ~26 GET (robots/sitemap/llms x3 hosts, home x2, legal x4, 404, login, signup). DB queries: 0. Tool calls: ~41.
secrets_materialized: none
cleaned: yes (only HTML/text fetches saved under the audit7 scratchpad; no auth material)
