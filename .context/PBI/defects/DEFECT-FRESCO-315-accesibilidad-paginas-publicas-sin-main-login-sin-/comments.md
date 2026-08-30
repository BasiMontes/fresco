# Comments for FRESCO-315

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-315)

---

### Basi Montes - 8/30/2026, 1:28:46 PM

# Spec Implementation Plan (Dev) — FRESCO-315

A11y remediation on public (non-`(app)/`) pages. Audit-3 HALLAZGO BAJO F, measured live with Playwright at 390 / 1280 px over landing, `/login`, `/qa`. Five independent low-risk fixes.

## Root cause

Coverage regression, not code regression. The `(app)/` authenticated shell has a `<main>` landmark (`components/layout/app-shell.tsx`); the public routes were built page-by-page and never got one. `/login` + `/signup` cards use a placeholder + `aria-label` pattern with no real `<label>`. Tap-target passes from FRESCO-267/288 targeted 24 px (WCAG 2.5.8 AA min) and did not reach the landing nav / footer legal links / FAQ toggles at the comfortable 44 px objective. No `app/robots.ts` was ever added. `final-cta.tsx` H2 uses a bare `<br>` between two text nodes with no whitespace, so `textContent` reads `domingosin`.

## Scope

| # | Fix | Files |
| --- | --- | --- |
| 1 | `<main>` landmark on every public route | `app/page.tsx` (wrap Hero…FinalCta, keep SiteNav/SiteFooter outside), `app/qa/page.tsx` (outer `div` → `main`), and `<main>` wrapper in `app/login/layout.tsx`, `app/signup/layout.tsx`, `app/forgot-password/layout.tsx`, `app/update-password/layout.tsx`, `app/onboarding/layout.tsx` |
| 2 | Real `<label>` for email + password inputs (sr-only, `htmlFor`/`id`, keep placeholder) — `/login` and `/signup` | `app/login/page.tsx`, `app/signup/page.tsx` |
| 3 | 44 px tap targets on the flagged mobile controls: landing footer legal buttons, `/login`↔ "Ya tengo cuenta" nav link, mobile hamburguesa, 6 FAQ accordion toggles. `min-h-[44px]` + vertical centering, no change to text/icon size | `components/landing/site-footer.tsx`, `components/landing/site-nav.tsx`, `components/landing/faq.tsx` |
| 4 | `app/robots.ts` — `MetadataRoute.Robots`, `allow: '/'` | `app/robots.ts` (new) |
| 5 | Fix H2 broken text node: `{' '}` before `<br />` | `components/landing/final-cta.tsx` |

Out of scope: `LegalLinks` footer (already 24 px from FRESCO-288, not re-flagged), `(app)/` routes (already have `<main>`), contrast (FRESCO-283/299), any visual redesign of the auth cards.

## Steps

1. ***#5*** — one-char fix in `final-cta.tsx`. `verify:` `textContent` contains `domingo sin`.
2. ***#4*** — add `app/robots.ts`. `verify:` `curl localhost:3000/robots.txt` → 200 with `Allow: /`.
3. ***#1*** — add `<main>`. Landing: `<main>` wraps the section stack, `SiteNav` (`<header>`) and `SiteFooter` (`<footer>`) stay siblings. `/qa`: promote the outer container to `<main>`. Auth/onboarding layouts: `return <main>{children}</main>`. `verify:` one `<main>` per page, no nested landmarks, lint+types green.
4. ***#2*** — sr-only `<label htmlFor>` + `id` on both inputs, drop the now-redundant `aria-label`, keep `placeholder`. Same on `/signup`. `verify:` accessible name comes from `<label>`; Playwright `getByLabel('Correo electrónico')` resolves.
5. ***#3*** — bump the six flagged control groups to `min-h-[44px]` with `inline-flex items-center` (links) / existing flex (buttons). Do NOT touch `LegalLinks` or the already-compliant desktop nav. `verify:` `getBoundingClientRect().height >= 44` at 390 px for each.
6. Verification cap=3 inline: `bun run lint:check`, `bun run build` (or `tsc`), unit tests (read `package.json` for exact scripts).
7. Live-UI validation (Playwright CLI) at 390 + 1280 px over `bun run dev`: landing, `/login`, `/signup`, `/qa`. Capture 390 px screenshots as evidence. Check the AC's interactive flows (FAQ open/close, legal modal, login submit) still work.

## Technical decisions

- ***Landmark placement***: per-route, not a single root `<main>` in `app/layout.tsx`. A root `<main>` would swallow `SiteNav`/`SiteFooter` on the landing and double-wrap the `(app)/` shell's own `<main>`. Not architectural (no ADR).
- ***sr-only label over visible label***: preserves the ratified minimalist auth-card design (Rule 14 — no unratified divergence). Visible labels would be a design change needing a mockup.
- ***44 px, not 24***: the defect explicitly asks for the comfortable objective; matches WCAG 2.5.5 (Enhanced). Scoped to the flagged controls only — not an app-wide sweep.

## Review Workload Forecast

Estimated: ~70 additions + ~25 deletions = ~95 total lines
400-line budget risk: Low
Chain strategy: stacked-to-main (single PR to `dev`)
Decision needed before apply: No

## Estimated effort

Story points: ***3*** (5 tiny fixes, but multi-surface live-UI validation at 2 breakpoints across 4 pages).

---

### Basi Montes - 8/30/2026, 1:28:58 PM

## QA fields (fallback — "Error" type hides these fields on every screen)

| Field | Value |
| --- | --- |
| Severity | menor |
| Error Type | visual |
| Test Environment | production |
| Story Points | 3 |

Measured live with Playwright at 390 / 1280 px over the production landing, `/login` and `/qa`. No functional break — semantics, accessible names, tap-target comfort, `robots.txt`, and one broken H2 text node.

Root Cause: `working*as*designed` pending — set on fix close.

---


_Synced from Jira by sync-jira-issues_
