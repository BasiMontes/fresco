# Audit 7 - Axis UI (live browser walk-through)

- Axis: UI (functional, UX, a11y, responsive, states, performance)
- Commit: staging 1feb6062 (== main 278d56fd)
- Date: 2026-10-16
- Target: https://fresco-pre.vercel.app (auth, PRE identity), https://fresco-pro.vercel.app (unauth GET only)
- Screenshots: /private/tmp/claude-501/-Users-basimontes-fresco-fresco-app/90ad464c-c574-431b-91e1-69f0837f22b4/scratchpad/audit7/ui-shots/

## 1. Scope

(filled at the end)

## 2. Findings

### A7-UI-01 - 404 (and error) pages break the site-wide skip link: no `<main id="main">`
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: axe on https://fresco-pre.vercel.app/no-existe-xyz (360 and 1280): `skip-link (moderate): .sr-only :: No skip link target`, `landmark-one-main`, `region` x2. `app/layout.tsx:181` renders `<a href="#main">Saltar al contenido</a>` on every page; `app/not-found.tsx:15` root is `<div className="mx-auto flex min-h-screen ...">` with no `<main>`/`id="main"`. `rg '<main|id="main"' app/error.tsx app/global-error.tsx` returns nothing either.
- Impact: keyboard and screen-reader users who land on a broken link get a skip link that goes nowhere and no main landmark (WCAG 2.4.1 / 1.3.1).
- Reproduction: open /no-existe-xyz, press Tab, Enter on "Saltar al contenido": focus does not move.
- Fix: wrap the 404/error content in `<main id="main">`. Test: axe e2e on /no-existe-xyz expects zero violations.
- Screenshot: n/a (non-visual).

### A7-UI-02 - Cookie policy table overflows at 360 px inside a scroll region keyboard users cannot scroll
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: at 360 px on /legal/cookies the table measures right=513 px (overflow check: `TABLE.w-full text-left text-body-sm r=513`) inside `components/legal/legal-content.tsx:58` `<div className="mt-4 overflow-x-auto">`. axe: `scrollable-region-focusable (serious): .mt-4 :: Element should have focusable content`.
- Impact: on a phone the third column (cookie duration/purpose) is off-screen; keyboard-only users cannot scroll it into view (WCAG 2.1.1). Page itself does not scroll horizontally (docScrollW=360), so it is contained.
- Reproduction: /legal/cookies at 360x800, Tab through: the table wrapper never takes focus.
- Fix: `tabIndex={0} role="region" aria-label="Tabla de cookies"` on the wrapper, or stack the table as a definition list under `sm`. Test: axe at 360 px on /legal/cookies.
- Screenshot: ui-shots/cookies-360.png

### A7-UI-03 - Legal pages skip heading levels (h1 -> h3)
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: heading sequence on /legal/privacidad `13333333`, /legal/terminos `1333333333333`; axe `heading-order (moderate): div:nth-child(1) > h3`.
- Impact: screen-reader heading navigation shows a missing level; minor (WCAG 1.3.1 best practice).
- Reproduction: open either page, list headings.
- Fix: render section titles as `h2` (keep the visual class). Test: axe heading-order.
- Screenshot: n/a (non-visual).

### A7-UI-04 - Offline page auto-refreshes every 20 s with no user control
- Severity: INFO. Confidence: CONFIRMED.
- Evidence: `public/offline.html:22` `<meta http-equiv="refresh" content="20" />` (documented as intentional retry at line 13). axe `meta-refresh (critical)`.
- Impact: a screen-reader user reading the offline page is interrupted and returned to the top every 20 s (WCAG 2.2.1). Small real-world impact since the page is short.
- Reproduction: load /offline.html and wait 20 s.
- Fix: replace the meta refresh with a "Reintentar" button plus a `online` event listener that reloads. Test: axe on /offline.html.
- Screenshot: n/a.

### A7-UI-05 - Calendar "Descartar" button: accessible name does not contain its visible label, and neither mark button names the dish
- Severity: MEDIUM. Confidence: CONFIRMED.
- Evidence: axe on /calendar (1280): `label-content-name-mismatch (serious, 7 nodes): div[data-testid="calendar_slot_lunes_desayuno"] ... [aria-label="Marcar como descartado"] :: Text inside the element is not included in the accessible name`. Code `components/calendar/slot-mark-controls.tsx:41` `aria-label="Marcar como descartado"` on a button whose visible text is `Descartar` (line 51); line 27 `aria-label="Marcar como cocinado"` on every slot, no dish/day in the name.
- Impact: voice-control users saying "pulsa Descartar" get no match (WCAG 2.5.3 Label in Name); screen-reader users tabbing or listing buttons hear up to 14-21 identical "Marcar como cocinado / descartado" with no day or dish, so they cannot tell which meal they are marking. Marking feeds the Pro learning loop, the product's headline feature.
- Reproduction: /calendar, open the browser accessibility tree or VoiceOver rotor > Buttons.
- Fix: drop the aria-labels (visible text suffices) and add context, e.g. `aria-label={\`Descartar ${recipeName} (${diaLabel}, ${tipoLabel})\`}` which starts with the visible word. Test: axe `label-content-name-mismatch` on /calendar in e2e plus a unit test that the name contains the visible label and the recipe name.
- Screenshot: ui-shots/calendar-1280.png

### A7-UI-06 - Calendar accepts an out-of-range `?semana=` week, shows a silently rolled-over week with no year, and offers a "Generar" that always fails
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: `app/(app)/calendar/page.tsx:25` `const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/;` only checks shape, so `?semana=2026-W99` passes and `getDateFromIsoWeek` rolls it to Monday 2027-11-15. Live: /calendar?semana=2026-W99 renders header "15–21 NOV" (no year) with the empty state "Generar mi menú"; clicking it sent `POST .../functions/v1/generate-meal-plan => 400` and the UI shows "No pudimos generar tu menú. Intenta de nuevo." (retrying can never succeed). Week labels never carry a year (2027-W01 renders "4–10 ene").
- Impact: a stale or hand-edited link shows a week the user did not ask for, with no year to notice it, and a retry loop that cannot succeed. Valid weeks (W43 19–25 oct incl. DST end, W44 26 oct – 1 nov, W53 28 dic – 3 ene) render correctly with Monday start.
- Reproduction: open /calendar?semana=2026-W99, click "Generar mi menú".
- Fix: validate the week number against `isoWeeksInYear(year)` (1..52/53) and fall back to the current week like the malformed case (`?semana=abc` already falls back); show the year in the label when it differs from the current year. Test: unit test of the page's week resolver for W00, W54 and W99.
- Screenshot: ui-shots/calendar-w99.png

### A7-UI-07 - Recipe search is accent-sensitive: "limon" finds 0 recipes, "limón" finds 45
- Severity: MEDIUM. Confidence: CONFIRMED.
- Evidence: live on /recipes (PRE account, 389 recipes): `limon` -> "Prueba con otro nombre..." (0), `limón` -> "45 recetas encontradas"; `atun` 1 vs `atún` 9; `salmon` 1 vs `salmón` 13. Code: `supabase/migrations/20261013120000_add_mustard_and_lupin_to_allergen_vocabulary.sql:54` `or r.nombre ilike '%' || v_search || '%'` and `:58` `where e.val ilike '%' || v_search || '%'`; no `unaccent()` on either side. Also `%` and `_` are not escaped: searching `%` returns all 389.
- Impact: most people in Spain type without accents on a phone keyboard; they get an empty or near-empty catalog for the most common ingredients (limón, atún, jamón, salmón, plátano...) and conclude the catalog is thin. Directly hurts the search feature and first impressions.
- Reproduction: /recipes, type `limon` in "Buscar receta o ingrediente".
- Fix: compare `unaccent(lower(...))` on both sides (enable `unaccent` extension; an immutable wrapper plus a trigram index if needed) and escape `%`/`_` in `v_search`. Test: db integration test `get_catalog(p_search => 'limon')` returns the same ids as `'limón'`.
- Screenshot: ui-shots/recipes-search.png

### A7-UI-08 - Same "label in name" defect on the planning grid ("Ninguno") and "Crear receta propia"
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: axe on /profile: `label-content-name-mismatch (serious, 3)` on `[data-testid="planning_meal_select_none"]` (visible "Ninguno", name `Desmarcar ${meal.label.toLowerCase()} todos los días`, `components/onboarding/planning-selection-grid.tsx:89`); axe on /recipes: same rule on `button[data-testid="crear_propia_button"]` (`components/recipes/recipe-library.tsx:213`). The grid component is shared with onboarding.
- Impact: voice-control users cannot activate these by their visible word (WCAG 2.5.3). Same root pattern as A7-UI-05.
- Reproduction: axe on /profile and /recipes.
- Fix: make the accessible name start with the visible text, e.g. `Ninguno: desmarcar desayuno todos los días`. Test: axe e2e on /profile and /onboarding.
- Screenshot: n/a (non-visual).

### A7-UI-09 - Lunch is called "Almuerzo" in profile/onboarding/history but "Comida" in the catalog filter
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: `lib/onboarding/wizard-options.ts:98` `comida: 'Almuerzo'`, `components/onboarding/planning-selection-grid.tsx:25` `label: 'Almuerzo'`, `components/historial/menu-readonly-grid.tsx:19` `comida: 'Almuerzo'`; `components/recipes/recipe-library.tsx:30` `{ value: 'comida', label: 'Comida' }`. Live: /profile "COMIDAS A PLANIFICAR / Desayuno / Almuerzo / Cena"; /recipes filter panel "Comida".
- Impact: in much of Spain "almuerzo" means the mid-morning snack, not the midday meal ("comida"); a household planning "Almuerzo" may expect a snack and get a full lunch, and the two names for one slot look sloppy.
- Reproduction: compare /profile planning grid with /recipes > Filtrar y ordenar.
- Fix: one label ("Comida") from one shared constant. Test: unit test asserting every meal label map imports the shared constant.
- Screenshot: n/a (copy).

### A7-UI-10 - Shopping list in a shop with no signal: a ticked item silently un-ticks; the error renders off-screen and is not announced
- Severity: MEDIUM. Confidence: CONFIRMED.
- Evidence: live at 360x780 on /shopping-list, `context.setOffline(true)`, tap "Espinacas" (scrolled into view): the item reverts to unchecked; the error paragraph "No se pudo guardar el cambio. Vuelve a intentarlo." is rendered but `inViewport=false top=-367` (367 px above the visible area), `P role=null live=none`. Code: `components/shopping-list/use-shopping-list.ts:83-90` optimistic set, then on failure `setComprado(... !nextComprado)` and `setErrorMessage(...)`; `components/shopping-list/shopping-list-view.tsx:121-124` renders a plain `<p>` under the summary at the top of the page, no `role="alert"`/`aria-live`. No offline queue: the tick is lost, not deferred.
- Impact: the shopping list is used inside supermarkets, where signal is often poor. A user ticks an item, sees it un-tick a second later with no visible reason (the message is scrolled away), and may think the app is broken or buy twice. Screen-reader users get no feedback at all.
- Reproduction: /shopping-list on a phone, scroll to any item, enable airplane mode, tap the item.
- Fix: minimal: show the failure next to the item or as a toast with `role="alert"`; better: keep the optimistic state and queue the toggle (localStorage + retry on `online`). Test: component test that a rejected `toggleShoppingListItem` renders an `alert` role; e2e with `setOffline(true)` asserting the message is in the viewport.
- Screenshot: ui-shots/shopping-offline-360.png, ui-shots/shopping-offline-toggle.png

### A7-UI-11 - Ticked shopping items fall to 3.06:1 (light) / 3.55:1 (dark) contrast
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: axe on /shopping-list, light theme at 360: `color-contrast (serious): #shopping_list_item_0_4_name :: 3.06 (foreground #998c76, background #fbf6ec, 15px)`; dark theme at 1280: `3.55 (foreground #7a785c, background #0c2712, 15px)`; element classes `text-tertiary line-through opacity-70`, checked=true ("Limón").
- Impact: low-vision users can barely read what they already bought (needed to double-check the basket). WCAG 1.4.3 does not exempt "done" states.
- Reproduction: Perfil > Tema oscuro, /shopping-list, tick an item.
- Fix: drop `opacity-70` (line-through alone conveys state) or use a token that keeps >= 4.5:1 on the dark surface. Test: axe on /shopping-list in dark theme with one ticked item.
- Screenshot: ui-shots/shopping-dark-1280.png

### A7-UI-12 - Calendar marks "today" on every week, and uses the device timezone instead of Europe/Madrid
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: `components/calendar/calendar-grid.tsx:197` `const isToday = dia === JS_WEEKDAY_TO_DIA[new Date().getDay()];` compares only the weekday, never the viewed week. Live (Friday 2026-10-16) at 1920 px on /calendar?semana=2026-W41 (5–11 oct, a past week): day headers `Lunes,Martes,Miércoles,Jueves,Viernes[HOY],Sábado` -> "Viernes 9 oct" carries the today pill. `new Date()` runs in the device timezone and also during SSR (server UTC), so between 00:00 and 02:00 Madrid time the server and client disagree (hydration mismatch risk) and a traveller sees the wrong day.
- Impact: users browsing past or future weeks see a false "today" marker and can mark the wrong day as cooked. Minor confusion, no data loss.
- Reproduction: on a Friday open /calendar?semana=2026-W41 at >= 1440 px wide.
- Fix: compute `todayIso` once in Europe/Madrid (`Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid'})`) and mark today only when `mondayIso <= todayIso <= sundayIso` and the date matches. Test: unit test with a fixed clock for a non-current week (no today mark) and for 23:30 UTC Sunday (Monday in Madrid).
- Screenshot: ui-shots/calendar-w41-today-mark-1920.png

### A7-UI-13 - Mobile calendar opens on Monday, not today, and the day arrows are 28x28 px
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: at 360 px on /calendar (Friday 16 oct) the single visible column is "Lunes"; `components/calendar/use-visible-day-window.ts` has no initial scroll to today (only a scroll listener, line 51). Day arrows `components/calendar/calendar-grid.tsx:139,149` `className="grid size-7 ..."` = 28x28 px (measured "Día anterior 28x28", "Día siguiente 28x28"); week arrows 35x35. Above WCAG 2.5.8 AA (24 px) but below the 44 px the brief asks for and the iOS/Android guidance.
- Impact: on a phone, checking tonight's dinner on a Friday takes four taps on a small arrow, below a large learning-loop card that already pushes the grid under the fold.
- Reproduction: /calendar at 360x780 on any day but Monday.
- Fix: scroll the window to today's column on mount when the viewed week is the current week; make the arrows `size-11`. Test: e2e at 360 px asserting the first visible day header equals today's weekday.
- Screenshot: ui-shots/calendar-360.png

### A7-UI-14 - Delete-week dialog always says "21 franjas", even for households that plan fewer meals
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: `components/calendar/delete-week-button.tsx:86` hardcodes `Se borrarán las 21 franjas de esta semana.`; the PRE account plans only Desayuno + Cena (14 visible dishes, Almuerzo row absent from /calendar), dialog text live: "¿Eliminar el menú de esta semana? / Se borrarán las 21 franjas de esta semana. Esta acción no se puede deshacer." (cancelled, nothing deleted).
- Impact: in an irreversible confirmation, a number that does not match what the user sees (14 platos) undermines trust; "franjas" is internal jargon.
- Reproduction: plan two meals in Perfil, /calendar > Eliminar menú.
- Fix: "Se borrará el menú completo de esta semana (N platos)." with N = visible planned slots. Test: update `delete-week-button.test.tsx:47` to pass the planned count.
- Screenshot: n/a (dialog text quoted).

### A7-UI-15 - A cooked/discarded mark is permanent after a 5-second snackbar; no way to correct a mis-tap
- Severity: MEDIUM. Confidence: CONFIRMED.
- Evidence: `components/calendar/use-slot-marking.ts:9` `const UNDO_WINDOW_MS = 5000;` then commit; `supabase/functions/update-recipe-status/index.ts:29` `const TERMINAL_STATES = new Set(['cocinada', 'descartada'])`; `components/calendar/slot-cell.tsx:140-144` renders the mark buttons only when `estado === 'pendiente'`. Live: double-clicked "Cocinado" on Lunes desayuno (exactly one `POST .../update-recipe-status => 200`, double submit is guarded), after the window the slot shows "COCINADO" and contains zero buttons. The calendar's own copy says "lo que marcas no vuelve a salir durante 2 semanas".
- Impact: one accidental tap on "Descartar" (the two 44 px buttons sit stacked at the bottom of every card on mobile) bans that dish for 2 weeks and lowers its weight, with no recovery after 5 s; 5 s is also short for screen-reader and motor-impaired users to reach "Deshacer" (WCAG 2.2.1). Users who notice the mistake later lose trust in the learning feature Pro is sold on.
- Reproduction: /calendar, tap "Descartar" on any dish, wait 6 s: no control to revert.
- Fix: allow `cocinada|descartada -> pendiente` (or switching) for the current week from the slot menu, and lengthen the snackbar to >= 10 s / until dismissed. Test: edge-function test accepting a revert within the same week; component test that a marked slot exposes "Cambiar marca".
- Screenshot: ui-shots/calendar-marked.png
- Account change: this audit marked Lunes desayuno (week 2026-W42, "Tostada con salmón ahumado") as `cocinada` on the PRE account; it cannot be reverted from the UI.

### A7-UI-16 - Expired session drops the destination: protected pages redirect to bare `/login`
- Severity: LOW. Confidence: CONFIRMED.
- Evidence: `app/(app)/layout.tsx:36` `if (!user) { redirect('/login'); }` with no `next`; the login page already reads `useSearchParams` (`app/login/page.tsx:6`) and a safe-next guard exists (`lib/auth/safe-next-path.ts`, FRESCO-364). Live: cleared cookies, hard-navigated to /shopping-list -> landed on `https://fresco-pre.vercel.app/login` (no query). A client-side nav right after expiry stayed on /recipes rendering the cached page.
- Impact: a user opening a deep link (weekly reminder email, bookmarked shopping list in the shop) after the session expired logs in and lands on /menu instead of what they opened; one extra navigation, mild friction.
- Reproduction: log in, delete the Supabase auth cookies, open /shopping-list.
- Fix: `redirect('/login?next=' + encodeURIComponent(pathname + search))` (pathname from a header set in `proxy.ts`), already validated by `safe-next-path`. Test: e2e unauthenticated GET /shopping-list -> 307 to `/login?next=%2Fshopping-list`, then login lands on /shopping-list.
- Screenshot: n/a (URL quoted).

### A7-UI-17 - Landing video: no visible keyboard focus and no captions track
- Severity: LOW. Confidence: CONFIRMED (focus, track absence); PLAUSIBLE (that the video has speech that needs captions; not played).
- Evidence: `components/landing/brand-video.tsx:12-21` `<video controls playsInline preload="none" ... aria-label="Vídeo de presentación de Fresco">` with only `<source>`, no `<track kind="captions">`. Keyboard walk on https://fresco-pro.vercel.app/ at 640 px (=1280 at 200 % zoom), 25 Tab presses: the only stop with no outline and no box-shadow was "Vídeo de presentación de Fresco" (computed `outline-style: none`). Video is not autoplay (good for reduced motion).
- Impact: keyboard users lose track of focus on the video; deaf users cannot follow any narration in the product pitch (WCAG 1.2.2, 2.4.7).
- Reproduction: Tab through the landing until the video.
- Fix: `focus-visible:ring-2 focus-visible:ring-primary` on the video and a Spanish `.vtt` captions track. Test: e2e asserting the focused video has a non-none outline/box-shadow and a `track[kind=captions]`.
- Screenshot: n/a (non-visual).

## 1b. Scope (actual)
- Browser: headed Chrome via playwright-cli, one session, ~45 browser commands. Pre (authenticated, PRE identity): /login, /menu, /calendar (W41, W42, W43, W44, W53, 2027-W01, W99, `abc`), /recipes (search x10, filters panel, pagination incl. double click), /recipes/[id], /profile, /shopping-list, /notifications, /favorites, /historial. Public on pre: /, /login, /signup, /forgot-password, /update-password, /legal/{privacidad,terminos,cookies,contacto}, /sobre-nosotros, 404, /offline.html. Production: 1 page load of / (GET only).
- axe-core 4.x injected (node_modules/axe-core/axe.min.js) on every page visited: 18 public page/width runs, 11 authenticated light runs, 6 dark-theme runs. Plus per page: horizontal overflow, targets < 44 px, headings, lang, skip link, img alt, JS resource sizes, failed resources.
- Widths: landing 360/393/768/1280/1920; public pages 360/1280; app pages 1280 and 360 (calendar, menu, shopping, notifications, favorites, historial), 1920 for calendar.
- Code read (narrow ranges): app/layout.tsx, app/not-found.tsx, app/(app)/layout.tsx, app/(app)/calendar/page.tsx, components/calendar/{slot-mark-controls,calendar-grid,use-slot-marking,delete-week-button,use-visible-day-window}, components/shopping-list/{use-shopping-list.ts,shopping-list-view.tsx}, components/legal/legal-content.tsx, components/landing/brand-video.tsx, components/recipes/recipe-library.tsx, components/onboarding/planning-selection-grid.tsx, lib/onboarding/wizard-options.ts, public/offline.html, get_catalog migration 20261013120000.

### Performance numbers (pre, headed Chrome, macOS)
- Landing: 16 scripts, 344 KB transferred / 1,041 KB decoded JS, DOMContentLoaded 3.18 s, load 3.44 s (cold, first load incl. Turnstile).
- /menu: 23 scripts, 1,479 KB decoded JS (transfer not measurable, warm cache), DCL 0.83 s, load 0.98 s. /calendar 1,525 KB decoded; /recipes 1,492 KB; /profile 1,512 KB.
- Failed resources (4xx/5xx) on every page audited: none, except the deliberate W99 generate (400) and offline tests.
- Console: only `Framing 'https://vercel.live/' violates ... frame-src` (Vercel preview toolbar, preview deployments only, not production) and a Chrome "Deprecated API for given entry type" warning from my own perf probe. No hydration warnings, no mixed content, no pageerror during a 16-click rapid-navigation run (only aborted fetches logged as expected when navigation interrupts them; app recovered).

## 3. Checklist items that found nothing
- 1 Public pages: no horizontal page overflow at any width (docScrollW == viewport on all), html lang="es" everywhere, one h1 per page, skip link present (except A7-UI-01), all images have alt, landing axe clean at 5 widths, 200 % zoom (640 px) no overflow, video not autoplaying, no running animations under prefers-reduced-motion after load, dark theme axe-clean except A7-UI-11. Annual price math checks (4,99*12 - 44,99 = 14,89 EUR) and is consistent between landing and /profile ("7 días de prueba gratis, sin tarjeta. Después, 4,99€/mes. O 44,99€/año (ahorras 14,89€)").
- 2 Auth: empty submit shows "Introduce tu correo electrónico." / "Introduce tu contraseña."; wrong password "Email o contraseña incorrectos." (no account enumeration); second attempt after a failure works (Turnstile refreshes); double-click login sends exactly one token request; inputs have correct autocomplete (email, current-password); logout lands on /login and Back stays on /login; no voseo found in any text read.
- 3 App: pagination "Ver más recetas" 30->60->90 with double click, no duplicates; empty search state is clear; shopping list tick persists across reload; double-click on "Cocinado" sends one request; delete-week asks for confirmation; allergen disclaimer present next to allergen chips in /profile ("no podemos garantizar trazas ... revisa siempre las etiquetas") and in Terms.
- 6 Dates: ISO weeks correct, Monday start, W43 (19–25 oct, DST end) and W44 (26 oct – 1 nov) render 7 days correctly, W53 2026 correct; malformed `?semana=abc` falls back to current week.
- 7 Copy: Free/Pro naming and prices consistent across landing and profile; sidebar shows "Plan Free".

## 4. Could not verify
- Real CLS: my probe used `performance.getEntriesByType('layout-shift')`, which Chrome does not populate without a buffered PerformanceObserver, so the reported `cls: 0` is not evidence. JS transfer size on app pages (warm cache).
- Recipe detail with many ingredients / very long names: no such recipe found in the sample; no recipe title overflowed at 360.
- Error states via forced 5xx (route mocking) for menu/recipes; only offline was simulated (shopping list). Loading skeletons not captured.
- Onboarding (known FRESCO-856), billing/Stripe checkout (not entered), account deletion and CSV export (not triggered: destructive / not needed), notifications empty state (account has recommendations).
- Whether the landing video contains speech (not played).

## 5. Account changes and hygiene
- PRE account: Lunes desayuno W42 marked `cocinada` (irreversible, see A7-UI-15); "Ajo" ticked then unticked (net no change); theme set to dark then back to "Tema claro"; one rejected generate attempt on 2026-W99 (400, nothing written). Cookie banner: "Rechazar" clicked in the test browser only.
- A temporary storage-state file (auth cookies) was written to the audit7 scratchpad for the session-expiry test and deleted right after (`rm -f auth-tmp.json`); the session was then logged out.
- secrets_materialized: session-cookies (scratchpad, deleted)
- cleaned: yes (browser closed with `playwright-cli close`)
