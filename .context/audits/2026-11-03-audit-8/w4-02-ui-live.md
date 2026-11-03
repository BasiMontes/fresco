# Audit 8 - Axis UI (live app, a11y, responsive, copy)

- Commit: staging 71ab0864 (main bc75ab81). Date: 2026-11-03. Target: fresco-pre (live), fresco-pro (GET only, 8 requests).

## 1. Scope
- Live, headless Chromium + @axe-core/playwright (already installed) on fresco-pre at 360/768/1280: /, /legal/{privacidad,terminos,cookies,contacto}, /sobre-nosotros, /no-existe-xyz, /offline.html (24 loads with axe, overflow, tap targets, labels, headings, img alt, canonical/robots). /login at 360 (axe, labels, tap targets). /signup and /forgot-password timed out on `networkidle` (Turnstile keeps the network busy; my wait strategy, not an app defect), so NOT exercised live.
- Production GET: /, /legal/privacidad, /legal/cookies, /sobre-nosotros, /robots.txt, /sitemap.xml, /llms.txt.
- Login: ONE UI attempt with the automation identity. Headless Turnstile never completed; page said "Espera a que termine la verificación de arriba para continuar." Not bypassed. Authenticated screens NOT exercised live: /menu, /calendar, /recipes, /profile (+Configuración/FAQ modals), /shopping-list, /notifications, /favorites, /historial. Covered by code reading only.
- Code read: app/layout.tsx, not-found/error/global-error, ui/dialog.tsx (trap), cookie banner, legal-content, slot-mark-controls, calendar-grid, shopping-list-item-row/view, delete-week-button, recipe-library, planning-selection-grid, iso-week, brand-video, offline.html, robots/sitemap.

## 2. Findings

### A8-UI-01 - Every page without its own metadata (4 legal pages, /sobre-nosotros, the 404) declares the HOME as canonical
- Severity: MEDIUM. Confidence: CONFIRMED. Status vs audit 7: NEW (A7-LAUNCH-08 only added the legal URLs to the sitemap).
- Evidence: production `curl https://fresco-pro.vercel.app/legal/privacidad` -> `<link rel="canonical" href="https://fresco-pro.vercel.app"/>`; same for /legal/cookies and /sobre-nosotros. Pre: canonical of /legal/*, /sobre-nosotros and /no-existe-xyz = `https://fresco-pre.vercel.app/` at all 3 widths. Cause: `app/layout.tsx:108` `canonical: canonicalUrl('/')` is inherited by routes whose `metadata` (e.g. `app/legal/cookies/page.tsx:6`) sets no `alternates`; only `app/login/layout.tsx:14` and `app/signup/layout.tsx:12` override it. The live sitemap lists the 4 legal URLs, so sitemap and canonical contradict each other.
- Impact: search engines treat the legal pages as duplicates of the landing and may drop them from the index; the legal pages are a launch/consent requirement and the project's SEO work aims to make them crawlable.
- Reproduction: `curl -s https://fresco-pro.vercel.app/legal/privacidad | rg 'rel="canonical"'`.
- Fix: add `alternates: { canonical: canonicalUrl('/legal/privacidad') }` (and terminos, cookies, contacto, /sobre-nosotros) to each page's metadata. Test: unit test iterating the sitemap entries asserting each page's metadata canonical equals its sitemap URL.

No other new findings. Pre public pages: axe zero violations at all widths, no horizontal overflow (scrollWidth == viewport), 0 images without alt, 0 unlabeled inputs, exactly one `<main>` on every page including the 404.

## 3. A7 findings re-verified
| A7-ID | Verdict | Evidence |
|---|---|---|
| A7-UI-01 404 no main | FIXED | live /no-existe-xyz: 1 `<main>`, axe 0; `not-found.tsx:17`, `error.tsx:29`, `global-error.tsx:28` have `<main id="main">` |
| A7-UI-02 cookies table region | FIXED | `legal-content.tsx:69-71` role=region + tabIndex=0; live axe /legal/cookies at 360 = 0 |
| A7-UI-03 heading levels | FIXED | live sequences `122222222` (privacidad), `1222...` (terminos) |
| A7-UI-04 offline refresh | FIXED | `public/offline.html:14` documents no meta refresh; live axe 0 |
| A7-UI-05 mark button names | FIXED (code) | `slot-mark-controls.tsx:43,57` `Cocinado: ${donde}`, `Descartar: ${donde}` |
| A7-UI-06 W99 | FIXED (code) | `lib/date/iso-week.ts:166-173` bounds by isoWeeksInYear; `calendar/page.tsx:58` uses it |
| A7-UI-07 accent search | FIXED (code) | migration 20261017220000 uses `f_unaccent`, escapes `%`/`_`; not run live |
| A7-UI-08 label in name | FIXED (code) | `planning-selection-grid.tsx:77,86` "Ninguno: ..."; `recipe-library.tsx:212` |
| A7-UI-09 Almuerzo/Comida | FIXED (code) | `lib/meal-labels.ts:11`; no 'Almuerzo' left in lib/components non-test |
| A7-UI-10 offline tick | PARTIAL (code) | `shopping-list-view.tsx:125-129` now `role="alert"`; revert/no-queue behaviour not re-checked live |
| A7-UI-11 contrast | FIXED (code) | opacity-70 removed (`shopping-list-item-row.tsx:122-124`); tertiary #6f5f43 light / #a99a7c dark (`globals.css:206`) |
| A7-UI-12 today mark | FIXED (code) | `calendar-grid.tsx:126-127,219` diaHoy only if today in viewed week, Madrid frame from server |
| A7-UI-13 mobile calendar | FIXED (code) | arrows `size-11` (:161,171), `focusDia: diaHoy` (:129) |
| A7-UI-14 21 franjas | FIXED (code) | `delete-week-button.tsx:89` uses `platos`; "21 franjas" survives only in help FAQ `ayuda-section.tsx:42` and landing "21 platos" (INFO) |
| A7-UI-15 mark permanent | FIXED (code) | `canChangeMark` in current week (`calendar-grid.tsx:243`), undo window 10 s (`use-slot-marking.ts:15`) |
| A7-UI-16 login next | FIXED (code) | `app/(app)/layout.tsx:39` `redirect(loginUrlFor(x-pathname))` |
| A7-UI-17 video | FIXED | `brand-video.tsx:39` focus ring, `:47` captions track |

Consolidated UI rows (cards 18/20/21) map to the rows above; same verdicts. 16 FIXED, 1 PARTIAL.

## 4. Checklist items that found nothing
- Overflow at 360/768/1280 on public pages; tap targets (only the off-screen skip link on /login); login input labels and autocomplete; lang=es; dialog focus trap + Escape (`components/ui/dialog.tsx:116-152`); cookie banner region label; voseo/Portuguese/Rioplatense in UI copy (only "viven acá" in a code comment, `export-actions.tsx:22`); robots.txt disallows authenticated routes with Sitemap line; sitemap has 5 URLs; llms.txt 200; production has no noindex (pre does, expected).
- FRESCO-787 mobile/tablet overflow assertion: catches only horizontal overflow; none exists, and it cannot catch A8-UI-01 (metadata).

## 5. Could not verify
- Any authenticated screen live (Turnstile blocks headless login, not bypassed): focus order, dark-theme contrast, loading/empty/error states, Configuración/FAQ modals, profile layout, live accent search, offline tick, calendar mark flow.
- /signup and /forgot-password live. Reduced motion, real CLS.

## 6. Hygiene
secrets_materialized: none
cleaned: yes (browsers closed; no state files written). Note: a stray 2-byte file `placeholder.txt` was written by mistake into a mistyped scratchpad dir `.../8ad32eca-e367-4772-a48f-c0fa-7e517c5/scratchpad/audit8/`; deletion was denied, harmless.
