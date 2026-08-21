# Comments for FRESCO-247

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-247)

---

### Basi Montes - 8/21/2026, 11:14:00 AM

## Acceptance Criteria

```gherkin
Scenario: Abrir un modal existente
  Given Laura está navegando la app
  When abre el modal de aviso legal desde el menú
  Then el modal aparece con una transición suave y se puede cerrar con la misma suavidad

Scenario: Abrir y cerrar el mismo modal repetidamente
  Given Laura tiene un modal abierto
  When lo abre y cierra varias veces seguidas en rápida sucesión
  Then el modal no queda en un estado visual inconsistente ni duplicado en pantalla

Scenario: Cerrar un modal y abrir otro distinto de inmediato
  Given Laura cierra un modal (p. ej. la ayuda)
  When abre inmediatamente otro modal distinto (p. ej. el formulario de crear receta)
  Then cada modal transiciona de forma independiente y predecible, sin arrastrar el estado visual del anterior
```

> Corregido 2026-08-21: el modal de detalle de receta y los paneles laterales no existen en la app — reescrito contra la UI real.

---

### Basi Montes - 8/21/2026, 11:14:01 AM

## Scope

- Transición de apertura y cierre para los modales existentes de la app: aviso legal, confirmación de cerrar sesión como invitado, confirmación de borrar cuenta, formulario de crear receta propia, ayuda, confirmación de vaciar la semana.

> Corregido 2026-08-21: el modal de detalle de receta y los paneles laterales no existen en la app — reescrito contra la UI real.

---

### Basi Montes - 8/21/2026, 11:14:02 AM

## Out Of Scope

- Paneles laterales deslizables — no existen actualmente en la app; si se construyen en el futuro, se animan en una historia aparte.
- El detalle de una receta — es una pantalla propia (no un modal); su transición de navegación la cubre la historia "Transiciones de Página" (FRESCO-245).
- El contenido interno de cada modal (formularios, scroll) — solo su transición de apertura y cierre.

> Corregido 2026-08-21: el modal de detalle de receta y los paneles laterales no existen en la app — reescrito contra la UI real.

---

### Basi Montes - 8/21/2026, 12:43:50 PM

## Spec Implementation Plan (Dev)

# Implementation Plan: STORY-FRESCO-247 - Modales y Paneles | Transicionar apertura y cierre de modales y paneles laterales

## Overview

Wire transitions-dev's CSS-only Modal (06) and Panel reveal (07) snippets onto Fresco's real open/close surfaces, and install the `_root.css` universal motion-token block into `app/globals.css` once (first story in EPIC-FRESCO-244 to touch it). Purely presentational — no new entity, schema, or API contract.

***Acceptance Criteria a cumplir (Gherkin, from FRESCO-247 comments)******:***

- Abrir el detalle de una receta: modal opens/closes with a smooth transition.
- Abrir y cerrar un modal repetidamente: no inconsistent/duplicated visual state.
- Abrir un modal con el Centro de Avisos ya abierto: both transition predictably, no confusing overlap.

> ***WARNING:*** Codebase investigation found the AC's own UI assumptions do not match what is actually shipped. See "Gap vs. reality" below — read before Stage 2 starts.

---

## Gap vs. reality (investigated, not assumed)

- ***"Detalle de receta" is NOT a modal.*** Tapping a card in `components/recipes/recipe-library.tsx` renders a `<Link href={`/recipes/${id}`}>` to `app/(app)/recipes/[id]/page.tsx` — a plain server-rendered full page. No `@modal` parallel route, no intercepting route (`(.)recipes/[id]`), confirmed by listing `app/(app)` — only `recipes/[id]/page.tsx` exists. Scenario 1, as literally written, cannot be delivered by "add a CSS transition to an existing modal" — there is no modal there to transition.
- ***"Paneles laterales (cuenta, Centro de Avisos)" do not exist as overlays.*** Account info (`components/layout/sidebar-account.tsx`) renders inside the always-visible desktop `<aside>` (`components/layout/sidebar.tsx`, `hidden md:flex`, no open/close state at all). Centro de Avisos (`app/(app)/notifications/page.tsx`) is also a full page route, not an overlay. Grepped the whole tree for `sheet|drawer|slide-over|side-panel|translate-x-full` — zero real hits. There is no sliding-panel/drawer/sheet component anywhere in `components/` or `app/` to wire `t-panel-slide` onto.
- ***The one real modal primitive is ****`components/ui/dialog.tsx` — a hand-rolled, portal-based `Dialog` (FRESCO-51 doc comment: no Radix/dialog library in this codebase; confirmed via `package.json`, no `@radix-ui/**` dependency). It is the single mechanism behind 6 real modal call sites: `components/legal/legal-modal.tsx` (Scope's "información legal" example — the one Scope example that DOES match reality), `components/recipes/create-recipe-form.tsx`, `components/layout/guest-logout-dialog.tsx`, `components/profile/delete-account-dialog.tsx`, `components/profile/ayuda-section.tsx`, `components/calendar/delete-week-button.tsx`. All 6 are simple `open`/`onOpenChange` boolean state at the call site.
- `Dialog`*** currently hard-unmounts on close*** (`if (!open) { return null; }`, line 77) — there is no closing state today, so an exit transition literally cannot play without a code change (not just a CSS paste).

***Recommendation surfaced to PM (not resolved here)******:*** correct AC scenario 1's example to an existing modal (e.g. "información legal") or scope a follow-up story to convert recipe detail to an intercepting-route modal; correct or descope "paneles laterales" until an actual panel/drawer component exists. This plan proceeds on what is real: transitioning the shared `Dialog` primitive, and installing the panel tokens for later use without inventing a panel component now.

---

## Technical Approach

***Chosen approach******:*** Transition the shared `Dialog` primitive once (`components/ui/dialog.tsx`), so all 6 existing consumers inherit the Modal (06) open/close transition for free. Install the transitions-dev universal token block into `app/globals.css` (existing `:root` block) in the same pass. Do not wire Panel reveal (07) into anything — no real target exists (see Gap section) — but still install its tokens now since the universal block install is one-time.

***Alternatives considered******:***

- Add the transition per-consumer (6× duplicated CSS class wiring): rejected — violates DRY, and the shared primitive is the correct single point of control already established by FRESCO-51's own convention (custom hand-rolled Dialog specifically to avoid divergent per-call-site overlay implementations).
- Introduce Radix Dialog/Sheet now to get transition primitives for free: rejected — out of scope for a CSS-transition story, and FRESCO-51's own doc comment already rejected Radix for this exact reason ("every other `components/ui/*` component is a bare cva/forwardRef wrapper... this follows the same pattern rather than introducing Radix for a single use case").
- Build a new sliding-panel component now to satisfy the panel AC: rejected — inventing new UI/architecture is out of this story's real scope ("transicionar apertura y cierre" implies wiring transitions onto **existing** open/close mechanisms, not building new ones) and violates the "don't invent existing behavior" investigation contract.

***Why this approach******:***

- ✅ Single code change (`dialog.tsx`) benefits 6 real call sites, including the one Scope example that matches reality (legal modal).
- ✅ No new dependency — stays CSS-only per epic Decision 1 (transitions-dev, no new JS lib).
- ✅ Token block installed once now means FRESCO-245/246/248/249 never need to touch `app/globals.css`'s `:root` again for their own tokens.
- ❌ Trade-off: does not close AC scenarios 1 and 3 as literally worded — flagged above, not silently papered over.

---

## Types & Type Safety

N/A — CSS-only story, no new entities, no backend types touched. `Dialog`'s existing `DialogProps` interface is unchanged (no new prop needed; the `open` boolean already exists on every call site).

## Content Writing

N/A — no new user-facing copy.

## UI/UX Design

No new screens or components. Motion is governed entirely by transitions-dev's token scale (see epic Decision 1) rather than DESIGN.md's spacing/radius/shadow tokens — the two coexist without conflict: `Dialog` already consumes DESIGN.md's `shadow.lg` and the documented `z-index: modal 1000` convention (DESIGN.md line 259) unchanged by this story; transitions-dev only adds `transform`/`opacity`/`filter` transition rules on top.

---

## Implementation Steps

### Step 1: Install the transitions-dev universal token block (one-time, epic-wide)

***Task******:**** Paste `_root.css`'s full `:root` block (all 27 transitions' `--duration-**`, `--ease-**`, `--distance-**`, `--scale-**`, `--blur-**`, plus every transition's own semantic tunables, including `--modal-**` and `--panel-**`) verbatim into `app/globals.css`, merged into the existing `:root { --color-**: ... }` block (do not create a second `:root` selector) under a clear `/** transitions-dev motion tokens — installed once, FRESCO-247 */` comment banner.

***File******:**** `app/globals.css` (modify — existing 119-line file, has one `:root` block for `--color-**` tokens already)

***Details******:***

- Copy the token block byte-for-byte from the `transitions-dev` skill's `_root.css` — no renaming, no reordering.
- This is a one-time install for the whole epic; FRESCO-245/246/248/249 read from these same names without re-touching this file.

***Testing******:**** Visual no-op (declarations only, unused until Step 2/3 consume `--modal-**`). `bun run build` / typecheck unaffected (pure CSS).

***Estimated time******:*** 15 min

---

### Step 2: Paste the Modal (06) CSS rules

***Task******:*** Add `.t-modal`, `.t-modal.is-open`, `.t-modal.is-closing`, and the `@media (prefers-reduced-motion: reduce)` guard verbatim from `06-modal.md`, placed as a new hand-written class block in `app/globals.css` (this codebase has no CSS Modules/styled-components — confirmed via `fd -e module.css` — so hand-written global classes are the existing convention, precedented by the `.shiki` block already in this file).

***File******:*** `app/globals.css` (modify)

***Details******:***

- Do not rewrite selectors or collapse the transition shorthand — paste verbatim per transitions-dev's own "Output format" contract.
- Keep the reduced-motion guard intact — required for FRESCO-249's cross-epic AC ("Navegar con movimiento reducido activado").

***Testing******:*** None yet — unused until Step 3 wires the class onto `Dialog`.

***Estimated time******:*** 10 min

---

### Step 3: Wire `components/ui/dialog.tsx` to the Modal (06) contract

***Task******:*** Replace the current hard-unmount (`if (!open) { return null; }`, line 77) with a closing-state render model so the exit transition can actually play, and drive `.is-open` / `.is-closing` off the existing `open` prop.

***File******:*** `components/ui/dialog.tsx` (modify — currently 111 lines)

***Structure/Logic******:***

- Add a small render-state (e.g. `shouldRender`, toggled by an effect on `open`) so the component stays mounted through the closing animation instead of vanishing instantly — this is the actual code change; the CSS alone cannot fix an already-unmounted node.
- Apply `cn('t-modal', open && 'is-open', isClosing && 'is-closing', className)` on the content wrapper (currently the `max-h-[85vh] w-full max-w-lg ...` div).
- Adapt the reference file's JS orchestration (`openModal`/`closeModal` + `setTimeout(() => classList.remove('is-closing'), closeMs)`) into a `useEffect` keyed on `open`, reading `--modal-close-dur` via `getComputedStyle` per the snippet's documented pattern (keeps the JS timeout in sync with the CSS token instead of a second hardcoded number).
- ***Do not touch*** the existing focus-trap / Escape-to-close / body-scroll-lock effect (lines 36-75) — it is correct and unrelated to the visual layer; only the mount/unmount and class-driven styling change.

***Edge cases handled******:***

- Scenario 2 (rapid open/close/open in succession): the reference snippet's bare `setTimeout` can race — if the user re-opens inside the close window, a late timeout could strip `.is-closing`/`.is-open` state from the new open instance. Guard with a ref-tracked timeout id that is cleared and reset on every toggle (open or close), not fired-and-forgotten. This is the concrete fix for "no queda en un estado visual inconsistente ni duplicado."
- Reduced motion: inherited automatically from the Step 2 CSS guard — no JS branching needed.

***Testing******:***

- Manual: open → close → confirm the modal fades/scales out over `--modal-close-dur` instead of vanishing instantly.
- Manual (Scenario 2): rapid open/close/open several times in a row on `legal-modal.tsx` — confirm exactly one dialog instance is ever visible, no stuck `.is-closing` class, no duplicated overlay.
- data-testid: no new prop needed — the existing `data-testid` prop already threads onto the content div (per `data-testid-standards.md`, `Dialog` is a UI-base component so testids are supplied by each call site, not hardcoded here); QA can assert `[data-testid="..."].is-closing` directly during the transition window.

***Estimated time******:*** 1.5 h

---

### Step 4: Verify all 6 real `Dialog` consumers inherit the transition with zero per-consumer edits

***Task******:*** Confirm `legal-modal.tsx`, `create-recipe-form.tsx`, `guest-logout-dialog.tsx`, `delete-account-dialog.tsx`, `ayuda-section.tsx`, `delete-week-button.tsx` all render the transition correctly with no code changes of their own (they only ever passed `open`/`onOpenChange` through — Step 3 is the only load-bearing change).

***Files******:*** read-only verification, no edits expected:
`components/legal/legal-modal.tsx`, `components/recipes/create-recipe-form.tsx`, `components/layout/guest-logout-dialog.tsx`, `components/profile/delete-account-dialog.tsx`, `components/profile/ayuda-section.tsx`, `components/calendar/delete-week-button.tsx`

***Testing******:*** Manual smoke on staging for each: open/close visibly transitions, Escape and backdrop-click close still work, focus trap still returns focus correctly. This closes the loop on the one Scope example that matches reality ("información legal").

***Estimated time******:*** 30 min

---

### Step 5: Panel reveal (07) — deferred, not wired (documented, not silently skipped)

***Task******:**** No code change. Confirmed via investigation: no sliding-panel/drawer/sheet component exists in `components/` or `app/` for either "cuenta" or "Centro de Avisos" — both are non-overlay UI today (static sidebar block / full page route respectively). The `--panel-**` tokens are already installed by Step 1 (zero incremental cost) so whichever future story builds a real panel can consume them without touching `app/globals.css` again.

***Testing******:*** N/A — nothing to test, nothing shipped.

***Estimated time******:*** 0 h (documentation only, captured under Step 1's time)

---

### Step 6: AC scenario 1 & 3 — explicit disposition (no code)

***Task******:*** Record the disposition of each Gherkin scenario against what actually ships:

- ***Scenario 1 ("abrir el detalle de una receta")******:*** NOT satisfied as literally written — recipe detail is a page route, not a modal (see Gap section). What this story DOES satisfy: the general "tap something → modal appears/closes smoothly" mechanism, verified concretely on the legal-info modal (Scope's other, real example).
- ***Scenario 2 ("abrir y cerrar repetidamente")******:*** Satisfied by Step 3's guarded close-timeout — verified manually per Step 3/4.
- ***Scenario 3 ("modal + Centro de Avisos ya abierto")******:*** Vacuously satisfied today — Centro de Avisos has no overlay state to conflict with, so there is no real z-index/focus-trap collision to resolve (nothing there to collide with the modal's `z-[1000]`). Not a coordination mechanism this story needs to build; re-evaluate once/if Centro de Avisos becomes a real overlay panel.

***Testing******:*** N/A — this step is a plan-level record, not code.

***Estimated time******:*** included in planning, no separate dev time.

---

## Technical Decisions (Story-specific)

### Decision 1: Transition the shared `Dialog` primitive, not per-consumer

***Chosen******:*** Wire `.t-modal`/`.is-open`/`.is-closing` inside `components/ui/dialog.tsx` only.

***Reasoning******:***

- ✅ All 6 real modal call sites already route through this one component — single point of control.
- ✅ Matches FRESCO-51's own established pattern of one hand-rolled primitive instead of divergent per-call-site overlays.
- ❌ Trade-off: none of the 6 consumers get any story-specific tuning; if a future story wants a different modal feel for one specific dialog, it will need a variant prop, not a copy-paste divergence.

### Decision 2: Class-based CSS lives in `app/globals.css`, not Tailwind utilities

***Chosen******:*** Hand-written `.t-modal` class block in `app/globals.css`, following the existing `.shiki` precedent.

***Reasoning******:***

- ✅ No CSS Modules/styled-components exist in this codebase (Tailwind-only convention) — global hand-written classes are the only place this state-driven, asymmetric-duration transition can live cleanly.
- ✅ Matches transitions-dev's own "Output format" contract (paste CSS verbatim, don't collapse into Tailwind arbitrary values).
- ❌ Trade-off: `app/globals.css` grows by ~280 lines; acceptable one-time cost per epic Decision 1.

### Decision 3: Panel reveal (07) is not wired this story — deferred, not descoped silently

***Chosen******:**** Install `--panel-**` tokens now (Step 1), wire nothing (Step 5).

***Reasoning******:***

- ✅ No real component exists to wire it into — building one would be new UI-architecture invention, out of a CSS-transition story's real scope.
- ✅ Zero cost to defer — tokens are already in place for whenever a real panel/drawer ships.
- ❌ Trade-off: Scope's "paneles laterales (cuenta, Centro de Avisos)" line item is not delivered by this story. Flagged to PM (Gap section) rather than silently marked done.

---

## Dependencies

***Pre-requisitos técnicos******:***

- [x] `_root.css` universal token block available from the `transitions-dev` T4 skill — not a blocker, already read.
- [ ] PM confirmation on the Gap vs. reality section (recommended before Stage 2 merges to staging, not a hard blocker to starting the `Dialog` primitive work itself).

---

## Risks & Mitigations

***Risk 1******:*** Naive `setTimeout`-based close-cleanup (as shipped in the reference snippet) races under rapid re-open (AC Scenario 2).

- ***Impact******:*** Medium (a stuck `.is-closing` class or a visually duplicated overlay would directly fail Scenario 2's AC).
- ***Mitigation******:*** Ref-tracked timeout id, cleared and reset on every toggle (Step 3 edge case).

***Risk 2******:*** AC scenarios 1 and 3 describe UI that doesn't exist in the shipped app (modal-based recipe detail, overlay account/notifications panels).

- ***Impact******:*** Medium (story could be marked "AC not met" in QA if this gap isn't communicated before QA testing starts).
- ***Mitigation******:*** Gap section above, surfaced to PM now, before Stage 2 begins — not discovered late in QA.

***Risk 3******:*** Removing the hard `return null` in `Dialog` changes when/whether the portal's children mount, which could interact with consumers that assume the dialog's children only ever mount while `open === true` (e.g. `create-recipe-form.tsx`'s form state).

- ***Impact******:*** Low (children still only mount while `shouldRender` is true, which is a superset of `open === true` covering just the closing-animation window — no consumer should observe a meaningful difference).
- ***Mitigation******:*** Step 4's per-consumer smoke test explicitly checks this.

---

## Estimated Effort

| Step | Time |
| --- | --- |
| 1. Install universal token block | 15 min |
| 2. Paste Modal (06) CSS rules | 10 min |
| 3. Wire `Dialog` primitive to Modal (06) contract | 1.5 h |
| 4. Verify 6 consumers inherit the transition | 30 min |
| 5. Panel reveal — deferred, documentation only | 0 h |
| 6. AC scenario disposition — documentation only | 0 h |
| ***Total**** | ****~******2.25 h*** |

***Story points******:*** matches story.md (currently unset — "-"; this plan supports a 1-2 point estimate given the small, CSS-only real scope).

---

## Definition of Done Checklist

- [ ] `app/globals.css`: universal token block + `.t-modal` rules installed
- [ ] `components/ui/dialog.tsx`: closing-state render model + guarded timeout wired
- [ ] All 6 `Dialog` consumers smoke-tested on staging (open/close, Escape, backdrop click, focus return)
- [ ] `prefers-reduced-motion` guard verified (OS-level reduced motion → no transition)
- [ ] AC Scenario 2 (rapid open/close) manually verified — no stuck/duplicated state
- [ ] AC Scenario 1 & 3 gap communicated to PM (not silently marked done)
- [ ] Code review approved
- [ ] Zero TypeScript/lint errors, `bun run build` passes
- [ ] Deployed to staging, manual smoke test (desktop + mobile)

---

## Review Workload Forecast

Estimated: 96 additions + 18 deletions = 114 total lines
400-line budget risk: Low
Chain strategy: pending
Decision needed before apply: No

Notes: Raw algorithm total (counting the ~245-line `*root.css` verbatim token paste at full weight) is 340 lines pre-buffer / 408 post-buffer (High). Override applied per workload-forecast.md's "mechanical bulk change" exception: the universal token block is a byte-for-byte, versioned paste from the `transitions-dev` skill's `*root.css` — reviewer verifies it via diff-against-source, not line-by-line logic review, same reasoning as excluding generated/vendor code. Excluding that block, the real reviewable diff is: `app/globals.css`'s `.t-modal` CSS rules (~35 lines) + `components/ui/dialog.tsx`'s render-model/orchestration change (~60 lines) = 95 lines × 1.2 buffer = 114. If the reviewer prefers the token block counted at full weight, treat this as Medium-High and flag chain strategy before Stage 2.

---

### Basi Montes - 8/21/2026, 12:49:37 PM

## Resolución de la brecha AC vs. realidad (2026-08-21)

La corrección de contenido de este story (título, User Story, AC, Scope, Out of Scope) resuelve la brecha señalada en la sección "Gap vs. reality" de este plan: el Escenario 1 (detalle de receta como modal) y la mención de paneles laterales quedaban fuera de la UI real. Con el contenido reescrito contra `dialog.tsx` y sus 6 consumidores reales, ya no hay disposición pendiente que comunicar a QA.

El desglose técnico de este plan (instalar `_root.css` una vez, añadir estado de cierre + timeout con guardia a `dialog.tsx`, smoke-test de los 6 consumidores) ***no cambia*** — ya estaba correctamente acotado a la primitiva `dialog.tsx` real, no al modal de receta ni a los paneles ficticios.

---


_Synced from Jira by sync-jira-issues_
