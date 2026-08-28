<!--
OWNER: /design-system screen-mapping phase (`.claude/skills/design-system/references/screen-design-mapping.md`).
UPSERT on re-run — never wipe existing screen specs, ratified divergences (§5), or the scorecard (§1).
Section numbers match the canonical layout so cross-references from /sprint-development and Critical Rule #14 resolve
(§0 Engagement rule · §1 Scorecard · §2 Frozen design contract · §4 Screen specs · §5 Divergence register ·
§8 US→Screen map · §9 Maintenance). §3/§6/§7 are intentionally absent.
-->

# Master Design Plan — Fresco

> **Status of this document.** Fresco is already fully built and shipped. This plan was created
> retroactively (FRESCO-294) to document the **current live UI**, screen by screen, and to give
> Critical Rule #14 and the ~9 skill files that reference `.context/design/master-design-plan.md`
> a real file to resolve against. It is **not** a forward-looking design: every screen spec below
> describes what IS in `app/**` + `components/**` today, tokenised against `DESIGN.md`.
>
> **No external mockup round-trip was ever run for this app.** There is no
> `.context/designs/<project>/` drop zone with Claude Design / Open Design bundles. The fidelity
> source for every screen is the **live UI itself** (LIVE-UI-FIRST, Rule 14). Where a screenshot
> mockup was used as *inspiration* during backlog seeding, it is cited as provenance in §4 and, where
> the build deliberately departed from it, recorded in §5.

---

## §0 — Engagement rule

Any story with UI **must** be looked up here before coding:

1. Find the story row in **§8 (US→Screen map)**. It names the screen(s) the story renders into.
2. Open that screen's spec in **§4**. Build against the spec + the `DESIGN.md` tokens it points at +
   the live components it names.
3. **LIVE-UI-FIRST.** The current live UI is the real fidelity source. Inspect and reuse the live
   components named in the spec first. A screenshot mockup (when one exists) is inspiration, not a
   pixel contract — do not re-derive a mockup detail the live UI already improved on.
4. If the story is **not in §8**, STOP and follow Rule 14's options: just-in-time screen brief
   (`/design-system` screen-mapping phase), spec-only ratification, or a user-approved
   `DESIGN.md`-only build. Then UPSERT a §4 spec + a §8 row so the next story isn't blocked.
5. A deliberate departure from a screen's spec or from `DESIGN.md` is a **defect** unless it is
   ratified in **§5** with a reason.

This ties into the `/sprint-development` design-fidelity gate (its input #10): sprint-dev reads this
file for every UI story, and falls back to `DESIGN.md`-only fidelity only when a screen has no §4 spec.

---

## §1 — Scorecard

Fidelity status per screen. `built` = shipped and in production; `partial` = shipped but a known gap
or placeholder remains; `n/a` = not a user-facing fidelity surface.

| Screen | Route | Status | Notes |
|---|---|---|---|
| Landing / marketing site | `/` | built | 10 components in `components/landing/`. Rebuilt from an approved-content HTML mock with real tokens, not the mock's CSS (§5-A). |
| Login | `/login` | built | `app/login/page.tsx` + own `layout.tsx` (auth title). |
| Signup (email/password → OTP → guest-conflict reassign) | `/signup` | built | Multi-step. `app/signup/page.tsx` + `layout.tsx`. |
| Forgot password | `/forgot-password` | built | `app/forgot-password/page.tsx` + `layout.tsx`. |
| Update password | `/update-password` | built | `app/update-password/page.tsx`. |
| Onboarding wizard | `/onboarding` | built | `IdentityStep` + 4 wizard steps. `app/onboarding/page.tsx`, `components/onboarding/*`. |
| Home dashboard | `/menu` | built | `components/menu/*` — greeting, suggestion banner, available-recipes card, savings cards, latest-recipes row, insight card. |
| Weekly calendar | `/calendar` | built | `components/calendar/*` — horizontal-scroll grid, week nav, delete-week, generate-week. |
| Shopping list | `/shopping-list` | built | `components/shopping-list/*` — summary card, aisle headers, circular checkboxes, "Vaciar comprados". |
| Recipe library (catalog + personal + filter drawer + create dialog) | `/recipes` | built | `components/recipes/*` + `components/ui/filter-drawer.tsx`. |
| Recipe detail | `/recipes/[id]` | built | `components/recipes/recipe-detail.tsx`. Personal recipes: no edit/delete surface by design (feature-map gap 3). |
| Favorites | `/favorites` | built | `components/recipe/favorites-grid.tsx`, `favorite-recipe-card.tsx`. |
| Profile & account | `/profile` | built | `components/profile/*` — identity header, preferences form, Ayuda section, danger zone, Pro/subscription controls. |
| Notifications centre | `/notifications` | built | `components/notifications/*` — welcome, routes guide, recipe recs, payment-failed. Was a stub until EPIC-FRESCO-223. |
| QA testability guide | `/qa` | built | `app/qa/page.tsx` + `components/qa/*`. Static + one env-gated link. |
| Admin recipe management | `/admin/recipes` | built | `components/admin/*`. Gated by `ADMIN_USER_ID` env var. Internal tool. |
| App shell / navigation | wraps `/(app)/*` | built | `components/layout/app-shell.tsx`, `sidebar.tsx` (desktop), `bottom-tab-bar.tsx` (mobile), `sidebar-account.tsx`. |
| Legal modal | cross-cutting overlay | built | `components/legal/legal-modal.tsx`, `legal-links.tsx`. Triggered from signup, profile, landing footer. |
| Motion & transitions layer | cross-cutting | built | EPIC-FRESCO-244 — page transitions, list/card enter-exit, modal open/close, micro-interactions, `prefers-reduced-motion`. |
| Error & not-found screens | `error.tsx` / `global-error.tsx` / `not-found.tsx` | built | Safety net (TECHDEBT-FRESCO-46); `not-found.tsx` styled (DEFECT-FRESCO-182). |
| Auth confirm | `/auth/confirm` | n/a | Route handler, no UI. |
| Dev skeleton-capture | `/dev/skeleton-capture` | n/a | Dev-only visual-regression tooling (`boneyard-js`). Not a fidelity surface. |

---

## §2 — Frozen design contract

**`DESIGN.md` at the repo root is the single source of truth for every token.** This plan owns
*screens*; `DESIGN.md` owns *tokens and components*. Token values are **not** duplicated here — read
them from `DESIGN.md`. Pointers:

| Concern | Where in `DESIGN.md` |
|---|---|
| Colours (primary `verde corporativo`, secondary `naranja corporativo`, cream background/surface, warm neutral + accent ramps, error clay-red) | frontmatter `colors:` + prose §Colors |
| Typography (Caprasimo display `h1`–`h6`, Figtree body, 15px base) | frontmatter `typography:` + prose §Typography |
| Spacing (4.4px base unit, `space-1`…`space-8`) | frontmatter `spacing:` + prose §Layout |
| Radii (`sm` 8 / `md` 16 / `lg` 28 / `card` ≈32 / `full` 999 — every button & tag is a pill) | frontmatter `rounded:` + prose §Shapes |
| Elevation (3 warm-based shadow levels; `lg` for overlays only) | prose §Elevation & Depth |
| Components (button variants incl. `button-action` orange, tag/pill variants, `input`, `segmented-control`, `card` / `card-insight` / `card-pro` / `recipe-card`, `nav-sidebar` / `nav-bottom-tab`, `icon` 2px stroke) | frontmatter `components:` + prose §Components |
| Logo lockups (`Logo base` / `Logo negativo` / `Logo naranja`) | prose §Overview |
| Amber WCAG-AA contrast rule (FRESCO-283/285/299/303) | prose §Do's and Don'ts |

Token-level fixes already **reconciled into `DESIGN.md`** and therefore *not* open divergences:
FRESCO-283 (amber CTA → near-black label), FRESCO-285/299 (`text-tertiary` darkened to `#6F5F43`),
FRESCO-303 (pricing feature-check colour), FRESCO-70 (sidebar on `primary` green), FRESCO-298 (icon
stroke held at 2px). See §5 for the screen-level divergences that remain ratified.

---

## §4 — Screen specs

Each spec: **purpose · layout · `DESIGN.md` tokens in play · live component(s) · checklist ·
provenance.** Since the UI is built, the spec describes what IS. Cross-story defects are tracked in
Jira / `.context/qa/regression.feature`, not re-listed here.

### 4.1 Landing / marketing site — `/`

- **Purpose.** Anonymous entry point. Sells the "AI that learns from what you actually cook" promise,
  routes to `/onboarding` (primary) and `/signup` / `/login`.
- **Layout.** `site-nav` → `hero` → `pain-points` → `how-it-works` → `learns-pro` → `impact-stats` →
  `pricing` → `faq` → `final-cta` → `site-footer`.
- **Tokens.** Cream `background`; Caprasimo `h1`/`h2`; `button` (primary green) + `button-action`
  (orange, single hero CTA); `card` for pain-point / how-it-works tiles; amber-as-text uses
  `accent-2-700` per the Do's/Don'ts contrast rule.
- **Components.** `components/landing/*` (10 files), composed by `app/page.tsx`.
- **Checklist.** [ ] one orange CTA only · [ ] amber text at `accent-2-700` not `secondary` ·
  [ ] header logo links to `/` and is legible over every section (DEFECT-FRESCO-169/173) ·
  [ ] footer copyright year not hard-coded (DEFECT-FRESCO-235) · [ ] "ya tengo cuenta" → `/login`
  (DEFECT-FRESCO-129).
- **Provenance.** Content ratified from a standalone HTML mock (`fresco_landing.html`, 2026-07-26);
  rebuilt as token components, **not** the mock's CSS — see §5-A. No inflated social-proof numbers
  (§5-B).

### 4.2 Login — `/login`

- **Purpose.** Password sign-in for existing accounts.
- **Layout.** Centred single-column card: `h3` "Inicia sesión", email + password inputs, primary
  submit, `/forgot-password` link, `/signup` link. Own `layout.tsx` sets an auth-specific `<title>`
  (DEFECT-FRESCO-174) and shows logo + spacing (DEFECT-FRESCO-252/269).
- **Tokens.** `input` (pill, on `surface`); `button` primary; `button-ghost` for secondary links;
  `background` canvas.
- **Components.** `app/login/page.tsx`, `components/ui/input.tsx`, `password-input.tsx`,
  `email-input.tsx`, `alert-banner.tsx`.
- **Checklist.** [ ] accessible input labels (TECHDEBT-FRESCO-41) · [ ] `aria-live` on error/loading
  (TECHDEBT-FRESCO-45) · [ ] submit disabled while in-flight (DEFECT-FRESCO-114) · [ ] Supabase auth
  errors shown translated, not raw English (DEFECT-FRESCO-106) · [ ] vertical centring correct
  (DEFECT-FRESCO-269).
- **Provenance.** Live UI as built. No mockup.

### 4.3 Signup — `/signup`

- **Purpose.** Progressive registration: (1) email + password + terms, (2) OTP code confirmation,
  (3) guest-conflict → reassign-guest-data step when the email already has a guest session.
- **Layout.** Same auth card frame as login, stepped. Terms checkbox gates submit. OTP step: 6-digit
  code field (rejects < 6 digits — DEFECT-FRESCO-126). Confirmation redirects to `/onboarding`, not
  `/menu` (DEFECT-FRESCO-250/254).
- **Tokens.** `input`; `button` primary; checkbox = `components/ui/checkbox.tsx` (circular, FRESCO-191
  component); `alert-banner` for errors.
- **Components.** `app/signup/page.tsx` + `layout.tsx`.
- **Checklist.** [ ] password strength enforced before OTP (DEFECT-FRESCO-123) · [ ] direct signup
  does not create an anon session first (DEFECT-FRESCO-190) · [ ] terms links open the legal modal
  (§4.18) · [ ] own `<title>` (DEFECT-FRESCO-174).
- **Provenance.** Live UI as built. Terms step = STORY-FRESCO-53. No mockup.

### 4.4 Forgot password — `/forgot-password`

- **Purpose.** Request a password-reset email.
- **Layout.** Single email input + primary submit + confirmation message. Own `layout.tsx` title.
- **Tokens.** `input`, `button` primary, `alert-banner`, `background`.
- **Components.** `app/forgot-password/page.tsx` + `layout.tsx`.
- **Checklist.** [ ] `aria-live` confirmation · [ ] neutral copy (no account-existence leak) ·
  [ ] own `<title>`.
- **Provenance.** Live UI as built (EPIC-FRESCO-50). No mockup.

### 4.5 Update password — `/update-password`

- **Purpose.** Set a new password after following the reset link (recovery session).
- **Layout.** New password + confirm-password, match check, `minLength=6`, primary submit.
- **Tokens.** `input`, `button` primary, `alert-banner`.
- **Components.** `app/update-password/page.tsx`.
- **Checklist.** [ ] stale-error message cleared on retry (DEFECT-FRESCO-233) · [ ] match-mismatch
  shown inline · [ ] expired-recovery-session handled.
- **Provenance.** Live UI as built (EPIC-FRESCO-50). No mockup.

### 4.6 Onboarding wizard — `/onboarding`

- **Purpose.** First-run capture of household + diet + cuisine + planning scope, then trigger the
  first menu generation. Also the guest-vs-account fork (`IdentityStep`).
- **Layout.** `IdentityStep` (guest or create account) → step 1 identity (name + sex dropdown,
  TECHDEBT-FRESCO-132) → step 2 diet / allergens / cuisine (chips, no free-text — TECHDEBT-FRESCO-133;
  allergen locking implied by diet — FRESCO-275/TECHDEBT-FRESCO-131) → step 3 household (adults/children,
  bounded — DEFECT-FRESCO-110) + weekly budget (required — DEFECT-FRESCO-263/265) → step 4 planning
  selection grid (which meals × which days — TECHDEBT-FRESCO-135/136, `PlanningSelectionGrid`; "ninguno"
  blocks generation — DEFECT-FRESCO-165/172). "Atrás" button between steps (DEFECT-FRESCO-296).
- **Tokens.** `segmented-control` + `tag`/`tag-selected`/`tag-outline` for chips; `input` (pill);
  `dropdown` (`components/ui/dropdown.tsx`); `button` primary "continuar" / `button-action` on the
  final "Generar mi menú"; `card` per step; heading focus moves to step title on change
  (TECHDEBT-FRESCO-44).
- **Components.** `app/onboarding/page.tsx`, `components/onboarding/identity-step.tsx`,
  `planning-selection-grid.tsx`.
- **Checklist.** [ ] chips have `aria-pressed` (TECHDEBT-FRESCO-42) · [ ] vegano⇒vegetariano invariant
  · [ ] budget required · [ ] "ninguno" blocks submit · [ ] generation failure leaves a recoverable
  profile, not a half-state (DEFECT-FRESCO-166) · [ ] onboarding data does not leak between accounts
  (DEFECT-FRESCO-150) · [ ] page reload mid-wizard does not wipe progress (DEFECT-FRESCO-94) ·
  [ ] logo + spacing consistent with auth screens (DEFECT-FRESCO-255) · [ ] no focus ring stuck on
  step title (DEFECT-FRESCO-130) · [ ] dropdowns close on outside click (DEFECT-FRESCO-151).
- **Provenance.** Live UI as built. EPIC-FRESCO-4 + the TECHDEBT-FRESCO-131..137 redesign batch.
  No external mockup.

### 4.7 Home dashboard — `/menu`

- **Purpose.** Landing screen inside the app. Greets the user, surfaces the week's plan entry point,
  the learning-moat proof, and catalogue stats.
- **Layout.** Greeting by name (`h2`) → `calendar-suggestion-banner` (opens `/calendar`) →
  `card-insight` "Fresco aprendió …" when `explicacionAprendizaje` is non-null →
  `available-recipes-card` (catalogue count) → `savings-estimate-cards` → `latest-recipes-section`
  (horizontal scroll row of `recipe-card`) → `no-menu-empty-state` when no plan exists.
- **Tokens.** `card` + `card-insight` (accent-100/800 — the reserved learning token, real Pro data
  only, never the scaffold mock — see §5-D) + `recipe-card`; `button` primary "Ver mi plan semanal"
  (DEFECT-FRESCO-73); `horizontal-scroll-row` arrows use `primary` at full strength
  (DEFECT-FRESCO-86/207/208); `icon` 2px.
- **Components.** `components/menu/*`, `components/recipe/recipe-card.tsx`.
- **Checklist.** [ ] insight card only renders on real learning data (FRESCO-21/22) · [ ] indicator
  cards (recipes / spend / savings) sized consistently (DEFECT-FRESCO-156) · [ ] heart + bell icons
  have visual hierarchy and adequate tap target (DEFECT-FRESCO-85/155/267/288) · [ ] savings numbers
  are real estimates, not invented (DEFECT-FRESCO-74/75) · [ ] "today" cards reuse `recipe-card`, no
  bespoke variant (DEFECT-FRESCO-78) · [ ] recipe cards on `/menu` open detail on tap (FRESCO-88).
- **Provenance.** Live UI as built. EPIC-FRESCO-54 (panel de inicio) + EPIC-FRESCO-14 (learning).
  No external mockup.

### 4.8 Weekly calendar — `/calendar`

- **Purpose.** View and edit the generated weekly plan (21 slots), navigate weeks, delete or
  regenerate a week.
- **Layout.** `week-navigation` (Monday–Sunday range label, e.g. "3–9 ago" — **not** a month label,
  the data model is strictly weekly — §5-C) with prev/next capped to a bounded window
  (DEFECT-FRESCO-158/209) → horizontal-scroll grid, one 256px column per day, meal rows
  (desayuno/comida/cena) with a sticky left label (DEFECT-FRESCO-170/271) → per-slot drag handle
  (6-dot), check/X status buttons, per-slot card → `delete-week-button` (with confirm dialog —
  DEFECT-FRESCO-105/175) → `generate-week-button` ("GENERAR" pill) → `no-menu-empty-state` when empty.
- **Tokens.** `recipe-card` treatment per slot; `card`; `button-action` reserved for "Generar mi
  menú"; amber "today" pill uses near-black text per the contrast rule; drag handle + status icons
  from the 2px `icon` set; scroll affordance arrows at full `primary`.
- **Components.** `components/calendar/calendar-grid.tsx`, `week-navigation.tsx`,
  `delete-week-button.tsx`, `generate-week-button.tsx`; `@dnd-kit/core` for drag.
- **Checklist.** [ ] week label unambiguous across month boundaries (DEFECT-FRESCO-109) · [ ] delete
  needs confirmation · [ ] cannot plan past weeks (DEFECT-FRESCO-209) · [ ] no false "Pro feature"
  banner (DEFECT-FRESCO-103) · [ ] meal-row header does not detach on horizontal scroll
  (DEFECT-FRESCO-222/271) · [ ] LCP image `loading="eager"` (DEFECT-FRESCO-183) · [ ] cut-off day
  columns show a scroll indicator (DEFECT-FRESCO-184) · [ ] today's meals can be marked cooked
  (DEFECT-FRESCO-77).
- **Provenance.** A screenshot mockup (`< FEB 2026 >` + trash + "GENERAR") was supplied when seeding
  EPIC-FRESCO-60, treated as **inspiration only** per Rule 14. The 7-column fixed grid was redesigned
  to horizontal-scroll 256px columns during a live "sin personalidad" redesign (2026-08-02) — see
  §5-C. Build against the current live `/calendar`, not the mockup's visual style
  (`.context/dev-roadmap.md` §5 note for FRESCO-61/62/63).

### 4.9 Shopping list — `/shopping-list`

- **Purpose.** Show the consolidated ingredient list for the active week's plan, grouped by aisle,
  with per-item check-off.
- **Layout.** Summary card (estimated cost range + live pending count) → aisle sections, each with an
  icon header (10 real aisle names, `ChefHat` fallback) → item rows: circular checkbox + Title-Cased
  name + per-item estimated price + unit (correct pluralisation — DEFECT-FRESCO-180) → floating
  "Vaciar comprados" button, visible only when ≥1 item is checked (TECHDEBT-FRESCO-214/215).
- **Tokens.** `card` (summary, on `surface` — the deliberate subtle lift over `background`, kept over
  the mockup's pure white — §5-E); circular checkbox = `components/ui/checkbox.tsx`; aisle icon tint
  = `accent-2-100` (pre-computed, no opacity modifier — DEFECT-FRESCO-169); currency format `2,80€`
  matching `recipe-card`.
- **Components.** `components/shopping-list/shopping-list-view.tsx`, `shopping-list-generator.tsx`,
  `components/ui/checkbox.tsx`.
- **Checklist.** [ ] linked from nav / menu (DEFECT-FRESCO-164) · [ ] summary text alignment
  (DEFECT-FRESCO-213) · [ ] no invented "Sugerencias para ti" carousel / "Nuevo" badges (§5-E) ·
  [ ] "Vaciar comprados" is a bulk un-check, reusing `toggleShoppingListItem` · [ ] item names
  capitalised.
- **Provenance.** Stitch mockup attached to TECHDEBT-FRESCO-191 (screenshot + exported HTML).
  Adapted to real data + tokens; several mockup elements deliberately dropped — see §5-E.

### 4.10 Recipe library — `/recipes`

- **Purpose.** Discover the full catalogue (~1000 recipes) and manage personal recipes. Search,
  meal-type tabs, faceted filters, "create your own".
- **Layout.** Search field (placeholder truncates gracefully on mobile — DEFECT-FRESCO-176) →
  meal-type tabs (Todo / Desayuno / Comida / Cena) on the same line and size as the filter control
  (TECHDEBT-FRESCO-211) → filter entry point opening `filter-drawer` (cuisine / diet / allergen as
  multi-selects, keyboard-navigable — DEFECT-FRESCO-160/181; mobile drawer FRESCO-273, desktop
  lateral drawer FRESCO-274) → results grid of `recipe-card` / `personal-recipe-card` →
  "Crear propia" opens `create-recipe-form` dialog (name required, `maxLength=100` —
  DEFECT-FRESCO-107/118/124; ≥1 ingredient — DEFECT-FRESCO-125/186; save feedback —
  DEFECT-FRESCO-185).
- **Tokens.** `recipe-card`; `tag` variants for facet chips (2px size-stable on select —
  DEFECT-FRESCO-258/272); `segmented-control` for tabs; `input` for search; `dialog`
  (`components/ui/dialog.tsx`) for create; `filter-drawer` (`components/ui/filter-drawer.tsx`).
- **Components.** `components/recipes/recipe-library.tsx`, `filter-section.tsx`,
  `create-recipe-form.tsx`, `personal-recipe-card.tsx`, `personal-recipe-actions.tsx`,
  `delete-recipe-button.tsx`; `components/recipe/recipe-card.tsx`.
- **Checklist.** [ ] "Tus recetas" tab respects the active search + filters (DEFECT-FRESCO-115) ·
  [ ] filter chips update the results and the URL (DEFECT-FRESCO-181) · [ ] no duplicate accessible
  name on "ver más recetas" (DEFECT-FRESCO-112) · [ ] recipe meta spacing (DEFECT-FRESCO-116) ·
  [ ] difficulty never blank (DEFECT-FRESCO-122) · [ ] list virtualised / paginated, not 625+ nodes
  at once (DEFECT-FRESCO-187) · [ ] every card opens detail on tap (FRESCO-88).
- **Provenance.** Screenshot mockup + 4-point brief when seeding EPIC-FRESCO-64 (2026-08-03).
  Interpreted as a full-catalogue discovery reframe (declared explicitly, not assumed). No formal
  round-trip. FRESCO-273/274 are the orphan filter-drawer stories.

### 4.11 Recipe detail — `/recipes/[id]`

- **Purpose.** Full recipe view: image, title, tags, meta, ingredients, steps. Favourite toggle.
- **Layout.** `ArrowLeft` + "Volver" link (shared pattern, not a circular icon-only button — §5-F)
  → image area (`rounded.lg`) → title (`h3`, Caprasimo) → tag row → meta line
  ("50 min · fácil · 2,80€/persona") → ingredients list → numbered steps →
  `favorite-toggle-button`. Personal recipes render the same layout with **no** edit/delete/rate/
  menu-add/share (deliberate scope cut — feature-map gap 3).
- **Tokens.** `recipe-card` image treatment; `tag`/`tag-accent`/`tag-accent-2` (allergen flags on
  accent-2); `button-icon` circular heart; body copy at 15px base (never smaller for steps).
- **Components.** `components/recipes/recipe-detail.tsx`, `components/recipe/favorite-toggle-button.tsx`.
- **Checklist.** [ ] favourite can be toggled from detail (DEFECT-FRESCO-108) · [ ] "1 ingrediente"
  singular (DEFECT-FRESCO-125) · [ ] enum values translated, never raw (DEFECT-FRESCO-117) ·
  [ ] ingredient names accented correctly (DEFECT-FRESCO-196).
- **Provenance.** Live UI as built (EPIC-FRESCO-64, STORY-FRESCO-69). No mockup.

### 4.12 Favorites — `/favorites`

- **Purpose.** Grid of the user's favourited recipes.
- **Layout.** Header + grid of `favorite-recipe-card`. `empty-state` when none. Removing a favourite
  updates the grid live (DEFECT-FRESCO-171).
- **Tokens.** `recipe-card` treatment; `button-icon` heart; `empty-state` shared component.
- **Components.** `components/recipe/favorites-grid.tsx`, `favorite-recipe-card.tsx`,
  `components/ui/empty-state.tsx`.
- **Checklist.** [ ] un-favourite removes the card immediately · [ ] card opens detail on tap
  (FRESCO-88) · [ ] shares the enter/exit list animation (FRESCO-246).
- **Provenance.** Mockup attached to TECHDEBT-FRESCO-71 (showed an outdated Despensa/Lista-Compra
  nav — rebuilt with the real 4-item nav, confirmed with the user) — see §5-F.

### 4.13 Profile & account — `/profile`

- **Purpose.** Account overview + preferences + help + subscription + danger zone.
- **Layout.** Identity header (avatar/initial + name + email + real plan `Tag`; no invented "savings €"
  counter — §5-G; email never blank, incl. invited accounts — DEFECT-FRESCO-111/178; name reflects
  live edits — DEFECT-FRESCO-179) → `nombre-form` (touched-gated, save disabled when unchanged/empty —
  DEFECT-FRESCO-113/217) → `preferences-form` (same diet chips as onboarding, update button disabled
  until dirty — DEFECT-FRESCO-216) → Ayuda section (Configuración / FAQ / Privacidad; FAQ copy must
  not claim "Gemini redacta" — DEFECT-FRESCO-121, feature-map gap 1; privacy text legible —
  DEFECT-FRESCO-162) → subscription block (`upgrade-to-pro-button`, `manage-subscription-button`,
  `push-notifications-toggle`) → danger zone: exactly three stacked actions (DEFECT-FRESCO-220) —
  Salir, Descargar copia (CSV, not JSON — DEFECT-FRESCO-163), Borrar cuenta (`delete-account-dialog`,
  type-your-own-email gate; works for invited accounts — DEFECT-FRESCO-168/177; change-password moved
  into the confirm modal — DEFECT-FRESCO-161/167).
- **Tokens.** `card` per section; `tag` for plan; `card-pro` (2px `primary` border) for the Pro
  block; `input` (pill); `dialog` for delete + change-password; `button` primary / `button-secondary`
  / destructive uses `error` clay-red.
- **Components.** `components/profile/*` (11 files), `components/layout/sidebar-account.tsx`.
- **Checklist.** [ ] three danger-zone items, stacked · [ ] backup is CSV · [ ] delete works for
  invited/anon accounts · [ ] no false-success on change-password · [ ] plan tag matches real
  subscription state (shared `lib/plan-labels.ts`) · [ ] FAQ copy matches the deterministic engine.
- **Provenance.** Two mockups (mobile + desktop) when the user asked "no parece página de perfil"
  (2026-08). Adapted to the real design system, **not** copied literally — fake diet categories
  (Kosher/Healthy/Indian/Fast) and an invented savings counter were rejected — see §5-G.

### 4.14 Notifications centre — `/notifications`

- **Purpose.** Passive in-app notices. No pantry / expiry feature exists — that framing from an early
  mockup was rejected.
- **Layout.** List of notice cards: welcome message on first entry (FRESCO-224), a "main routes of
  the platform" guide notice (FRESCO-225), recipe recommendations (FRESCO-226), payment-failed notice
  (FRESCO-232). `empty-state` only if genuinely none (was permanently empty pre-EPIC-FRESCO-223 —
  DEFECT-FRESCO-234).
- **Tokens.** `card`; `icon` 2px bell; `tag` where a notice needs a label; `empty-state`.
- **Components.** `components/notifications/routes-notice.tsx`, `recommended-recipes-notice.tsx`,
  `payment-failed-notice.tsx`.
- **Checklist.** [ ] centre is never permanently empty for a real account · [ ] no
  pantry/expiry-derived content (that data does not exist) · [ ] bell icon tap target ≥ 24px.
- **Provenance.** Mockup attached to TECHDEBT-FRESCO-72 showed "Productos por caducar, 13 items"
  (non-existent feature) and an outdated nav. Built as a placeholder first, then filled with real
  passive notices by EPIC-FRESCO-223 — see §5-F.

### 4.15 QA testability guide — `/qa`

- **Purpose.** Public "Guía de testeabilidad para QA" — architecture, demo users, DB/API/UI testing
  guidance. Owned by `/testability-guide`.
- **Layout.** `h2` title + sections (Arquitectura / Usuarios demo / Testing DB / Testing API /
  Testing UI), code blocks with copy buttons, one env-gated credentials link
  (`NEXT_PUBLIC_QA_CREDENTIALS_URL`).
- **Tokens.** `card` per section; `code-block` monospace with a visible scroll signal on mobile
  (DEFECT-FRESCO-268); `copy-button` with visual copied-feedback (DEFECT-FRESCO-188); `button`
  ghost/secondary; headings must not claim "IA" while the body says deterministic
  (DEFECT-FRESCO-127).
- **Components.** `app/qa/page.tsx`, `components/qa/code-block.tsx`, `copy-button.tsx`,
  `request-card.tsx`, `scroll-fade-wrapper.tsx`.
- **Checklist.** [ ] header + body do not contradict on "IA vs deterministic" · [ ] copy buttons
  give feedback · [ ] code blocks scrollable + signalled < 390px (DEFECT-FRESCO-293) · [ ] heading
  levels don't skip (TECHDEBT-FRESCO-39).
- **Provenance.** Generated + maintained by `/testability-guide` (EPIC-FRESCO-25). Snapshot-comment
  drift detection in the page itself. No design mockup.

### 4.16 Admin recipe management — `/admin/recipes`

- **Purpose.** Internal tool to search the catalogue and delete a bad/duplicate recipe. Gated by the
  server-only `ADMIN_USER_ID` env var (feature-map gap 2 — the missing catalogue DELETE path).
- **Layout.** `h2` "Catálogo de recetas (admin)" → search field → results with a
  `delete-catalog-recipe-button` per row.
- **Tokens.** `input`; `button` + destructive `error`; `card`/list rows. Not a customer-facing
  fidelity surface — internal-tool polish only.
- **Components.** `components/admin/admin-recipe-search.tsx`, `delete-catalog-recipe-button.tsx`.
- **Checklist.** [ ] route 404s / redirects for non-admins · [ ] delete is confirmed.
- **Provenance.** Live UI as built. No mockup, no story (added to resolve feature-map gap 2).

### 4.17 App shell / navigation — wraps `/(app)/*`

- **Purpose.** The persistent chrome around every authenticated screen. One destination set surfaced
  two ways.
- **Layout.** Desktop: `sidebar` on `primary` green background (`Logo negativo`), nav items with a
  pill highlight on the active item (`aria-current="page"` — TECHDEBT-FRESCO-40), `sidebar-account`
  block at the bottom (name + email + plan tag + logout; hierarchy per DEFECT-FRESCO-202;
  no blank email — DEFECT-FRESCO-111/178). Mobile: `bottom-tab-bar`, `background`-coloured, `primary`
  icons, dot-indicator active state, constrained height (DEFECT-FRESCO-154). `app-shell` adds
  `pb-20` so fixed mobile nav never overlaps content. `guest-logout-dialog` intercepts guest logout
  (guest data loss warning — DEFECT-FRESCO-90).
- **Tokens.** `nav-sidebar` (primary bg, background text) + `nav-bottom-tab` (background bg, primary
  icons); `icon` 2px stroke, unified glyph sizes (FRESCO-85/86/87/298); active pill = `rounded.full`.
- **Components.** `components/layout/app-shell.tsx`, `sidebar.tsx`, `bottom-tab-bar.tsx`,
  `sidebar-account.tsx`, `guest-logout-dialog.tsx`.
- **Checklist.** [ ] `Logo negativo` on the green sidebar, never the base logo · [ ] active item has
  `aria-current` · [ ] mobile nav height constrained · [ ] plan tag from shared `lib/plan-labels.ts`
  · [ ] icons at 2px stroke (no global `stroke-width:3` override — DEFECT-FRESCO-298) · [ ] guest
  logout warns about data loss · [ ] unauthenticated `/(app)/*` redirects to `/login`
  (DEFECT-FRESCO-83).
- **Provenance.** Sidebar colour = DEFECT-FRESCO-70 (moved onto `primary`, reconciled into
  `DESIGN.md`). User-block redesign = DEFECT-FRESCO-202. No external mockup.

### 4.18 Legal modal — cross-cutting overlay

- **Purpose.** Show Terms of Service / Privacy Policy / contact without leaving the current screen.
- **Layout.** Client-only modal, opened from signup terms links, profile → Privacidad, and the
  landing footer. Scrollable long-form content.
- **Tokens.** `dialog` (overlay — this is the one place `shadow.lg` is legitimate); body copy 15px;
  `button-ghost` close.
- **Components.** `components/legal/legal-modal.tsx`, `legal-links.tsx`.
- **Checklist.** [ ] reachable from all three entry points · [ ] focus trap + `Esc` close ·
  [ ] scroll contained in the dialog, page body does not scroll.
- **Provenance.** Live UI as built (EPIC-FRESCO-49, STORY-FRESCO-51). No mockup.

### 4.19 Motion & transitions layer — cross-cutting

- **Purpose.** The animation system layered over every screen (EPIC-FRESCO-244).
- **Scope.** Page-to-page transitions (FRESCO-245); list/card enter + exit, e.g. recipe grids,
  shopping-list rows, calendar slots (FRESCO-246); modal open/close for `dialog` (FRESCO-247);
  immediate micro-interaction feedback on buttons/toggles/checkbox (FRESCO-248);
  `prefers-reduced-motion` compliance that disables non-essential motion (FRESCO-249).
- **Tokens.** No new colour/space tokens — motion durations/curves live with the transitions
  implementation, not `DESIGN.md` (`DESIGN.md` §Layout note: no motion tokens defined). Uses the
  `transitions-dev` / `animate` skill conventions.
- **Checklist.** [ ] every animation has a reduced-motion path · [ ] no layout shift from enter/exit
  · [ ] modal transitions do not trap focus mid-animation.
- **Provenance.** EPIC-FRESCO-244. No mockup — motion spec is behavioural, defined in the epic AC.

### 4.20 Error & not-found screens — `error.tsx` / `global-error.tsx` / `not-found.tsx`

- **Purpose.** Framework-level safety nets (TECHDEBT-FRESCO-46).
- **Layout.** Centred message + a primary action back to safety. `not-found.tsx` is branded, not the
  Next.js default (DEFECT-FRESCO-182).
- **Tokens.** `background` canvas; `h2` Caprasimo; `button` primary; keep it minimal.
- **Components.** `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
- **Checklist.** [ ] `not-found` is styled · [ ] `global-error` renders without the app shell /
  providers · [ ] copy in Spanish, no raw stack trace.
- **Provenance.** Live UI as built. No mockup.

---

## §5 — Divergence register

Deliberate, **ratified** departures from a screenshot mockup or from `DESIGN.md`, with reason. Every
entry here was decided in the open (stated in the story plan or the bitácora) under LIVE-UI-FIRST
(Rule 14). Anything not ratified here is a defect. Sourced from `.context/bitacora.md` and story
compliance notes.

| ID | Screen | Divergence | From | Reason (ratified) | Source |
|---|---|---|---|---|---|
| §5-A | Landing (`/`) | Rebuilt as token components using Caprasimo/Figtree + exact brand green/orange; the mock's own CSS (Satoshi font, blue-grey palette) was discarded. | `fresco_landing.html` standalone mock | The mock was approved for **content**, not styling — its typography/colour came from a different draft. `DESIGN.md` tokens win. | bitácora 2026-07-26 |
| §5-B | Landing (`/`) | "+200 familias ya planifican" social-proof number removed; replaced with two honest value props (time saved, less food wasted). | Early landing copy | The number was invented and presented as fact (unlike the obviously-illustrative menu preview). User agreed it should not ship. | bitácora (impact-stats note) |
| §5-C | Calendar (`/calendar`) | 7-column fixed grid (≈120px/day, broke recipe names) → horizontal-scroll row, 256px columns, amber "today" pill. Week label is a Mon–Sun date range ("3–9 ago"), **not** the mockup's month label ("FEB 2026"). | `/calendar` seeding screenshot (EPIC-FRESCO-60) | The fixed grid had "no personality" and truncated names; the data model is strictly weekly so a month label would misrepresent it. No `DESIGN.md` screen spec for `/calendar` existed — no new tokens invented. | bitácora 2026-08-02, 2026-08-03; dev-roadmap §5 |
| §5-D | Home (`/menu`) | The `card-insight` component renders **only** on real Pro learning data; the scaffold's placeholder insight card (from `/project-bootstrap`) was removed, not left wired to mock text. | `/project-bootstrap` scaffold mock | `card-insight` is a meaning-carrying, reserved token (the visible proof of the Pro moat) — it must never show fake content. | bitácora (FRESCO-21/22 notes) |
| §5-E | Shopping list (`/shopping-list`) | Dropped from the Stitch mockup: "Sugerencias para ti" carousel, "Nuevo" badges, mockup's Pantry/History bottom nav, pure-white cards. "Completar compra" CTA repurposed as "Vaciar comprados". | TECHDEBT-FRESCO-191 Stitch mockup | No backing data exists for suggestions/badges; the bottom nav is the global `AppShell` nav; cards use the real `surface`-over-`background` subtle lift per `DESIGN.md` (§Elevation) rather than the mockup's pure white; there is no "complete shopping" backend action. | bitácora 2026-08 (FRESCO-191 x3 passes) |
| §5-F | Favorites (`/favorites`), Notifications (`/notifications`) | Used the real 4-item nav (not the mockups' Despensa/Lista-Compra nav); used the shared `ArrowLeft` + "Volver" link (not a circular icon-only back button); Notifications shipped without any pantry/expiry content. | TECHDEBT-FRESCO-71 / -72 mockups | The mockups showed a nav and a pantry-expiry feature that do not exist in Fresco; confirmed with the user before building. | bitácora 2026-08 (FRESCO-71/72) |
| §5-G | Profile (`/profile`) | Rejected the mockups' fake diet categories (Kosher/Healthy/Indian/Fast) in favour of the real diet chips reused from onboarding; did not add the mockup's "savings €" counter; Ayuda sub-pages are inert "Próximamente" rows. | Profile redesign mockups (mobile + desktop) | The real schema has no such categories and no per-user savings figure; the sub-pages don't exist yet — same inert-CTA pattern as the Pro upsell on the same page. | bitácora 2026-08 (profile redesign) |
| §5-H | Recipe detail (`/recipes/[id]`) & personal recipes | Personal recipes render with **no** edit / delete / rate / add-to-menu / share affordance. | Implicit parity with catalogue recipes | Explicit MVP scope cut, documented in `recipe-detail.tsx`. Tracked as feature-map gap 3 / TECHDEBT-FRESCO-236, not a defect. | `components/recipes/recipe-detail.tsx`; feature-map §8 gap 3 |
| §5-I | Sidebar / plan tag (`/(app)/*`) | One text divergence in the sidebar subscription line, accepted during the FRESCO-84 adversarial review. | FRESCO-84 spec | Ratified by LIVE-UI-FIRST in the review; the live wording read better than the spec's. | bitácora (FRESCO-84 review, "1 divergencia de texto ratificada") |

> **Not divergences (reconciled into `DESIGN.md`):** FRESCO-283 amber-CTA contrast, FRESCO-285/299
> `text-tertiary` darkening, FRESCO-303 pricing check colour, FRESCO-70 sidebar-on-green, FRESCO-298
> icon stroke held at 2px. These changed the token spec itself, so they are the contract now, not
> departures from it (see §2).

---

## §8 — US→Screen map

One row per story that renders UI, across the 20 epics + the `_orphans` bucket. `Primary screen` is
the §4 spec to build against; `Also touches` lists secondary screens. Task-only epics (no user
stories) are listed at the end.

| Story | Title (short) | Epic | Primary screen (§4) | Also touches |
|---|---|---|---|---|
| FRESCO-5 | Onboarding: diet + cuisine + household setup | EPIC-FRESCO-4 Onboarding | 4.6 Onboarding | 4.17 App shell |
| FRESCO-7 | Generate a 21-meal weekly menu | EPIC-FRESCO-6 AI Menu Generation | 4.8 Calendar | 4.6 Onboarding (final step), 4.7 Home |
| FRESCO-9 | Guarantee: no allergen / disliked ingredient in the plan | EPIC-FRESCO-8 Food-Safety Guardrail | 4.8 Calendar (AlertBanner surface) | 4.7 Home — mostly backend/cross-cutting guardrail |
| FRESCO-11 | Calendar: reorder the generated menu by dragging | EPIC-FRESCO-10 Editable Calendar | 4.8 Calendar | — |
| FRESCO-13 | Shopping list: generate and check off items | EPIC-FRESCO-12 Shopping List | 4.9 Shopping list | 4.17 App shell (nav link) |
| FRESCO-15 | Learning: mark a menu dish as cooked | EPIC-FRESCO-14 Cooked/Discarded Learning | 4.8 Calendar | 4.7 Home |
| FRESCO-22 | Learning: show a visible explanation of what Fresco learned | EPIC-FRESCO-14 Cooked/Discarded Learning | 4.7 Home (`card-insight`) | 4.8 Calendar (AlertBanner) |
| FRESCO-17 | Guest mode: generate a menu without creating an account | EPIC-FRESCO-16 Guest Mode | 4.6 Onboarding (`IdentityStep`) | 4.7 Home, 4.17 App shell |
| FRESCO-19 | Progressive registration: prompt to register after the preview | EPIC-FRESCO-18 Progressive Registration | 4.6 Onboarding | 4.3 Signup |
| FRESCO-53 | Registration: accept Terms of Service and Privacy | EPIC-FRESCO-18 Progressive Registration | 4.3 Signup | 4.18 Legal modal, 4.6 Onboarding |
| FRESCO-51 | Legal: read Terms / Privacy / contact | EPIC-FRESCO-49 Legal & Contact | 4.18 Legal modal | 4.3 Signup, 4.13 Profile, 4.1 Landing (footer) |
| FRESCO-52 | Recover password: reset from the email link | EPIC-FRESCO-50 Password Recovery | 4.4 Forgot password | 4.5 Update password |
| FRESCO-55 | Home: greet the user by name | EPIC-FRESCO-54 Home Panel | 4.7 Home | 4.17 App shell |
| FRESCO-56 | Home: featured suggestion that opens the calendar | EPIC-FRESCO-54 Home Panel | 4.7 Home (`calendar-suggestion-banner`) | 4.8 Calendar |
| FRESCO-57 | Home: show the number of available recipes | EPIC-FRESCO-54 Home Panel | 4.7 Home (`available-recipes-card`) | — |
| FRESCO-58 | Home: show weekly savings estimates | EPIC-FRESCO-54 Home Panel | 4.7 Home (`savings-estimate-cards`) | — |
| FRESCO-59 | Home: show the latest added recipes | EPIC-FRESCO-54 Home Panel | 4.7 Home (`latest-recipes-section`) | 4.11 Recipe detail |
| FRESCO-61 | Calendar: navigate between menu weeks | EPIC-FRESCO-60 Weekly Menu Control | 4.8 Calendar (`week-navigation`) | — |
| FRESCO-62 | Calendar: delete the current week's menu | EPIC-FRESCO-60 Weekly Menu Control | 4.8 Calendar (`delete-week-button`) | — |
| FRESCO-63 | Calendar: generate a new menu for the week | EPIC-FRESCO-60 Weekly Menu Control | 4.8 Calendar (`generate-week-button`) | 4.7 Home |
| FRESCO-65 | Library: search recipes by name or ingredient | EPIC-FRESCO-64 Recipe Library | 4.10 Recipe library | — |
| FRESCO-66 | Library: filter recipes by meal type | EPIC-FRESCO-64 Recipe Library | 4.10 Recipe library (tabs) | — |
| FRESCO-67 | Library: filter by diet, allergens and cuisine | EPIC-FRESCO-64 Recipe Library | 4.10 Recipe library (`filter-drawer`) | — |
| FRESCO-68 | Library: create a personal recipe | EPIC-FRESCO-64 Recipe Library | 4.10 Recipe library (`create-recipe-form` dialog) | 4.11 Recipe detail |
| FRESCO-69 | Library: view full recipe detail | EPIC-FRESCO-64 Recipe Library | 4.11 Recipe detail | 4.10 Recipe library |
| FRESCO-88 | Recipes: open detail by tapping any card | EPIC-FRESCO-64 Recipe Library | 4.10 Recipe library | 4.7 Home, 4.12 Favorites, 4.11 Recipe detail |
| FRESCO-82 | Account: view account data and log out from the sidebar | EPIC-FRESCO-81 Account & Session | 4.17 App shell (`sidebar-account`) | 4.13 Profile |
| FRESCO-84 | Account: view the subscription plan in the sidebar | EPIC-FRESCO-81 Account & Session | 4.17 App shell (plan `Tag`) | 4.13 Profile |
| FRESCO-224 | Notices: welcome message on first entry | EPIC-FRESCO-223 Notices Centre | 4.14 Notifications | — |
| FRESCO-225 | Notices: main platform routes guide | EPIC-FRESCO-223 Notices Centre | 4.14 Notifications (`routes-notice`) | — |
| FRESCO-226 | Notices: recipe recommendations | EPIC-FRESCO-223 Notices Centre | 4.14 Notifications (`recommended-recipes-notice`) | 4.11 Recipe detail |
| FRESCO-228 | Subscription: upgrade to Pro from the profile | EPIC-FRESCO-227 Pro Subscription (Stripe) | 4.13 Profile (`upgrade-to-pro-button`) | Stripe hosted Checkout (external) |
| FRESCO-230 | Subscription: reflect the real subscription state | EPIC-FRESCO-227 Pro Subscription (Stripe) | 4.13 Profile | 4.17 App shell (plan tag) |
| FRESCO-231 | Subscription: manage or cancel my subscription | EPIC-FRESCO-227 Pro Subscription (Stripe) | 4.13 Profile (`manage-subscription-button`) | Stripe Billing Portal (external) |
| FRESCO-232 | Subscription: know if my payment failed | EPIC-FRESCO-227 Pro Subscription (Stripe) | 4.14 Notifications (`payment-failed-notice`) | 4.13 Profile |
| FRESCO-245 | Transitions: smoothly transition between pages | EPIC-FRESCO-244 Motion & Transitions | 4.19 Motion layer | all routes |
| FRESCO-246 | Lists/cards: animate card enter and exit | EPIC-FRESCO-244 Motion & Transitions | 4.19 Motion layer | 4.10, 4.12, 4.9, 4.8 |
| FRESCO-247 | Modals: transition open and close | EPIC-FRESCO-244 Motion & Transitions | 4.19 Motion layer | 4.13, 4.10, 4.18 (`dialog`) |
| FRESCO-248 | Micro-interactions: immediate visual feedback | EPIC-FRESCO-244 Motion & Transitions | 4.19 Motion layer | all interactive components |
| FRESCO-249 | Motion accessibility: respect `prefers-reduced-motion` | EPIC-FRESCO-244 Motion & Transitions | 4.19 Motion layer | all routes |
| FRESCO-273 | Filter: filter and sort in a new `/recipes` drawer (mobile) | `_orphans` (→ EPIC-FRESCO-64) | 4.10 Recipe library (`filter-drawer`) | — |
| FRESCO-274 | Filter: filter and sort in a lateral drawer (desktop) | `_orphans` (→ EPIC-FRESCO-64) | 4.10 Recipe library (`filter-drawer`) | — |
| FRESCO-275 | Lock allergens already implied by the selected diet | `_orphans` (→ EPIC-FRESCO-4 / -64) | 4.6 Onboarding | 4.13 Profile (`preferences-form`) |

**Epics with no user stories (task-driven — no §8 rows):**

| Epic | Nature | Screen impact |
|---|---|---|
| EPIC-FRESCO-138 Recipe migration (Food.com / Kaggle dataset) | Data pipeline (TECHDEBT-FRESCO-139..147) | None — populates the catalogue that 4.10 / 4.11 render |
| EPIC-FRESCO-25 QA testability credentials | Doc artifact + `/qa` page (`/testability-guide`) | 4.15 QA guide |
| EPIC-FRESCO-278 August-2026 technical re-audit remediation | Techdebt tasks (CI, foundation docs, Jira hygiene, this file — FRESCO-294) | Cross-cutting; no single screen |

**Count:** 43 stories enumerated · **43 mapped to at least one screen** · **0 omitted as non-UI**
(FRESCO-7 and FRESCO-9 are engine-heavy but still surface UI, so they are mapped, not omitted).
Defects (`DEFECT-FRESCO-*`) and techdebt items (`TECHDEBT-FRESCO-*`) are not stories and are not
rowed here — they are referenced inline in the relevant §4 checklists.

---

## §9 — Maintenance

- **Owner:** `/design-system` screen-mapping phase
  (`.claude/skills/design-system/references/screen-design-mapping.md`). Re-runs **UPSERT** — never
  wipe a §4 spec, a ratified §5 divergence, or the §1 scorecard.
- **When `/sprint-development` hits a UI story with no §8 row:** STOP (Rule 14). Run the just-in-time
  screen brief for that batch, capture the decision, UPSERT a §4 spec + a §8 row, then resume.
- **New screen shipped:** add its §1 row + §4 spec in the same PR that ships it.
- **New ratified divergence:** append a §5 row (never edit an existing one) with the bitácora / story
  source. A departure with no §5 row is a defect.
- **Token change reconciled into `DESIGN.md`:** move it out of §5 and note it under §2's
  "reconciled" list — it is the contract now, not a divergence.
- **Downstream consumers:** Critical Rule #14, `/sprint-development` (input #10 design-fidelity gate),
  `.context/dev-roadmap.md` §5 (mockup-gate registry — populate its table from §8 once this file
  exists), and ~9 skill files that reference `.context/design/master-design-plan.md`.
- **Cross-references:** `DESIGN.md` (root, token authority) · `.context/business/business-feature-map.md`
  §5 (UI component inventory) · `.context/dev-roadmap.md` §5 · `.context/PBI/epics/**`.
