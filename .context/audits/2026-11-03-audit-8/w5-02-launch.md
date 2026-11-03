# A8 LAUNCH audit (w5-02)
Axis: LAUNCH. Commit 71ab0864 (staging; prod main bc75ab81 docs-only delta). Date 2026-11-03. I am not a lawyer; legal items are PLAUSIBLE unless the code contradicts a stated obligation.

## 1. Scope
Read: launch checklist (145 lines), A7 w4-02 (74 lines) + consolidated LAUNCH rows, docs/workflows/stripe-go-live.md, ADR-0066, lib/email/{resend,templates/subscription-confirmation}.ts, lib/billing/confirmation-email.ts, lib/legal/entity.ts, legal-content-data.ts (terms 7/7b, privacy processors, cookies), faq-data.ts, dietary-options.ts, app/robots.ts, lib/seo/indexing.ts.
Live: 9 GET on prod (home, terminos, robots, sitemap, google verification file) + 3 GET on pre. DB: 3 SELECT (billing_mode, pending_confirmation_emails, auth.users count). Vercel: `vercel env ls production` names only. Jira: FRESCO-908 view/comments (read). ~30 tool calls.

## 2. Findings (sorted by severity)

### A8-LAUNCH-01 MEDIUM CONFIRMED — Privacy policy names Resend for the subscription confirmation email, but production is set to send it through Google Gmail SMTP
Evidence: `vercel env ls production` lists `GMAIL_SMTP_APP_PASSWORD` (Production, 17d). lib/email/resend.ts `sendSubscriptionConfirmationEmail`: `if (isGmailSmtpConfigured()) { await sendViaGmailSmtp(...); return; }` so Resend is never used while that variable is set. legal-content-data.ts:~188 (processors): "Resend (envío del correo de confirmación de tu suscripción ...)" and "Google (servicio de correo SMTP de Gmail con el que enviamos los correos de acceso y recuperación de contraseña ...)". The subscription confirmation (email, plan, price, renewal date) and the waitlist double opt-in also go through Google, which the policy does not say.
Impact: RGPD art. 13 (recipients) is inaccurate for the exact email that is the legal confirmation. Low harm, cheap to fix.
Reproduction: read-only, above.
Fix: reword the Google item ("correos de acceso, recuperación de contraseña, confirmación de suscripción y de la lista de espera, mientras no tengamos dominio propio") and keep Resend only if still used. Test: legal-content-data test asserting the processor sentence mentions "confirmación de suscripción" next to Google. Bump LEGAL_TEXTS_VERSION per ADR-0066.
Status vs audit 7: NEW.

### A8-LAUNCH-02 MEDIUM PLAUSIBLE — No evidence a confirmation email reached a non-owner address; the go-live gate asks for it but nothing records it
Evidence: stripe-go-live.md "The sender domain is verified before Stripe goes live": requires "one real delivery has been confirmed to an address that is not the owner's". `pending_confirmation_emails` = 0 rows (live SELECT), `billing_mode.stripe_livemode = false`, 12 auth users. Zero rows only proves no failure was recorded in test mode; no artifact records the second-mailbox delivery test. Gmail SMTP path: personal account, daily cap, shared with Supabase Auth OTP (signup and password reset share the same sender quota, so a burst of confirmations can starve login mail).
Impact: if the app password is wrong/revoked or Gmail rejects, the first paying customer gets no art. 98.7 confirmation; Sentry tag and retry (FRESCO-1005) make it loud, not delivered.
Fix: before the flip run one test-mode checkout with a second mailbox and paste the result in the go-live ticket; add a `--ack email-delivery` line to scripts/check-stripe-go-live.ts like `--ack dunning`. Test: script test that exit is 1 without the ack.
Status vs audit 7: residual of A7-LAUNCH-01 (see section 3).

### A8-LAUNCH-03 LOW CONFIRMED — Staging `og:image` still points to a third host
Evidence: `curl https://fresco-pre.vercel.app/` gives `og:image content="https://fresco-git-staging-basi-montes-projects.vercel.app/opengraph-image?..."` (that host is Vercel-SSO protected per project.yaml). Only the robots half of A7-LAUNCH-07 was fixed.
Impact: shared pre links show no image; no effect on production or SEO (pre is noindex).
Fix: derive OG origin from resolveBaseUrl; test in layout metadata test.
Status vs audit 7: STILL-OPEN (second half of A7-LAUNCH-07).

### A8-LAUNCH-04 LOW CONFIRMED — Landing FAQ for coeliacs still promises more than the filter proves
Evidence: components/landing/faq-data.ts:26-28 "¿Funciona si somos veganos o celíacos?" -> "Sí, es uno de los casos más habituales. El sistema filtra por dieta antes de generar cualquier menú." This is served as FAQPage JSON-LD. The allergen FAQ itself was fixed (see section 3), and the in-app reminder exists (ALERGENOS_RECORDATORIO in menu, recipe detail, onboarding, profile). But the coeliac answer has no "lee la etiqueta" and the catalogue review behind it (FRESCO-908) was AI-only, with brand-dependent diets (tamari, miso, stock) left as "decidir".
Impact: a coeliac reading only this answer gets an unqualified "Sí".
Fix: append "Revisa siempre la etiqueta de los productos que compres." Test: faq-data copy test that every answer mentioning celíaco/alérgeno carries the label sentence.
Status vs audit 7: NEW (residual of A7-LAUNCH-03).

### A8-LAUNCH-05 LOW CONFIRMED — Home `lastmod` in sitemap is hard-coded
Evidence: GET /sitemap.xml: `/` lastmod `2026-09-12`, legal pages `2026-10-19`; landing changed many times after. Harmless to ranking; mentioned in A7-LAUNCH-08 and not fixed.
Fix: derive from build date or drop lastmod. Status vs audit 7: STILL-OPEN (sub-item of A7-LAUNCH-08).

## 3. A7 LAUNCH findings re-verified
| A7-ID | Verdict | Evidence |
|---|---|---|
| A7-LAUNCH-01 (confirmation email undeliverable, silent) | FIXED in code, UNVERIFIED end to end | FRESCO-1005: lib/billing/confirmation-email.ts reports to Sentry (tag `email: subscription-confirmation`), stores `pending_confirmation_emails`, cron retries 5 times; Gmail SMTP branch live in prod env (names). `SEND_FROM` is still `onboarding@resend.dev`. Delivery to a real customer never shown (A8-LAUNCH-02). Gate stays. |
| A7-LAUNCH-02 (template says mensual / "Importe total cobrado" on trial) | FIXED | subscription-confirmation.ts:56-58 `interval` -> "anual/mensual"; trial renders "Importe cobrado hoy: 0 € ... Primer cobro de X el <fecha>"; test line 90 asserts the old string is absent. |
| A7-LAUNCH-03 (absolute allergen claim) | FIXED for the allergen FAQ, residual A8-LAUNCH-04 | faq-data.ts:19 now "Excluimos ... entre los 14 de declaración obligatoria de la UE. Aun así, lee siempre la etiqueta ..."; ALERGENOS_AVISO/RECORDATORIO in dietary-options.ts:43,49 used by menu page, recipe-detail, onboarding, profile. "14" matches the migration. FRESCO-908 is Finalizada but closed on an AI review accepted by the owner "no es una revisión humana" (comments 20030/20032; ADR-0066); the CSV in the repo still has `revisada_por_fecha` empty 538/538. |
| A7-LAUNCH-04 (IVA wording) | FIXED in code, UNVERIFIED in Stripe | landing/pricing.tsx:92 `landing_pro_tax_included` "IVA incluido"; shown only when Price `tax_behavior=inclusive` (go-live script checks it). Live prices do not exist yet (livemode false). Owner decision on tax status (FRESCO-911). |
| A7-LAUNCH-05 (withdrawal procedure) | FIXED | Terms section "Cómo ejercer el derecho de desistimiento": email, 14 días, model text, refund within 14 days, same payment method; separate clause on proportional refund. Refund is manual by the founder (no automation). |
| A7-LAUNCH-06 (Sentry before consent) | FIXED | instrumentation-client.ts header: SDK starts only after consent (sentry-consent-gate, FRESCO-1042); cookie table lists `sentry_previous_trace` as consent-only; processors sentence says browser Sentry only if you accept. Not re-run in a browser. |
| A7-LAUNCH-07 (pre/dev indexable) | FIXED (robots), og:image STILL-OPEN | pre robots.txt = `Disallow: /`, home has `<meta name="robots" content="noindex, nofollow"/>`; prod robots allows. og:image see A8-LAUNCH-03. |
| A7-LAUNCH-08 (GSC verification, JSON-LD price) | FIXED by file, owner step pending | /google8322b440e06e5069.html returns 200 on prod; no meta tag and `GOOGLE_SITE_VERIFICATION` is not in the Production env list (names). JSON-LD offers now 0 and 4.99 EUR (price from Stripe, FRESCO-1018). Whether the owner clicked "Verify" in Search Console cannot be seen. Sitemap now lists /legal/*. lastmod residual A8-LAUNCH-05. |

## 4. Checklist items that found nothing
- Right of withdrawal wording and waiver: present, per-purchase waiver recorded (FRESCO-1021), liability cap for consumers removed (FRESCO-1049).
- Price with VAT: code correct (see A7-04); nothing wrong in landing/final-cta.
- Cancellation as easy as signup: "Gestionar mi suscripción" opens Stripe portal in one step; portal config is a go-live script line (`portal-default`).
- Invoices: Terms/confirmation do not promise a VAT invoice; Stripe receipts are a dashboard setting (not verifiable).
- ODR link: absent from Terms. I believe the EU ODR platform was shut down (Reg. 2024/3228, July 2025) so no longer required; stated from memory, confirm with the founder's advisor when one exists. "Hojas de reclamaciones" (Andalucía) not mentioned: PLAUSIBLE INFO, cheap to add a line.
- Processors in privacy policy: Supabase (EU, Ireland, SCC), Stripe (DPF/SCC), PostHog (EU, SCC), Sentry (DPF/SCC), Vercel (DPF), Resend (SCC), Turnstile, Google/Gmail, web push: all named with region and transfer basis (except A8-LAUNCH-01 mismatch). DPAs themselves (signed contracts) cannot be verified from the repo.
- Analytics consent: PostHog gated (ADR-0025), rejection stored in localStorage, Sentry gated. Not re-run live.
- Waitlist: double opt-in, 7-day deletion of unconfirmed, 12-month retention, unsubscribe link, in privacy policy ("Lista de Espera").
- Legal pages 200, sitemap lists them, JSON-LD valid, robots correct on prod.
- Support channel: contact = Gmail only (known, FRESCO-883/886). Status/incident communication: nothing exists (no status page, no response-time statement). Not a legal obligation; see gate table.

## 5. Could not verify
- Stripe live: portal cancellation config, Price tax_behavior, receipts, dunning, webhook endpoint (no Stripe calls; livemode false, live prices not created).
- Delivery of Gmail-SMTP mail to an outside mailbox, SPF/DKIM alignment, Gmail daily cap in practice.
- Search Console verification status (owner UI).
- Live browser behaviour of the cookie banner.
- Signed DPAs with processors.
- ODR repeal (from memory), Andalusian claim-form rule for online sellers.

## 6. Launch gate table
| Item | Status | Cheapest free path |
|---|---|---|
| Owner identity: autónomo alta, NIF, full address in lib/legal/entity.ts (TRLGDCU 97, LSSI 10; kept as gate by ADR-0066 3) | blocking before charging | Needs founder decision. The alta itself is free at AEAT/Seguridad Social; the monthly cuota is the cost (tarifa plana is the cheapest). Without it launch free-only (no charges) is the free path |
| Vercel Pro (Hobby forbids commercial use) and Supabase Pro (ADR-0066 3) | blocking before charging | Needs founder decision; no free path for charging. Free-only public launch (no Stripe live) stays on Hobby/free |
| Stripe live flip: run check-stripe-go-live.ts with live key, live Prices with tax_behavior, portal, webhook, dunning ack, Edge secret | blocking before charging | No cost; owner actions in Stripe dashboard |
| Confirmation email reaches a customer (A8-LAUNCH-02) | blocking before charging | Gmail SMTP already set in Production (free). Do one test checkout with a second mailbox and record it. Domain frescoapp.es (FRESCO-886) not needed for this |
| Privacy policy recipient mismatch (A8-LAUNCH-01) | not blocking for free launch; fix before charging | Text edit, free |
| Allergen/diet claims (FAQ fixed; A8-LAUNCH-04; FRESCO-908 AI-only review) | not blocking (copy is honest), needs founder decision to keep "AI review, not human" | Add the label sentence to coeliac FAQ; keep ADR-0066-style written acceptance |
| Legal texts without lawyer | needs founder decision (already accepted in ADR-0066, triggers at 50 payers or any complaint) | None needed |
| Withdrawal/refund process manual | not blocking | Runbook line for founder; refunds by hand in Stripe |
| Email deliverability for Auth (Gmail SMTP 20/h) | needs founder decision | Free: stay on Gmail for a small beta; cap signups. Paid domain (~10 EUR/yr) unlocks Resend |
| Own domain frescoapp.es / branded contact (FRESCO-886) | not blocking for a small beta; blocking for scale | Free: keep Gmail and *.vercel.app. Revisit when the first revenue arrives |
| Support channel and status communication | not blocking | Free: one sentence in Contacto with response time; status via a pinned note or free UptimeRobot page |
| Analytics consent (PostHog, Sentry) | not blocking | Done; re-test in browser before launch |
| Waitlist storage and policy | not blocking | Done |
| SEO: GSC verification (file served) | not blocking | Owner clicks Verify in Search Console (free); pre noindex done |
| sitemap lastmod, pre og:image (A8-LAUNCH-03/05) | not blocking | Free code fixes |
| ODR / hojas de reclamaciones | not blocking, needs founder decision | Free: add a "Reclamaciones" line to Contacto |
| Supermarket data terms (ADR-0028/0037, Consum review date 2026-11-06) | needs founder decision | Free: re-read Consum terms on the review date, keep kill-switch |

Note on the brief: FRESCO-908 is not "pending". It is Finalizada (2026-10-23) on an AI review the owner explicitly accepted as non-human. The repo CSV remains unsigned.

secrets_materialized: none
cleaned: yes (only HTML fetches saved under the audit8 scratchpad: l-pro.html, l-terms.html; no auth material)
