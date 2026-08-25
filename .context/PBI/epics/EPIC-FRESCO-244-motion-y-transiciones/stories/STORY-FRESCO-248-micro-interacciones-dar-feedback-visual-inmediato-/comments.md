# Comments for FRESCO-248

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-248)

---

### Basi Montes - 8/21/2026, 11:14:04 AM

## Acceptance Criteria

```gherkin
Scenario: Dar like a una receta
  Given Laura está viendo una receta
  When toca el botón de "me gusta"
  Then el botón responde visualmente de inmediato, antes de que se confirme el resultado final

Scenario: Pulsar guardar varias veces antes de la respuesta del servidor
  Given Laura toca el botón de guardar cambios
  When lo vuelve a pulsar varias veces antes de recibir respuesta
  Then la acción no se duplica y el feedback visual se mantiene consistente

Scenario: La acción de guardado falla
  Given Laura toca una acción de guardado sin conexión a internet
  When la acción no se completa
  Then el feedback visual comunica claramente que no se guardó, en vez de mostrar una confirmación de éxito ambigua
```

---

### Basi Montes - 8/21/2026, 11:14:05 AM

## Scope

- Feedback visual inmediato al pulsar botones de acción principal (guardar, marcar, dar like).
- Feedback visual de confirmación tras completarse una acción de guardado.

---

### Basi Montes - 8/21/2026, 11:14:06 AM

## Out Of Scope

- Animaciones de carga prolongada para operaciones largas (p. ej. generación del menú semanal).
- El Centro de Avisos (funcionalidad ya existente, no se modifica).

---

### Basi Montes - 8/21/2026, 1:38:26 PM

## Spec Implementation Plan (Dev)

# Implementation Plan: STORY-FRESCO-248 - Micro-interacciones | Dar feedback visual inmediato en botones y acciones de guardado

## Overview

Purely presentational story: install `transitions-dev`'s ***Success check**** (10) and ****Like button**** (23) snippets, both already recommended by the epic's macro plan, plus a targeted reuse of ****Error state shake*** (12) for the failure path AC-3 requires but the success-only Success check snippet doesn't cover. No backend, DB, or API change — every action wired here (`addFavorite`/`removeFavorite`, `updateNombre`, `upsertUserProfile`, `toggleShoppingListItem`) already exists and already round-trips correctly; this story only adds the missing visual layer on top.

***Acceptance Criteria a cumplir******:***

- Dar like a una receta: el botón responde visualmente de inmediato, antes de que se confirme el resultado final.
- Pulsar guardar varias veces antes de la respuesta del servidor: la acción no se duplica y el feedback visual se mantiene consistente.
- La acción de guardado falla (sin conexión): el feedback visual comunica claramente que no se guardó, en vez de mostrar una confirmación de éxito ambigua.

---

## Technical Approach

***Chosen approach******:**** Install `_root.css`'s per-snippet CSS bodies for Success check (10), Like button (23), and Error state shake (12) into `app/globals.css` (the shared `:root` token block is already installed by FRESCO-247 — only the behavioral CSS rules are missing, confirmed by grep). Wire the documented `t-**` class/attribute hooks into the real components identified below. No JS animation library, no new dependency — matches the epic's Decision 1 (transitions-dev, CSS-only).

***Alternatives considered******:***

- Hand-rolled CSS for the failure state: rejected — `error-state-shake` (12) already ships the exact shake+border+message-reveal treatment AC-3 needs, verbatim CSS, just retargeted from an `<input>` to a button/row.
- `framer-motion` for the particle burst: rejected — out of the epic's own Decision 1 (no new JS animation dependency).

***Why this approach******:***

- ✅ Reuses catalog snippets close to verbatim, per the epic's own implementation notes for FRESCO-247/248.
- ✅ Every snippet ships its own `prefers-reduced-motion` guard — zero extra accessibility work.
- ❌ Trade-off: `error-state-shake`'s HTML shape assumes a text input; retargeting it to buttons/checkbox rows is an unwritten (but straightforward) adaptation — CSS pasted verbatim, only class placement on JSX differs.

---

## Real components identified (investigation, not guessed)

| Verb (Scope) | File | Current pattern |
| --- | --- | --- |
| Dar like | `components/recipe/favorite-toggle-button.tsx` | Standalone heart toggle on the recipe detail page (`/recetas/[id]`) — optimistic `setIsFavorite` before `await addFavorite/removeFavorite`, revert on catch. |
| Dar like | `components/recipe/recipe-card.tsx` | Same heart icon markup (`<Heart className={cn('size-6', isFavorite && 'fill-primary')} />`) inside every recipe card grid (`/menu`, `/recetas`, `/favoritos` via `FavoriteRecipeCard` wrapper). Identical visual affordance, different host. |
| Guardar | `components/profile/nombre-form.tsx` | "Guardar" button, `isSaving`/`saveError`/`saved` state already wired, plain-text-only success/error messages, `disabled={isSaving}` already blocks duplicate submits. |
| Guardar | `components/profile/preferences-form.tsx` | "Actualizar Preferencias" button — its own doc comment states it mirrors `nombre-form.tsx` exactly; same three states, same guard. |
| Marcar (comprado) | `components/shopping-list/shopping-list-view.tsx` | `Checkbox` toggle per shopping-list item, optimistic `setComprado` + revert + single global `errorMessage` string on failure (no per-item highlight today). |

No other component matched "guardar"/"marcar"/"like" closely enough to be a real AC target (checked `calendar-grid.tsx`, `sidebar-account.tsx`, `create-recipe-form.tsx` — none is a single-tap save/like moment the AC scenarios describe); kept to these 5 files/3 verbs deliberately, not touching every button in the app.

### Conditional-mount audit (FRESCO-247 lesson)

- ***Like button targets***: never conditionally unmounted — only `data-liked` toggles on an always-present `<button>`. No risk.
- ***Success check target**** (new checkmark in `nombre-form.tsx`/`preferences-form.tsx`): ****is**** conditionally mounted (`{saved && <span className="t-success-check" data-state="in">}`), same shape as FRESCO-247's dialog trap on the surface — but see Technical Decision 1: this snippet is `animation`-driven, not `transition`-driven, so the two-frame-commit workaround does ****not*** apply here. Flagged up front per the task's own instruction, analyzed, and ruled out with reasoning rather than discovered empirically later.
- ***Error-state-shake targets*** (Guardar buttons, shopping-list checkbox rows): always-mounted elements, only classes toggle. No risk.

---

## Implementation Steps

### Step 1: Install snippet CSS in `app/globals.css`

***Task******:**** Paste the Success check (10), Like button (23), and Error state shake (12) CSS bodies verbatim (selectors, keyframes, each snippet's own `@media (prefers-reduced-motion: reduce)` block), following the same per-snippet-block structure FRESCO-247 established for `.t-modal`. Do ****not**** re-paste `_root.css`'s `:root` token block — confirmed already present (`--check-**`, `--like-**`, `--shake-**` all resolve today).

***Details******:***

- Success check CSS: `.t-success-check`, `.t-success-check svg path` (stroke-dasharray setup), `[data-state="in"]` animation rule, `t-check-fade`/`t-check-rotate`/`t-check-blur`/`t-check-bob`/`t-check-draw` keyframes.
- Like button CSS: `.t-like-heart` (+ `path`), `[data-liked="true"]` rules, `t-like-pop` keyframe, `.t-like-particles` + `i` + `.is-bursting` rule, `t-like-burst` keyframe.
- Error state shake CSS: `.t-input` (border-color tween), `.t-input.is-error`, `.t-error-msg` reveal, `.t-input.is-shaking` + `t-input-shake` keyframe.
- Override `--like-color` from the snippet's shipped `#f40051` to `var(--color-primary)` (`#0f4e0e`) — see Technical Decision 3.

***Testing******:**** Visual smoke test each `t-**` class in isolation (dev server) before wiring; confirm `prefers-reduced-motion: reduce` (OS/emulated) collapses every new animation to instant/none.

***Estimated time******:*** 30 min

---

### Step 2: Wire Like button (23) — `favorite-toggle-button.tsx` + `recipe-card.tsx`

***Task******:*** Restructure the existing `<Heart>` markup into the snippet's documented shape and drive it off the existing `isFavorite` state — no new state, no new network call.

***File(s)******:*** `components/recipe/favorite-toggle-button.tsx`, `components/recipe/recipe-card.tsx`

***Structure/Logic******:***

- Wrap `<Heart>` in `<span className="t-like-icon">`; add a `<span className="t-like-particles">` sibling with 8 `<i>` elements.
- Apply `.t-like` + `data-liked={isFavorite}` to the `Button`; apply `.t-like-heart` to the `Heart` icon, replacing the current ad-hoc `isFavorite && 'fill-primary'` Tailwind conditional (superseded by the snippet's own `[data-liked="true"]` CSS).
- On a like (transition `false → true` only — snippet spec: "unliking reverses the fill without the particles"), add `.is-bursting` to the button, seed each `<i>`'s `--px`/`--py`/`--pdelay` inline style (8 particles at ~45° increments for an organic spray), then remove `.is-bursting` after `--like-particle-dur` (600ms) via `setTimeout`.
- AC-1 ("responde de inmediato, antes de la respuesta final") is already satisfied by the existing optimistic `setIsFavorite(next)` call preceding `await addFavorite/removeFavorite` — this step is the visual layer only, no logic change to `handleToggle`.

***Edge cases handled******:***

- Rapid double-tap (like → unlike → like): each `data-liked` flip retriggers the CSS animation cleanly (attribute-selector match, no reflow trick needed per the snippet's own "JavaScript orchestration: None — pure CSS" note).
- Network failure on toggle: existing `catch` block already reverts `isFavorite` — the heart visually un-fills back to its prior state, which is itself sufficient failure feedback for this specific AC (AC-3 is scoped to "guardado", not "like", per the story's own Gherkin).

***Testing******:*** Playwright — like a recipe on `/recetas/[id]`, assert `data-liked="true"` + particle burst fires once; like from a card grid on `/menu`, same assertion; toggle off, assert no particle burst.

***Estimated time******:*** 1h (both files share the identical pattern)

---

### Step 3: Wire Success check (10) + Error state shake (12) — `nombre-form.tsx`

***Task******:*** Upgrade the existing text-only `saved`/`saveError` states with the two snippets, without touching `handleSubmit`'s logic.

***File******:*** `components/profile/nombre-form.tsx`

***Structure/Logic******:***

- Success: render a small `<Check>` (lucide, already used by `Checkbox`) SVG wrapped in `<span className="t-success-check" data-state="in">` next to the existing "Nombre guardado." text, inside the current `{saved && (...)}` block. Calibrate `stroke-dasharray` to this `Check` path's real `getTotalLength()` (replace the snippet's `20` placeholder).
- Failure (AC-3): wrap the submit `Button` in `<div className="t-input-wrap">`, apply `.t-input` to the `Button` itself. In `handleSubmit`'s `catch`, add `.is-error` to both wrap+button and `.is-shaking` to the button (remove → reflow → re-add, per the snippet's documented replay pattern) instead of only setting `saveError` text. Auto-revert after `--revert-hold` (3000ms) exactly as documented.
- Multi-click guard (AC-2): no change — `disabled={!isValid || isSaving || !isDirty}` already blocks a second submit while `isSaving` is true; confirm visually the disabled state doesn't fight the shake/success classes (shake is a `catch`-only trigger, success is a resolved-`await`-only trigger, so they're mutually exclusive per submit).

***Edge cases handled******:***

- User edits the name again right after a shown error: existing `onChange` already does `setSaved(false)` — extend it to also clear `.is-error`/`.is-shaking` (mirrors the reference doc's "typing cancels the auto-revert" recommendation).
- Repeated saves in a row (AC-2): each successful save cycles `saved` false→true→false→true (on next edit), so the checkmark's DOM node unmounts/remounts each time — see Technical Decision 1 for why this replays correctly without the reflow trick.

***Testing******:*** Playwright — save a valid name, assert checkmark plays once; simulate offline (`route.abort()`), save, assert button shakes + border goes to error color + message reveals + auto-reverts after ~3s.

***Estimated time******:*** 45 min

---

### Step 4: Wire Success check (10) + Error state shake (12) — `preferences-form.tsx`

***Task******:*** Identical wiring to Step 3 — this component's own doc comment already states its save/error/success states "mirror `components/profile/nombre-form.tsx` exactly," so the same checkmark + shake pattern applies 1:1 against `handleSubmit`'s existing `catch`/success branches and the existing `disabled={isSaving || !isDirty}` guard.

***File******:*** `components/profile/preferences-form.tsx`

***Testing******:*** Same two Playwright scenarios as Step 3, run against "Actualizar Preferencias" instead of "Guardar".

***Estimated time******:*** 30 min (mechanical repeat of Step 3's pattern)

---

### Step 5: Wire Error state shake (12) — `shopping-list-view.tsx` "marcar comprado"

***Task******:*** Add failure-only feedback to the shopping-list checkbox toggle; no success-check needed (see reasoning below).

***File******:*** `components/shopping-list/shopping-list-view.tsx`

***Structure/Logic******:***

- AC-1 for this action is already satisfied natively: `Checkbox`'s `:checked`/`peer-checked` CSS fires synchronously on click, before the optimistic `setComprado` call or the network request — the checked-fill IS the immediate feedback, so Success check (10) is deliberately ***not*** applied here (lower-overhead treatment already exists, consistent with the decision-rule tie-breaker).
- Failure (AC-3): add a new `shakingItem: { pasilloIdx: number, itemIdx: number } | null` state. In `handleToggle`'s `catch`, set it to the failing coordinate (alongside the existing `setErrorMessage(...)` call) and clear it after the shake duration. At the usage site (not inside the shared `Checkbox` component — kept generic per this repo's data-testid-standards convention), wrap the per-item `Checkbox` in `<div className="t-input-wrap">` / apply `.t-input` to that wrapper, driven by `shakingItem?.pasilloIdx === pasilloIdx && shakingItem?.itemIdx === itemIdx`.
- Multi-click guard (AC-2): already covered — the checkbox's native checked state plus the synchronous `setComprado` optimistic update mean a second rapid click before the first `await` resolves toggles a UI state that's already internally consistent (React batches the state update); no new guard code beyond this step's failure-highlight.

***Edge cases handled******:***

- Two different items failing back-to-back: `shakingItem` holds only the most recent failing coordinate — acceptable given `errorMessage` is also a single global string today (not a regression, matches existing single-message design).

***Testing******:*** Playwright — simulate offline, toggle an item, assert only that item's row shakes (not siblings) + the existing `shopping*list*toggle*error*message` still renders.

***Estimated time******:*** 45 min

---

## Technical Decisions (Story-specific)

### Decision 1: Two-frame-commit pattern NOT required for this story's targets

***Chosen******:*** Skip the two-frame-commit workaround FRESCO-247's `dialog.tsx` needed.

***Reasoning******:***

- ✅ FRESCO-247's bug was `.t-modal` using a CSS `transition` on an element that mounted already carrying `.is-open` in the same React commit — `transition` needs two distinct painted frames to interpolate, and a fresh node has no "before" frame.
- ✅ Both snippets here (`t-like-pop`, `t-check-*`) are `@keyframes`-driven for their entrance moments, and CSS animations autoplay on element insertion regardless of any prior painted frame — this is exactly why the Success check reference doc itself says the reflow trick "only matters when you replay the appear from an already-visible state," not on first mount.
- ✅ The conditionally-mounted Success check target (nombre-form/preferences-form) actually benefits from React's mount/unmount cycle: each save round-trip unmounts then remounts the checkmark (`setSaved(false)` → `setSaved(true)`), which is itself a fresh element that replays correctly — no manual reflow call needed.
- ❌ Trade-off: this correctness relies on the mount/unmount lifecycle, not an explicit replay call — a future refactor that keeps the checkmark permanently mounted (toggling `data-state` instead of conditional JSX) would need to reintroduce the reflow trick. Worth a one-line code comment at the call site.

### Decision 2: Error state shake (12) retargeted from inputs to buttons/rows, not a bespoke failure animation

***Chosen******:*** Reuse `error-state-shake`'s CSS verbatim; only the class placement on JSX moves from `<input>` to the Guardar `<button>` and the shopping-list `Checkbox` wrapper.

***Reasoning******:***

- ✅ AC-3 needs a treatment that reads as distinctly "did not save," not an ambiguous success — shake + border-color + revealed message is exactly that, and `saveError`/`errorMessage` state already exists everywhere; this is a visual upgrade of an existing code path.
- ✅ Success check (10) is explicitly success-only per its own doc ("bring your own hide behavior... success states are usually persistent") — it does not cover the failure moment, confirming the task's instinct to look elsewhere rather than force-fitting it.
- ❌ Trade-off: the snippet's documented HTML shape assumes a text input + message pair; retargeting the shaking element to a button or checkbox row is an adaptation the reference doc doesn't spell out verbatim (the CSS itself needs no change).

### Decision 3: Like-button color overridden to the app's existing primary green

***Chosen******:*** `--like-color: var(--color-primary)` (`#0f4e0e`) instead of the snippet's shipped `#f40051`.

***Reasoning******:***

- ✅ Keeps the celebration color consistent with the `fill-primary` heart treatment already live today — avoids a visual regression where the heart flashes stock magenta mid-animation before settling to green.
- ❌ Trade-off: diverges from a fully verbatim install for this one tunable — acceptable, the skill explicitly documents tunables as meant to be overridden; only the CSS **rules** must stay verbatim.

---

## Dependencies

***Pre-requisitos técnicos******:***

- [x] `_root.css` universal token block installed in `app/globals.css` (FRESCO-247) — confirmed present via grep, not re-installed.
- [ ] None blocking — all 5 target files exist today and were read in full during this planning pass.

---

## Risks & Mitigations

***Risk 1******:*** Heart-icon markup is duplicated across `favorite-toggle-button.tsx` and `recipe-card.tsx`; updating only one would leave the two "like" surfaces visually inconsistent.

- ***Impact******:*** Medium
- ***Mitigation******:*** Both files are one paired task (Step 2) in the same PR/commit — not sequenced across separate PRs.

***Risk 2******:*** New `shakingItem` state in `shopping-list-view.tsx` adds a bit more surface to an already-dense component.

- ***Impact******:*** Low
- ***Mitigation******:*** Scoped to a single primitive (`{pasilloIdx, itemIdx} | null`), cleared alongside the existing `errorMessage` reset points — no new effects, no new API calls.

***Risk 3******:*** `stroke-dasharray` calibration for the Success check's `Check` icon is a manual, easy-to-forget step (the snippet ships a `20` placeholder).

- ***Impact******:*** Low (cosmetic pre-reveal/over-draw only, never functional)
- ***Mitigation******:*** Measure via `path.getTotalLength()` in a local dev session before merging, called out explicitly in Step 3.

---

## Estimated Effort

| Step | Time |
| --- | --- |
| 1. Install snippet CSS (globals.css) | 30 min |
| 2. Like button — favorite-toggle-button.tsx + recipe-card.tsx | 1h |
| 3. Success check + error shake — nombre-form.tsx | 45 min |
| 4. Success check + error shake — preferences-form.tsx | 30 min |
| 5. Error shake — shopping-list-view.tsx | 45 min |
| ***Total**** | ****~******3h30*** |

***Story points******:*** N/A — not set on the Jira ticket (`Story Points: -`).

---

## Definition of Done Checklist

- [ ] Código implementado según este plan
- [ ] Los 3 escenarios AC (like, guardar repetido, guardado falla) verificados en vivo
- [ ] `--color-primary` aplicado al like-button en vez del magenta por defecto del snippet
- [ ] `prefers-reduced-motion` preservado en los 3 bloques CSS instalados
- [ ] `data-testid` añadidos donde falten en los elementos tocados (checkmark, particle burst wrapper, shake wrapper)
- [ ] Sin errores de linting/TypeScript
- [ ] Deployed to staging
- [ ] Manual smoke test en staging (desktop + mobile)

---

## Review Workload Forecast

Estimated: 320 additions + 58 deletions = 378 total lines
400-line budget risk: Medium
Chain strategy: pending
Decision needed before apply: No

Notes: split skews toward additions rather than the algorithm's default 70/30 — most of the diff is new CSS blocks and new markup (particles, checkmark, shake wrappers), with only a handful of deleted lines (the old `fill-primary` conditional class, the old error-text-only block). Largest single contributor is `app/globals.css` (~140 lines: 3 snippets' CSS bodies + reduced-motion guards, `:root` tokens excluded as already installed).

---


_Synced from Jira by sync-jira-issues_
