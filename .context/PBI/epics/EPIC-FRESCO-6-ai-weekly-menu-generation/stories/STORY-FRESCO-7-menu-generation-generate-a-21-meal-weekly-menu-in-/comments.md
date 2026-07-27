# Comments for FRESCO-7

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-7)

---

### Basi Montes - 7/26/2026, 6:01:31 PM

## Criterios de Aceptación

```gherkin
Scenario: Laura pide su menú semanal con el perfil completo
  Given Laura ha completado el onboarding
  When pide su menú semanal
  Then recibe 21 comidas cubriendo desayuno, comida y cena para los 7 días
  And toda la petición se completa en menos de 30 segundos

Scenario: El menú generado respeta el presupuesto semanal de Laura
  Given Laura declaró un presupuesto semanal de compra durante el onboarding
  When se genera su menú semanal
  Then el coste total estimado de las comidas de la semana se mantiene dentro de ese presupuesto

Scenario: Ninguna receta de comida o cena se repite en la misma semana
  Given se ha generado un menú semanal para Laura
  Then ninguna receta de comida o cena aparece más de una vez a lo largo de los 7 días
  And una receta de desayuno puede repetirse hasta tres veces

Scenario: La generación no puede producir un menú válido
  Given el perfil de Laura es tan restrictivo que no se puede montar un menú válido de 21 comidas
  When pide su menú semanal
  Then ve un mensaje claro explicando que el menú no pudo completarse
  And nunca ve un menú parcial o roto presentado como si estuviera completo

Scenario: La generación tuvo que hacer un compromiso para construir el menú
  Given construir el menú semanal de Laura requirió un compromiso (por ejemplo, una selección menos variada de lo habitual)
  When se genera su menú
  Then ve una explicación clara y específica de qué se ajustó y por qué
```

---

### Basi Montes - 7/26/2026, 6:01:32 PM

## Alcance

- Generar las 21 comidas (7 días × desayuno, comida, cena) en una sola petición
- Completar la generación en menos de 30 segundos
- Mantener el coste total estimado de la semana dentro del presupuesto semanal declarado por el hogar
- Nunca repetir una receta de comida o cena en la misma semana (el desayuno puede repetirse hasta 3 veces)
- Nunca presentar un menú parcial o roto como si estuviera completo — mostrar un mensaje claro en su lugar
- Mostrar una explicación clara y específica siempre que se necesite un compromiso para construir el menú

---

### Basi Montes - 7/26/2026, 6:01:33 PM

## Fuera de Alcance

- Excluir recetas que contengan un alérgeno declarado o un ingrediente que no le gusta — propiedad exclusiva de la historia de Seguridad Alimentaria (esta historia depende de esa garantía, no la reimplementa)
- Evitar recetas usadas en las últimas dos semanas — capacidad exclusiva de Pro que necesita el toggle de aprendizaje cocinado/descartado (épico separado, todavía no en este backlog); la generación de esta historia siempre parte de cero
- Reorganizar o editar el menú generado después de creado (épico de Calendario Editable)
- Construir la lista de la compra a partir del menú (épico de Lista de la Compra)

---

### Basi Montes - 7/26/2026, 6:01:34 PM

## Especificación de Reglas de Negocio

- Un menú semanal siempre tiene exactamente 21 espacios: 7 días × (desayuno, comida, cena)
- Las recetas de comida y cena no deben repetirse nunca en la misma semana; el desayuno puede repetirse hasta 3 veces
- Un menú está completo y es válido, o no se muestra en absoluto — no existe un estado parcialmente válido visible para la usuaria

---

### Basi Montes - 7/27/2026, 5:40:01 PM

## Spec Implementation Plan (Dev)

# Implementation Plan: STORY-FRESCO-7 - Menu Generation | Generate a 21-meal weekly menu in under 30 seconds

## Overview

The backend half of this story is already real, working code: `supabase/functions/generate-meal-plan/index.ts` (auth, profile load, duplicate-plan guard, SQL pre-filter, Free/Pro history branch per ADR-0001, bounded retry loop, persistence with rollback compensation, response enrichment) and `validator.ts` (JSON shape, `semana` match, all 21 slots, valid recipe ids, hard no-repeat on lunch/dinner, soft breakfast-repeat warning, advertencias merge) are both complete and are ***not*** re-implemented here. `prompt.ts` is likewise complete (REGLAS ABSOLUTAS 1-5 + REGLAS DE CALIDAD, done by STORY-FRESCO-9 at explicit user request per that file's own header comment, lines 8-17) and is consumed as-is, not touched.

What remains, scoped to this story:

1. A real, structural budget-compliance check in `validator.ts` (currently 100% prompt-trust — a genuine gap against AC Scenario 2).
2. A pre-existing bug at the only call site that produces `semana_iso` (`app/onboarding/page.tsx`), which blocks any correct "fetch this week's plan" read query.
3. Wiring `/menu` and `/calendar` to the real persisted plan instead of `buildMockWeeklyMenu()`, including a new read path, an empty state, and AC-4's failure state.
4. Wiring the already-built `AlertBanner` to the real `advertencias` array (AC Scenario 5).

***Acceptance Criteria to satisfy*** (from Jira comments, Spanish original):

- Scenario 1: 21 meals (7 days x breakfast/lunch/dinner) generated in one request, under 30 seconds.
- Scenario 2: total estimated weekly cost stays within the household's declared weekly budget.
- Scenario 3: no lunch/dinner recipe repeats in the same week; breakfast may repeat up to 3 times.
- Scenario 4: when no valid 21-meal menu can be built, the user sees a clear message — never a partial/broken menu presented as complete.
- Scenario 5: when generation required a compromise, the user sees a clear, specific explanation of what was adjusted and why.

---

## Coverage Assessment (per AC scenario)

| # | Scenario | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 21 meals, <30s | ***Covered (backend)**** / ****Gap (frontend)*** | `index.ts` generates+persists all 21 slots in one request; Gemini call uses `maxOutputTokens: 1024` and a single round-trip (bounded by `MAX_RETRIES=2`), so the 30s budget is a backend-latency concern already accounted for in that design, not something this story needs to re-engineer. Gap: nothing on the frontend reads the real persisted result yet — both `/menu` and `/calendar` render `buildMockWeeklyMenu()` unconditionally. |
| 2 | Stays within weekly budget | ***Gap (real)**** | `validator.ts` never sums `recipe.meta.coste*estimado` against `profile.presupuesto*semana*euros`. Confirmed by reading the full file: the only cost-adjacent logic is `serializeRecipe()` in `prompt.ts` printing the bucket to the model — enforcement is 100% prompt-trust (`REGLA ABSOLUTA 4` text only). Deeper finding: `recipe.meta.coste*estimado` is a ****4-bucket categorical enum**** (`muy_bajo|bajo|medio|alto`, `api/schemas/recipe.types.ts:23`), not a numeric euro value — there is no per-recipe price anywhere in the schema. A structural check can only ever be an **approximation* via a bucket-to-euro mapping; see Technical Decisions below. |
| 3 | No lunch/dinner repeat, breakfast <=3 | ***Covered*** | `validator.ts` hard-errors on any lunch/dinner id reuse (triggers retry) and soft-warns past 3 breakfast repeats. Already correct, not touched. |
| 4 | Clear message, never a partial menu | ***Covered (backend)**** / ****Gap (frontend)**** | `index.ts` never persists on validation failure; exhausted retries throw a 502 and nothing is written. Gap: `app/onboarding/page.tsx`'s `handleGenerate()` catch block (line 122-124) is a single bare `catch` with one generic message ("No pudimos guardar tu perfil o generar tu menú. Intenta de nuevo.") for **every* failure mode — profile-save failures, network errors, and the specific "no valid menu could be built" 502 are all indistinguishable to the user today. |
| 5 | Clear, specific compromise explanation | ***Gap (real)*** | `advertencias` is correctly populated and never dropped server-side (`validator.ts` -> `index.ts` -> response), but `AlertBanner` (built by FRESCO-9, its own header comment names FRESCO-7 as the consumer) is not imported anywhere under `app/` or `components/` outside its own file — confirmed by grep. Zero wiring exists. |

***Additional gap found, not in the original brief**** (verified by reading the actual call site): `app/onboarding/page.tsx:119` calls `generateMealPlan({ semana*iso: fechaInicio, fecha*inicio: fechaInicio }, null)` — `semana*iso`**** and ****`fecha*inicio`**** are passed the identical value***, a plain `YYYY-MM-DD` date string. The contract (`GenerateMealPlanRequest.semana*iso`, `api/schemas/api-contracts.types.ts:14`) requires `'YYYY-WXX'` ISO-8601 week format; there is no ISO-week utility anywhere in the repo (`rg` for `isoWeek`/`getWeek`/`WXX` returns nothing outside type comments). This is silently self-consistent today (the backend just stores whatever string it's given and the model is told to echo it back), but it means `meal*plans.semana*iso` never actually holds a real ISO week — which blocks this story's own read-path requirement ("fetch the current week's plan") from ever resolving "current week" correctly, and would also break `generate-shopping-list`'s existing `semana*iso` lookup (`supabase/functions/generate-shopping-list/index.ts:47`) the moment a real ISO week is expected there. Must be fixed as part of this story — it is the one call site this story's read path depends on.

***Second additional gap found****: `lib/api/edge-functions.ts` imports `GenerateMealPlanResponse`/`Recipe` from its own local `./types` (`lib/api/types.ts`), which is a ****hand-duplicated, stale copy*** of the canonical `api/schemas/api-contracts.types.ts` (that file's own header calls itself "Single source of truth shared between the Edge Functions... and the future frontend" — CLAUDE.md SS10 DRY rule: `api/schemas/` is the single source of truth for these facades). The two shapes have already diverged: `lib/api/types.ts`'s `Recipe` is flat (`tipo`, `categoria`, `cocina`, `coste_bucket` as scalar strings), while the real backend response (per `api-contracts.types.ts` -> `recipe.types.ts`, the confirmed-live DB shape) nests these under `clasificacion`/`meta`/`dieta` objects. Building the real `/menu`/`/calendar` wiring against `lib/api/types.ts` today would compile against a contract the live Edge Function does not actually return. Must be fixed before wiring real data.

---

## Technical Approach

***Chosen approach******:*** close the two real backend/shared gaps first (budget check, `semana_iso` bug, type-source fix), then build one small new read path, then wire both frontend pages to it with explicit loading/empty/error/warning states.

1. Add a pure `getIsoWeek(date: Date): string` helper (`lib/date/iso-week.ts`) and fix the one call site in `app/onboarding/page.tsx` to pass a real ISO week for `semana*iso`, distinct from `fecha*inicio`.
2. Add a structural budget check to `validator.ts`, using a bucket-to-euro midpoint mapping (see Technical Decisions) — soft-warn via `advertencias`, not a hard-fail/retry gate.
3. Fix `lib/api/edge-functions.ts` (and `lib/api/types.ts`, which other files still import `DiaSemana`/`TipoPlato` from) to source `GenerateMealPlanResponse`/`Recipe` from `@schemas` instead of the stale local duplicate.
4. Add `lib/api/meal-plan.ts`: a public, fail-fast read function mirroring the `lib/api/user-profile.ts` pattern (Supabase client passed in, no hidden client construction) that joins `meal*plans` + `meal*plan*recipes` + `recipes` for a given `semana*iso` and returns `undefined` (not a thrown error) when no plan exists yet for that week — the empty state is a normal, expected outcome, not a failure.
5. Wire `/menu` and `/calendar` to that read function, add a shared `EmptyState` primitive (none exists in `components/ui/` today — confirmed by directory listing) for "no plan generated yet," and wire `AlertBanner` to the fetched `advertencias`.
6. Differentiate `app/onboarding/page.tsx`'s catch block: the 502 from `generateMealPlan()` (an `EdgeFunctionError` with `status === 502`, per `lib/api/edge-functions.ts`'s existing `EdgeFunctionError` class) gets AC-4-specific copy; everything else keeps the existing generic message.

***Alternatives considered******:***

- ***Leave budget compliance as prompt-trust only (no validator change).**** Rejected: this is the literal gap named in the story brief and directly against AC Scenario 2's wording; leaving it unenforced means the "hard rule" text in `prompt.ts` is the **only* thing standing between output and the user, identical to how lunch/dinner-repeat used to be model-only before `validator.ts` added structural enforcement for that rule.
- ***Add a real numeric ****`precio*estimado*euros`**** column to ****`recipes`**** and migrate all ******~******35 seeded rows.*** Rejected for this story: a schema migration + data backfill is out of proportion to a single validation check, is not owned by this story's scope (schema changes belong to `/project-bootstrap`/a dedicated migration story), and the bucket-to-midpoint approximation is sufficient to catch the failure mode AC Scenario 2 actually cares about (a menu wildly over budget), without introducing a migration dependency into this story's critical path.
- ***Fetch the current week's plan client-side via a generic ****`supabase.from(...)`**** call inline in the page component.*** Rejected: violates this repo's own established pattern (`lib/api/user-profile.ts` — public function, fail-fast, client passed in, from FRESCO-5) and would duplicate the join logic across `/menu` and `/calendar` instead of sharing one `lib/api/meal-plan.ts` function.

***Why this approach******:***

- Closes both real gaps (budget, `semana_iso`) at their root cause instead of layering a frontend workaround on top of broken upstream data.
- Reuses 100% of the already-complete backend generation/validation/persistence pipeline — no changes to `prompt.ts`, no re-implementation of the Free/Pro history branch or the SQL pre-filter.
- Mirrors an established, reviewed pattern (`lib/api/user-profile.ts`) for the one genuinely new piece (the read function), instead of inventing a new fetching convention.
- Trade-off: the budget check is an approximation (bucket midpoint, not a real price), which is disclosed explicitly rather than presented as precise — see Technical Decisions.

---

## Types & Type Safety

- `lib/api/edge-functions.ts`: change the `import type { ... } from './types'` to `import type { ... } from '@schemas'` (or the specific `api-contracts.types` facade) for `GenerateMealPlanRequest`/`GenerateMealPlanResponse`. Verify the `@schemas` alias resolves the same way `lib/api/user-profile.ts` already does (`import type { UserProfile } from '@schemas'`) before assuming the alias exists for this facade too.
- `lib/api/types.ts`: keep `DiaSemana`/`TipoPlato` (still used by `lib/mock/recipes.ts` and both page components) but re-export `Recipe`/`GenerateMealPlanResponse` from `@schemas` instead of hand-duplicating them, so the two can never diverge again.
- `lib/api/meal-plan.ts`: new types for the read function's return shape — reuse `MealPlan`/`MealPlanRecipe` from `api/schemas/meal-plan.types.ts` and `Recipe` from `api/schemas/recipe.types.ts` (the real, nested DB shape) for the joined/enriched result, not the stale flat shape.
- No changes to `api/schemas/**` themselves — they are already the correct source of truth; only their **consumers* are wrong.

---

## UI/UX Design

No per-screen mockup exists for this story (`.context/design/master-design-plan.md` does not exist yet, per `dev-roadmap.md` SS5) — this is DESIGN.md-only fidelity, and per the LIVE-UI-FIRST rule the current live `/menu` and `/calendar` components are the source of truth to extend, not redesigned.

***States to add*** (both pages currently only render a single "happy path" state):

- ***Loading***: brief skeleton/placeholder while the read query resolves. Reuse existing `Card`/skeleton conventions if any exist in `components/ui/`; if none do, a minimal pulse-opacity placeholder is enough — do not build a new skeleton system for this story.
- ***Empty (no plan yet)***: distinct from an error — a household that hasn't generated a menu for the requested week yet is a normal state (e.g., first-ever visit, or a future week not yet requested). New shared `components/ui/empty-state.tsx` (icon + message + optional CTA), used by both `/menu` and `/calendar`.
- ***Error (AC-4 style, on ****`/menu`****/****`/calendar`**** themselves)****: only relevant if a **read** fails (network/auth) — distinct from the **generation*-failure copy, which lives in `app/onboarding/page.tsx` per Step 7 below, since that is the only place `generateMealPlan()` is actually called today.
- ***Success + warning (AC-5)***: existing happy-path layout, with `AlertBanner` rendered above the meal grid when `advertencias.length > 0`. Non-dismissible, always-visible, per that component's own doc comment — no new interaction pattern to design.

---

## Implementation Steps

### Step 1: ISO-week utility + onboarding call-site fix

***Files******:*** `lib/date/iso-week.ts` (new), `lib/date/iso-week.test.ts` (new), `app/onboarding/page.tsx` (modify, ~2 lines).

***Task******:*** Add a pure `getIsoWeek(date: Date): string` returning `'YYYY-WXX'` per ISO-8601 week numbering (Monday-start weeks, week 1 = the week containing the year's first Thursday). Fix `handleGenerate()` (line 119) to call `generateMealPlan({ semana*iso: getIsoWeek(new Date()), fecha*inicio: fechaInicio }, null)` — do not touch anything else in that function (guest-mode auth TODO, profile upsert call, error handling stays as-is except Step 7).

***Testing******:*** Unit tests for `getIsoWeek` against known reference dates (year boundary edge cases: Dec 31 falling in week 1 of the next year, Jan 1 falling in week 52/53 of the previous year).

### Step 2: Structural budget check in `validator.ts`

***File******:*** `supabase/functions/generate-meal-plan/validator.ts` (modify).

***Task******:*** Add a `BUCKET*MIDPOINT*EUROS` constant mapping `CosteEstimado` -> an approximate per-recipe euro value (documented as an approximation, sourced from a reasonable Spanish grocery-cost estimate per bucket — e.g. `muy*bajo: 1.5, bajo: 3, medio: 5, alto: 8`; final numbers to be confirmed with the founder/product owner before merge, flagged as an open question below). Sum the 21 selected recipes' mapped values; if the sum exceeds `profile.presupuesto*semana_euros` (when non-null), push a warning (not an error) into `warnings` with the specific overage amount, e.g. `"El menú supera tu presupuesto semanal en aproximadamente X€"` — satisfies AC-5's "specific" requirement, not a generic notice.

***Testing******:*** Unit test asserting a menu built entirely from `alto`-bucket recipes against a low `presupuesto*semana*euros` produces the expected warning string; asserting a within-budget menu produces no such warning; asserting `presupuesto*semana*euros: null` never triggers the check.

### Step 3: Fix the stale type source

***Files******:*** `lib/api/edge-functions.ts` (modify), `lib/api/types.ts` (modify).

***Task******:*** Repoint `GenerateMealPlanRequest`/`GenerateMealPlanResponse` imports to `@schemas`; re-export `Recipe`/`GenerateMealPlanResponse` from `lib/api/types.ts` instead of redeclaring them, keeping `DiaSemana`/`TipoPlato` as local (still consumed by `lib/mock/recipes.ts`).

***Testing******:*** `bun run types:check` (per CLAUDE.md SS1 rule #6, read `package.json` for the exact script name — do not guess it) must pass with zero new errors; this is a compile-time-only change, no new runtime tests needed.

### Step 4: `lib/api/meal-plan.ts` read function

***Files******:*** `lib/api/meal-plan.ts` (new), `lib/api/meal-plan.test.ts` (new).

***Task******:**** Public function `getMealPlanForWeek(client: SupabaseClient<Database>, semanaIso: string): Promise<MenuSemanalPersistido | undefined>` mirroring `lib/api/user-profile.ts`'s shape (client passed in, fails fast on real errors, but returns `undefined` — not a throw — specifically for the "no row found" case, since that is an expected empty state per AC-4's "never a partial menu" contract read together with "no plan generated yet" being a **different*, non-error state). Joins `meal*plans` (`.eq('semana*iso', semanaIso)`) to `meal*plan*recipes` to `recipes`, reshaping into the `Record<DiaSemana, Record<TipoPlato, Recipe>>` + `advertencias` shape the pages already expect from `buildMockWeeklyMenu()`, so the page components' prop contracts do not need to change beyond swapping the data source.

***Testing******:*** Unit tests mocking the Supabase client: happy path (full 21 rows returned, correctly reshaped), no-plan-for-week case (returns `undefined`, no throw), and a genuine DB error case (throws, per fail-fast convention).

### Step 5: Wire `/menu`

***File******:*** `app/(app)/menu/page.tsx` (modify).

***Task******:**** Replace `buildMockWeeklyMenu()` with `getMealPlanForWeek()` for the current ISO week (via `getIsoWeek(new Date())` from Step 1). Add loading state, render `EmptyState` (Step 6 builds the shared component) when the result is `undefined`, render `AlertBanner advertencias={plan.advertencias}` above the existing 3-card grid when non-empty. ****Verify current Next.js data-fetching conventions via Context7 before choosing server-component-async-fetch vs. client-component-effect*** — per `AGENTS.md`'s explicit warning that this Next.js version has breaking changes from training-data assumptions; do not assume a pattern from memory.

### Step 6: Shared `EmptyState` + wire `/calendar`

***Files******:*** `components/ui/empty-state.tsx` (new), `app/(app)/calendar/page.tsx` (modify).

***Task******:*** Small reusable primitive (icon + message + optional CTA button), styled per DESIGN.md tokens (no per-screen mockup exists for this story, per UI/UX Design section above). Reuse it in both `/menu` and `/calendar`. Wire `/calendar` to the same `getMealPlanForWeek()` result, same loading/empty/warning states as `/menu`.

### Step 7: AC-4 error differentiation in `app/onboarding/page.tsx`

***File******:*** `app/onboarding/page.tsx` (modify, catch block only — lines 122-124).

***Task******:*** Change the bare `catch` to `catch (err)`, check `err instanceof EdgeFunctionError && err.status === 502` (the exact status `generate-meal-plan/index.ts` throws when retries are exhausted and no valid menu could be built), and show AC-4-specific copy for that case (e.g. "No pudimos montar un menú completo con tu perfil actual — prueba a ajustar tus restricciones.") distinct from the existing generic message, which stays as the fallback for every other failure mode (profile save, network, auth). Do not touch anything else in `handleGenerate()` beyond this and Step 1's one-line fix — the guest-mode auth TODO and the rest of the onboarding flow are explicitly out of scope.

### Step 8: Tests + verification pass

***Task******:*** Run `bun run test` (read `package.json` for exact script name), `bun run types:check`, `bun run lint` in that order per CLAUDE.md SS1 rule #6. Confirm no regression in existing `lib/api/user-profile.test.ts`, `lib/store/onboarding-store.test.ts` (Step 1/7 touch the same file `handleGenerate()` lives in).

---

## Technical Decisions (Story-specific)

### Decision 1: Budget overage is a soft warning, not a hard-fail/retry gate

***Chosen******:*** Compute the structural budget check in `validator.ts`, but push an overage into `warnings` (surfaced via `advertencias`, satisfying AC Scenario 5), never into `errors` (which would trigger a retry and, on exhaustion, a full 502 generation failure).

***Reasoning******:***

- The story's own Business Rules field names exactly two conditions as the menu's actual valid/invalid gate: "un menú semanal siempre tiene exactamente 21 espacios" and "las recetas de comida y cena no deben repetirse nunca." Budget is not named among them — it is a Scope bullet and an AC scenario, but not one of the two literal validity invariants.
- The bucket-to-euro mapping (Decision 2) is an approximation, not a real price. Hard-failing an entire generation — and risking AC Scenario 4's "no valid menu" outcome — on top of an approximate metric would make a real, structurally-complete, non-repeating 21-meal menu invisible to the user because of a number that isn't even precisely measured.
- AC Scenario 5 is explicitly designed for exactly this shape of situation ("la generación tuvo que hacer un compromiso... ve una explicación clara y específica de qué se ajustó y por qué") — a budget overage is a textbook compromise, not a hard rejection.
- Reserves the bounded `MAX_RETRIES=2` budget for genuine structural defects (missing slots, invalid ids, hard repeats) rather than spending retry attempts — and wall-clock time against the 30-second SLA in AC Scenario 1 — chasing an approximate cost target the model may not be able to hit exactly every time.

***ADR-gate verdict******:****** does NOT qualify for an ADR.*** Gate 1 (architectural/cross-cutting): fails — this changes one function's internal warn-vs-error classification, not a system-wide invariant every feature must uphold. Gate 2 (hard-to-reverse): fails — reversing it later (moving budget to a hard-fail/retry check) is a small, single-file, easily-testable code change with no data migration or cross-team coordination. Per the ADR anti-pattern list ("NEVER ADR a story-local trade-off... if it changes one file and is easy to undo, it stays in the implementation-plan.md"), this stays here.

### Decision 2: Bucket-to-euro midpoint mapping for the structural budget check

***Chosen******:*** A hardcoded `Record<CosteEstimado, number>` constant in `validator.ts`, approximating each of the 4 cost buckets (`muy_bajo`/`bajo`/`medio`/`alto`) to a representative per-recipe euro value, summed across the 21 selected recipes.

***Reasoning******:***

- The schema has no numeric per-recipe price anywhere (`recipe.meta.coste_estimado` is a 4-value categorical enum, confirmed by reading `api/schemas/recipe.types.ts`) — a precise sum is not possible without a schema migration, which is out of proportion to this story (see "Alternatives considered" above).
- A bucket midpoint is a standard, low-cost approximation technique that still catches the failure mode the AC actually cares about (a menu built almost entirely from `alto`-bucket recipes against a tight budget), while being explicit in the warning copy that this is an estimate, never presented as a precise total.
- ***Open question flagged for the founder/product owner, not silently resolved***: the exact euro values per bucket. This plan proposes placeholder values (`1.5/3/5/8`) as a starting point but they should be confirmed against real Spanish grocery pricing before merge — see "Risks & Mitigations" and the open question in the report below.

### Decision 3: `semana_iso` bug fix is scoped to the one call site, not a broader onboarding rewrite

***Chosen******:*** Fix only the `generateMealPlan(...)` call arguments in `handleGenerate()` (Step 1) plus the new `getIsoWeek()` utility. No other change to the onboarding flow, its store, or its validation logic.

***Reasoning******:*** This repo's CLAUDE.md explicitly scopes surgical changes ("touch only what required... don't refactor unbroken code") and the task briefing explicitly named `app/onboarding/page.tsx`'s core flow as out-of-scope beyond this exact fix. The bug is a two-argument mistake at one call site, not a structural problem with the onboarding flow itself.

---

## Dependencies

- ***Hard dependency, already satisfied***: STORY-FRESCO-9 (Food Safety) — `prompt.ts` and the two-layer allergen/disliked-ingredient guardrail. Confirmed complete; not re-verified beyond reading the file headers.
- ***Hard dependency, already satisfied***: STORY-FRESCO-5 (Onboarding) — `user_profiles` persistence and the `handleGenerate()` trigger point this story extends.
- ***Soft dependency***: none of this story's steps require a new Supabase migration, a new design-system token, or a new third-party library — everything is composed from existing primitives (`AlertBanner`, `lib/api/user-profile.ts`'s pattern, `@schemas` types).
- ***Blocks (downstream, out of scope here but worth noting for ****`/dev-roadmap`****)***: the Shopping List epic's `generate-shopping-list` function already reads `meal*plans.semana*iso` (`supabase/functions/generate-shopping-list/index.ts:47`) — Step 1's bug fix directly benefits that function's correctness too, though verifying that is not this story's job.

---

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Bucket-to-euro placeholder values are wrong/unrealistic, producing false-positive or false-negative budget warnings | Flagged explicitly as an open question for the founder before merge (Decision 2); values are isolated to one named constant, trivial to tune post-launch without touching validation logic. |
| Next.js data-fetching pattern assumed from training data may not match this project's actual (breaking-changed) version | `AGENTS.md`'s own warning is followed literally in Step 5 — Context7 lookup before writing the fetch, not before the plan. |
| `getIsoWeek()` off-by-one at year boundaries (a classic ISO-8601 week-numbering bug class) silently produces a wrong `semana_iso` that looks plausible | Explicit boundary-case unit tests in Step 1 (Dec 31 / Jan 1 edge cases), not just a happy-path date. |
| Fixing `semana*iso` changes what gets written to `meal*plans` going forward — any already-persisted rows from before this fix (if any exist in a deployed environment) would have non-ISO-week values | Out of scope to backfill in this story (no rows are expected yet, since the frontend has never had a live consumer of `generate-meal-plan` until now) — flagged here rather than silently assumed harmless. |

---

## Estimated Effort

Medium — one small pure utility, one validator addition, one new read function with tests, and two page-level wiring changes, all against an already-complete backend. No new library, no schema migration, no design-system work beyond one small shared component.

---

## Definition of Done Checklist

- [ ] `getIsoWeek()` implemented + unit-tested (year-boundary cases included); `handleGenerate()` call site fixed.
- [ ] `validator.ts` budget check implemented + unit-tested; soft-warn only, per Decision 1.
- [ ] `lib/api/edge-functions.ts` + `lib/api/types.ts` repointed to `@schemas`; `bun run types:check` clean.
- [ ] `lib/api/meal-plan.ts` read function implemented + unit-tested (happy path, empty case, error case).
- [ ] `/menu` wired to real data; loading/empty/warning states present.
- [ ] `/calendar` wired to real data; loading/empty/warning states present; shared `EmptyState` component built once, reused twice.
- [ ] `AlertBanner` renders real `advertencias` on both pages.
- [ ] `app/onboarding/page.tsx` catch block differentiates the 502 generation-failure case with AC-4-specific copy.
- [ ] `bun run test`, `bun run types:check`, `bun run lint` all pass (exact script names confirmed from `package.json`, not guessed).
- [ ] Bucket-to-euro placeholder values confirmed (or explicitly deferred) with the founder before merge.

---

## Review Workload Forecast

Estimated: 620 additions + 190 deletions = 810 total lines
400-line budget risk: High
Chain strategy: stacked-to-main
Decision needed before apply: No

Notes:

- Suggested 3-PR stack: PR1 (foundation) = `lib/date/iso-week.ts` + test, `validator.ts` + new `validator.test.ts`, `app/onboarding/page.tsx` (both fixes), `lib/api/edge-functions.ts` + `lib/api/types.ts`. PR2 = `lib/api/meal-plan.ts` + test, `components/ui/empty-state.tsx`, `/menu` wiring. PR3 = `/calendar` wiring (reuses PR1+PR2 primitives, smallest of the three).
- `validator.test.ts` is a new file even though `validator.ts` itself is pre-existing — no unit tests exist for it today; this story adds the first ones (for the new budget logic, at minimum), which the 20% tests-with-code buffer already accounts for structurally but is called out here since it inflates the "new file" count more than a typical story.

---


_Synced from Jira by sync-jira-issues_
