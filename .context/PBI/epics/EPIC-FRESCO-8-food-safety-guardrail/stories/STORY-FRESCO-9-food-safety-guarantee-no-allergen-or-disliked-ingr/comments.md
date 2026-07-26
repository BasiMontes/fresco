# Comments for FRESCO-9

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-9)

---

### Basi Montes - 7/26/2026, 6:02:23 PM

## Criterios de Aceptación

```gherkin
Scenario: Laura tiene un alérgeno alimentario declarado
  Given Laura declaró un alérgeno alimentario durante el onboarding
  When se genera cualquier menú semanal para ella, esta semana o cualquier semana futura
  Then cero recetas de ese menú contienen el alérgeno declarado

Scenario: Laura tiene un ingrediente que no le gusta
  Given Laura declaró un ingrediente que no le gusta durante el onboarding
  When se genera su menú semanal
  Then cero recetas de ese menú contienen ese ingrediente

Scenario: Se declaran varias restricciones a la vez
  Given Laura declaró dos alérgenos alimentarios y un ingrediente que no le gusta
  When se genera su menú semanal
  Then las tres restricciones se respetan simultáneamente, sin que ninguna se omita o se priorice menos

Scenario: No existe ninguna receta segura para un espacio de comida
  Given ninguna receta del catálogo puede satisfacer todas las restricciones declaradas de Laura para un espacio de comida concreto
  When se genera su menú semanal
  Then ve una advertencia clara y visible sobre ese espacio concreto
  And el menú nunca se le entrega como si fuera totalmente seguro
```

---

### Basi Montes - 7/26/2026, 6:02:24 PM

## Alcance

- Excluir toda receta que contenga un alérgeno declarado de todo menú generado, para toda usuaria, toda semana, sin excepciones
- Excluir toda receta que contenga un ingrediente no deseado de todo menú generado, para toda usuaria, toda semana
- Respetar varias restricciones simultáneas sin omitir ninguna
- Mostrar una advertencia clara y visible siempre que un espacio de comida no pueda respetar estas restricciones — nunca entregar un menú en silencio como si fuera seguro cuando no lo es

---

### Basi Montes - 7/26/2026, 6:02:25 PM

## Fuera de Alcance

- El resto del flujo de generación de menú semanal (propiedad de la historia de Generación de Menú, que depende de esta garantía)
- La revisión manual de seguridad del fundador durante la validación concierge (proceso operativo/de negocio, no una capacidad de producto)

---

### Basi Montes - 7/26/2026, 6:02:26 PM

## Especificación de Reglas de Negocio

- La exclusión de alérgenos e ingredientes no deseados aplica a toda usuaria, todo plan, toda semana — sin excepciones, nunca
- Esta garantía nunca debe debilitarse o eludirse en silencio por un cambio no relacionado en otra parte del producto
- Cuando se declaran varias restricciones, todas se respetan simultáneamente — ninguna puede omitirse a favor de otra

---

### Basi Montes - 7/26/2026, 6:27:54 PM

## Spec Implementation Plan (Dev)

# Implementation Plan: STORY-FRESCO-9 - Food Safety | Guarantee no allergen or disliked ingredient ever appears in a menu

## Overview

This story's Definition of Done ("zero allergen/disliked-ingredient violations, ever, for any user, any week — any exception produces a visible warning, never a silent menu") is ***already largely implemented*** at the database layer. This plan identifies the two genuine remaining gaps and scopes only those; it does not re-implement existing, already-migrated exclusion logic.

***Acceptance Criteria to satisfy*** (from Jira comments, Spanish original):

- Scenario 1: single declared allergen never appears in any generated menu
- Scenario 2: single disliked ingredient never appears in any generated menu
- Scenario 3: multiple simultaneous restrictions all respected, none dropped
- Scenario 4: when no safe recipe exists for a slot, a clear/visible warning is shown — menu never delivered as silently safe

---

## Coverage Assessment (per AC scenario)

| # | Scenario | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Single allergen excluded | ***Covered**** | `get*filtered*recipes(p*user*id)` — `supabase/migrations/20260725120100*create*fresco*core*tables.sql:274-295`, corrected in `20260726000000*fix*get*filtered*recipes*keto*halal.sql`. Clause: `not (coalesce(r.alergenos, '[]'::jsonb) ? | v_profile.alergenos)`. This is FR-8.1 ****Layer 1 (structural)***. |
| 2 | Single disliked ingredient excluded | ***Covered*** | Same function, clause: `not (coalesce(r.ingredientes*principales, '[]'::jsonb) ? | v*profile.ingredientes_odiados)`. |
| 3 | Multiple restrictions simultaneously, none dropped | ***Covered*** | Both clauses above are ANDed in the same `WHERE`, plus the diet clauses (vegetarian/vegan/keto/halal/etc.) — SQL `AND` has no priority ordering, so no restriction can structurally be traded off against another. |
| 4 | Clear, visible warning when no safe recipe exists for a slot | ***Gap (2 parts)*** | See below. |

### Gap A — FR-8.1 Layer 2 (semantic) is not implemented

`supabase/functions/generate-meal-plan/prompt.ts` — `buildSystemPrompt()` and `buildUserPrompt()` are literal `throw new Error(...)` stubs (lines 37-41, 59-71). The file's own header comment documents the exact required rule text (REGLAS ABSOLUTAS 1-2 = allergen + disliked-ingredient hard exclusion, verbatim from FR-2.3/FR-2.4) but none of it is written yet.

Consequence: FR-8.1 explicitly requires ***two independent layers, "neither trusted as sufficient on its own"**** (`functional-requirements.md` FR-8.1, `architecture.md` §5, ADR-0001). Layer 1 alone already satisfies scenarios 1-3 today, but the two-layer **contract* this story's own source spec (FR-8.1) mandates does not exist — Layer 2 is completely absent, not degraded.

Also: the same missing system prompt is where the model would be instructed to populate `advertencias` when no recipe satisfies a slot's constraints (FR-8.2's trigger condition) — so scenario 4 cannot fire from real generation at all yet, independent of the frontend gap below.

### Gap B — FR-8.2 frontend warning surface does not exist

Backend plumbing for `advertencias` is already wired end-to-end and never silently drops it:

- `validator.ts` (lines 97-102) folds validator-detected issues into `warnings`.
- `index.ts` (lines 150-152, 175, 217) propagates `warnings` into the response's `advertencias` array — "never dropped" per its own FR-2.10/FR-8.2 comment.
- `lib/api/types.ts` documents the contract: `advertencias: string[] // MUST be surfaced to the user when non-empty (FR-2.10 / FR-8.2)`.

But grepping the entire `app/` and `components/` tree for `advertencias` returns ***zero matches***. `app/(app)/menu/page.tsx` renders `buildMockWeeklyMenu()` (mock data only, no real API call — explicitly noted in that file's own comment as future `/sprint-development` work) and there is no Alert/Banner/Warning component anywhere in `components/ui/`. FR-8.2's "prominent, blocking-style warning" has no surface to render into.

***Sequencing note****: wiring `/menu` to the **real** generate-meal-plan response is explicitly Out-of-Scope for FRESCO-9 (its own Jira Scope field: "El resto del flujo de generación de menú semanal... propiedad de la historia de Generación de Menú"). `dev-roadmap.md` confirms the direction — FRESCO-9 ****blocks**** FRESCO-7 specifically because "Menu Generation's story deliberately does NOT re-implement allergen/disliked-ingredient exclusion — it depends entirely on Food Safety's guarantee." So FRESCO-9 owns the guarantee + its visible warning surface; FRESCO-7 owns wiring real data into the page. This plan scopes a ****component + contract***, not the real fetch.

---

## Technical Approach

***Chosen approach******:*** Close both gaps with the smallest change that makes FR-8.1/FR-8.2 real and testable, without touching anything FRESCO-7 owns.

1. Complete `prompt.ts`'s two TODO stubs in full (all 5 REGLAS ABSOLUTAS + quality rules), not just the two safety-specific rules.
2. Add a small, reusable warning-surface component using the existing `warning` design token (`#DF8C26`, `DESIGN.md:15`), wired behind the current mock-data path via a plain `advertencias?: string[]` prop — a contract FRESCO-7 can feed real data into later without touching the component again.

***Alternatives considered******:***

- **Implement only REGLAS ABSOLUTAS 1-2 in **`prompt.ts`**, leave rules 3-5 (history/budget/JSON-shape) throwing for FRESCO-7 to finish.** Rejected: `buildUserPrompt` has to serialize the recipe/profile/history payload regardless of which rules are "in scope" — a half-implementation leaves the Edge Function still fully broken for everyone (FRESCO-7 is already blocked on FRESCO-9 for this exact reason), and gives this story no working path to actually prove scenario 4 end-to-end. The full rule set is already completely specified in the file's own header comment (`FR-2.3`-`FR-2.8`) — completing it is not scope creep, it's finishing an already-fully-specified TODO.
- **Wire the new warning component into a real **`/menu`** fetch now.** Rejected: that requires building the real generate-meal-plan call from the frontend, which is explicitly FRESCO-9's own Out-of-Scope boundary and FRESCO-7's job per the dependency graph.

***Why this approach******:***

- ✅ Closes the only two real gaps against the actual AC scenarios, cites the exact existing DB/backend code that already covers the rest — no duplicated or diverging exclusion logic.
- ✅ Unblocks FRESCO-7 cleanly (the hard dependency is satisfied, not half-satisfied).
- ❌ Trade-off: implementing the **complete** prompt.ts touches a few lines beyond the pure "food safety" rules (budget/history text) — flagged as a Technical Decision below for confirmation before Stage 2, since it's a story-scope-boundary call, not a unilateral one.

---

## Technical Decisions (Story-specific)

### Decision 1: Scope boundary for completing `prompt.ts`

***Chosen (proposed)******:*** Implement the complete `buildSystemPrompt()` / `buildUserPrompt()` (all REGLAS ABSOLUTAS + quality rules), not just the allergen/disliked-ingredient-specific ones.

***Reasoning******:***

- ✅ The rule text is already fully specified in the file's own comments (`FR-2.3`-`FR-2.8`) — no new domain decision required, purely mechanical transcription.
- ✅ Unblocks FRESCO-7 outright instead of leaving a second, awkward TODO seam inside the same function.
- ❌ Trade-off: a few lines of the change (budget/history phrasing) are not, strictly, "food safety" — flagged here rather than decided silently, per this story's own scope boundary. ***Needs explicit confirmation before Stage 2 starts.***

This is a story-local scope call, not an architectural/hard-to-reverse decision — no ADR promotion needed. The existing two-layer defense-in-depth architecture itself is already covered by ADR-0001 (referenced directly from `architecture.md` §5 and FR-8.1) — this story implements what that ADR already mandates, it does not introduce a new architectural decision.

---

## Implementation Steps

### Step 1: Implement `buildSystemPrompt()` and `buildUserPrompt()` (Gap A)

***File******:*** `supabase/functions/generate-meal-plan/prompt.ts`

***Task******:*** Replace both `throw new Error(...)` stubs with the literal rule text already specified in the file's header comment (REGLAS ABSOLUTAS 1-5 + REGLAS DE CALIDAD + PRO-ONLY ADDENDUM), and serialize `profile` + filtered `recipes` + `recentRecipeIds` (gated by `isPro`, per ADR-0001's Free/Pro invariant) into the user prompt.

***Edge cases handled******:***

- Free tier: `recentRecipeIds` must never be serialized into the prompt even if passed non-empty (ADR-0001 invariant) — gate strictly on `isPro`.
- Empty filtered `recipes` for a slot: system prompt must instruct the model to populate `advertencias` rather than fabricate an unsafe substitute (FR-8.2 trigger).

***Testing******:*** Unit test asserting the returned system-prompt string contains the exact allergen/disliked-ingredient hard-rule phrasing (not a behavior test against the live Gemini API — that stays out of scope per this skill's "no test automation beyond unit" rule). Unit test on `buildUserPrompt` asserting `recentRecipeIds` never appears in output when `isPro=false`.

***Estimated time******:*** 3h

---

### Step 2: Warning-surface component (Gap B)

***File******:*** `components/ui/alert-banner.tsx` (new)

***Task******:*** Small, reusable component rendering a list of warning strings prominently, using the `warning` token (`#DF8C26`) already defined in `DESIGN.md`. Props: `{ messages: string[] }`. No new design-system precedent exists for this (`components/ui/` has no Alert/Banner today) — built minimal, consistent with existing `Card`/`Tag` visual language (borders/shadows per `DESIGN.md`'s chosen personality).

***Wiring******:*** `app/(app)/menu/page.tsx` renders it conditionally when a (currently mock, future-real) `advertencias` array is non-empty — plain prop-drilling from the page's existing mock data function, no new fetch logic. This gives FRESCO-7 a ready-made contract instead of a design decision it would otherwise have to make mid-story.

***Testing******:*** Component renders nothing when `messages` is empty; renders all messages prominently when non-empty (visual: warning-colored, not a toast/dismissible — FR-8.2 explicitly calls for "blocking-style", not silent).

***Estimated time******:*** 2h

### Step 3: Integration + verification

***Task******:*** Wire Step 1's output into `index.ts` (no changes expected — it already calls `buildSystemPrompt`/`buildUserPrompt` correctly at lines 116-117 and already propagates `advertencias` at lines 150-152/175/217) and Step 2's component into the mock `/menu` page.

***Testing******:*** Full unit suite (prompt + component) green; lint/typecheck clean; manual smoke against `bun run dev` confirming the banner renders when `buildMockWeeklyMenu()` is temporarily given a non-empty `advertencias` fixture.

***Estimated time******:*** 1h

---

## Dependencies

***Pre-requisites******:***

- [x] `get*filtered*recipes()` migrated and correct (already done — no action)
- [x] `validator.ts`/`index.ts` advertencias plumbing (already done — no action)
- [ ] Decision 1 above confirmed before Stage 2 starts

---

## Risks & Mitigations

***Risk 1******:*** Completing the full `prompt.ts` (not just the safety rules) could be read as scope creep into FRESCO-7's territory.

- ***Impact******:*** Low — the rule text is fully pre-specified, and FRESCO-7 is already structurally blocked on this exact file per the dependency graph.
- ***Mitigation******:*** Flagged explicitly as Decision 1, requires confirmation before Stage 2.

***Risk 2******:*** No existing Alert/Banner precedent in the design system — new component may need a second pass once a real screen mockup exists.

- ***Impact******:*** Low — no `master-design-plan.md` exists yet for this project, so per Rule 14 this story degrades gracefully to `DESIGN.md`-token-only fidelity; no mockup gate applies.
- ***Mitigation******:*** Keep the component minimal and token-driven; revisit only if a future mockup contradicts it.

---

## Estimated Effort

| Step | Time |
| --- | --- |
| 1. Implement buildSystemPrompt/buildUserPrompt | 3h |
| 2. Warning-surface component | 2h |
| 3. Integration + verification | 1h |
| ***Total**** | ****6h*** |

***Story points******:*** N/A (unset in `story.md`)

---

## Definition of Done Checklist

- [ ] `buildSystemPrompt()`/`buildUserPrompt()` implemented per Step 1, no `throw` stubs remain
- [ ] Free/Pro history invariant (ADR-0001) covered by a unit test
- [ ] Warning-surface component renders per Step 2, token-consistent with `DESIGN.md`
- [ ] Zero regressions to `get*filtered*recipes()` (untouched — verified by existing migration, no new migration needed)
- [ ] Lint + typecheck + unit tests green
- [ ] Code review approved
- [ ] Deployed to staging; manual smoke test of the banner against a mock `advertencias` fixture

---

## Review Workload Forecast

Estimated: 178 additions + 38 deletions = 216 total lines
400-line budget risk: Medium
Chain strategy: stacked-to-main
Decision needed before apply: No

Notes: two natural slices if chained — (1) `prompt.ts` completion + unit tests (backend, Gap A), (2) `alert-banner.tsx` + minimal `/menu` wiring (frontend, Gap B). Not required at Medium risk; either one PR or two is acceptable.

---


_Synced from Jira by sync-jira-issues_
