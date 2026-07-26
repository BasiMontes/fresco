# Comments for FRESCO-5

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-5)

---

### Basi Montes - 7/26/2026, 6:00:07 PM

## Criterios de Aceptación

```gherkin
Scenario: Laura completa el onboarding en exactamente tres pasos
  Given Laura es una usuaria nueva sin perfil guardado
  When completa el paso de dieta y restricciones, el paso de cocinas favoritas y el paso de tamaño del hogar
  Then su perfil queda guardado
  And no se le muestra un cuarto paso

Scenario: Laura declara una dieta vegana
  Given Laura está completando el paso de dieta y restricciones
  When selecciona "vegana"
  Then "vegetariana" queda implícita y se respeta junto con "vegana"

Scenario: Laura introduce un tamaño de hogar inválido
  Given Laura está completando el paso de tamaño del hogar
  When introduce más adultos que el total de personas en su hogar
  Then ve un mensaje de validación claro
  And no puede continuar hasta que los números sean consistentes

Scenario: Laura declara un alérgeno durante el onboarding
  Given Laura está completando el paso de dieta y restricciones
  When declara un alérgeno alimentario
  Then ese alérgeno queda guardado como parte de su perfil
  And todo menú generado después debe respetarlo (ver la historia de Seguridad Alimentaria)
```

---

### Basi Montes - 7/26/2026, 6:00:08 PM

## Alcance

- Recoger restricciones dietéticas (vegetariana, vegana, sin gluten, sin lactosa, sin huevo, keto, halal)
- Recoger alérgenos alimentarios declarados
- Recoger ingredientes que no le gustan
- Recoger cocinas favoritas
- Recoger tamaño del hogar (adultos y niños)
- Completar todo el flujo en exactamente tres pasos
- Validar que los números de hogar declarados sean consistentes entre sí (p. ej. los adultos no pueden superar el total del hogar)
- Validar que una declaración vegana implique también vegetariana

---

### Basi Montes - 7/26/2026, 6:00:09 PM

## Fuera de Alcance

- Editar un perfil guardado después de terminar el onboarding (historia futura)
- Completar el onboarding sin cuenta (modo invitado — épico separado, todavía no en este backlog)
- Definir presupuesto semanal, nivel de picante o límites de tiempo de cocina durante el onboarding (FR-1.2 fija el onboarding en exactamente los tres pasos nombrados — estos ajustes quedan totalmente fuera del alcance de esta historia, no solo diferidos)

---

### Basi Montes - 7/26/2026, 6:00:10 PM

## Especificación de Reglas de Negocio

- Los adultos declarados no pueden superar el tamaño total del hogar
- El tamaño del hogar debe ser mayor que cero
- Una declaración vegana implica siempre una declaración vegetariana; lo contrario no es necesario

---

### Basi Montes - 7/26/2026, 6:26:21 PM

## Spec Implementation Plan (Dev)

# Implementation Plan: STORY-FRESCO-5 - Onboarding | Complete diet, cuisine, and household setup in 3 steps

## Overview

Extend the existing `/onboarding` scaffold so it collects the full FR-1.1 profile (diet + allergens + disliked ingredients + favorite cuisines + household size) across exactly 3 steps (FR-1.2), then persists it to `user_profiles` for the authenticated user before continuing to menu generation.

***Acceptance Criteria to satisfy*** (from Jira comments, `## Criterios de Aceptación`):

- AC-1: onboarding completes in exactly 3 steps; no 4th step ever shown.
- AC-2: selecting "vegana" implies "vegetariana" is also respected.
- AC-3: an inconsistent household size (adults > total household) shows a specific validation message and blocks continuation.
- AC-4: a declared allergen is saved as part of the profile.

***Scope*** (from Jira comment `## Alcance`): dietary restrictions (vegetarian, vegan, gluten-free, lactose-free, egg-free, keto, halal), allergens, disliked ingredients, favorite cuisines, household size (adults + children), all within exactly 3 steps, with household-consistency and vegan-implies-vegetarian validation.

***Out of scope*** (from Jira comment `## Fuera de Alcance`): editing a saved profile after onboarding, guest-mode onboarding (separate epic, not yet backlogged), and budget/spice-level/cook-time fields (FR-1.2 pins onboarding to exactly these 3 steps — those fields are not deferred, they are excluded).

---

## Technical Approach

***Chosen approach******:*** Extend the current scaffold in place rather than rewrite it — `app/onboarding/page.tsx` and `lib/store/onboarding-store.ts` already implement the 3-step shell, the step indicator, and step 1/2/3 skeletons with the project's existing `Card`/`Tag`/`Input`/`Button` components. The gap is data completeness (missing diet options, no allergens/disliked-ingredients capture, cuisine values not typed against the DB enum, household size is a single number instead of adults/children) and persistence (nothing currently writes to `user_profiles` — the page calls `generateMealPlan` directly with a `null` session).

Since guest-mode onboarding is explicitly out of scope for this story, this plan assumes an authenticated Supabase session exists by the time a user reaches `/onboarding` (signup/login is handled upstream of this story; the existing `null`-session TODO in `handleGenerate` is guest-mode-specific and stays untouched — out of scope). Persistence therefore goes through the browser Supabase client (`lib/supabase/client.ts`), which is already RLS-scoped to `auth.uid()`, matching the `user*profiles` `profiles*insert*own` / `profiles*update_own` policies.

***Alternatives considered******:***

- ***Split into 3 separate routes*** (`/onboarding/diet`, `/onboarding/cuisines`, `/onboarding/household`): rejected — the existing single-route pattern already satisfies "exactly 3 steps" (AC-1) via internal state, and a route-per-step would be a larger, unrequested restructure of code that already works. Per CLAUDE.md Rule 14 (Live-UI-First), the current live pattern is reused, not replaced.
- ***react-hook-form + zod for the whole flow***: rejected for steps 1-2 (tag-toggle UI, no form fields to register) — only step 3 (household numbers) needs numeric validation, and a small pure validation function is proportional to that need. Considered zod purely for step 3's two fields; decided a plain typed function is simpler here since the two business rules (`adultos > 0`, `adultos <= num_personas`) don't need schema composition, and it keeps the diff smaller.
- ***Persist on every step (autosave)***: rejected — AC-1's "el perfil queda guardado" reads naturally as a single save on completion; autosaving partial/invalid state (e.g., before household validation passes) risks writing rows that violate the `check*adultos*personas` constraint mid-flow. Persist once, after step 3 validation passes.

***Why this approach******:***

- ✅ Reuses every existing UI primitive (`Card`, `Tag`, `Input`, `Button`) — zero new design-system components.
- ✅ Keeps the diff scoped to the actual gap (data completeness + persistence), not a rewrite.
- ✅ Single persistence point avoids partial/invalid rows in `user_profiles`.
- ❌ Trade-off: household-size validation only fires on submit/step-advance, not on every keystroke — acceptable since AC-3 only requires blocking continuation with a clear message, not live-as-you-type validation.

---

## UI/UX Design

No `.context/design/master-design-plan.md` exists in this project (confirmed absent) and this story has no §8 screen-map row to consult — per CLAUDE.md Rule 14 this degrades to ***DESIGN.md-token-only fidelity****, with the ****live ****`/onboarding`**** page as the actual source of truth*** (Live-UI-First): every new element reuses the tokens/components already in play on that page rather than inventing new patterns.

### Components reused (no new components)

- `Card`, `Tag` (`selected` / `outline` variants), `Input`, `Button` — all already imported in `app/onboarding/page.tsx`.
- Allergen and disliked-ingredient capture reuse the same "tag toggle" interaction pattern already used for diet and cuisine (a fixed, short chip list per FR-8.1's guardrail scope — not a free-text field — so declared values stay within the recipe catalog's known `alergenos` vocabulary and are actually filterable by `get*filtered*recipes`).

### Step layout changes

```
Step 1 (dieta y restricciones):
  - Diet chips (7): vegetariano, vegano, sin*gluten, sin*lactosa, sin_huevo, keto, halal
    (selecting "vegano" auto-locks "vegetariano" selected — AC-2)
  - Allergen chips (short curated list matching recipes.alergenos vocabulary)
  - Disliked-ingredient chips (short curated list, same rationale as allergens)

Step 2 (cocinas favoritas):
  - Cuisine chips, now backed by the `tipo_cocina` enum values (label ≠ value)

Step 3 (hogar):
  - Adultos [Input number] + Niños [Input number]
  - Inline validation message when adultos > (adultos + ninos) is inconsistent,
    or adultos <= 0 — blocks "Generar mi menú" until resolved (AC-3)
```

### Validation visual (step 3 only)

- Error: `border-red-500` on the offending input + specific message in `text-red-500` below it (never a generic "algo salió mal").
- Valid state: default `border-border` (existing `Input` style, untouched).

No changes to responsiveness, color palette, or personality — this story extends existing screens, it does not restyle them.

---

## Types & Type Safety

- `api/schemas/user-profile.types.ts` (`UserProfile`) is the persistence contract — the Supabase upsert payload is typed against it (`Partial<UserProfile>` restricted to the onboarding-owned columns; `plan`, `plan*expires*at`, `nivel*picante`, `contundencia*preferida`, `tiempo*max**`, `presupuesto*semana*euros` are DB-defaulted and untouched by this story per Out-of-Scope).
- `api/schemas/recipe.types.ts` (`TipoCocina`) is the canonical cuisine enum — the store's `cocinasFavoritas` field changes from `string[]` to `TipoCocina[]`, and the page's cuisine option list changes from ad-hoc Spanish labels to `{ value: TipoCocina, label: string }[]` (mirroring the existing `DIETA_OPTIONS` shape), so a mislabeled cuisine can never reach the database.
- No `lib/database.types.ts` generation needed — `lib/supabase/types.ts` already types `user_profiles` via the live `Database` schema.

---

## Implementation Steps

### Step 1: Restructure `onboarding-store.ts` to match the `user_profiles` shape

***Task******:*** Replace the current `dieta: DietaBase[]` / single `numPersonas` shape with individual boolean flags per diet column, plus allergens, disliked ingredients, typed cuisines, and split household counts — mirroring `UserProfile` field-for-field so the step-3 payload is a near-direct mapping.

***File******:*** `lib/store/onboarding-store.ts` (modify)

***Details******:***

- State: `dietaVegetariano`, `dietaVegano`, `dietaSinGluten`, `dietaSinLactosa`, `dietaSinHuevo`, `dietaKeto`, `dietaHalal` (booleans); `alergenos: string[]`; `ingredientesOdiados: string[]`; `cocinasFavoritas: TipoCocina[]`; `adultos: number`; `ninos: number`.
- Actions: `toggleDieta(field)` — toggling `dietaVegano` on also forces `dietaVegetariano` true (AC-2); toggling `dietaVegetariano` off while `dietaVegano` is true is a no-op (keeps the invariant, mirrors the DB's `check*vegano*es_vegetariano` constraint).
- `toggleAlergeno(value)`, `toggleIngredienteOdiado(value)`, `toggleCocina(value: TipoCocina)`, `setAdultos(n)`, `setNinos(n)` follow the existing toggle/set pattern already in the file.
- Keep `step`, `setStep`, `reset` as-is.

***Edge cases handled******:***

- Untoggling `dietaVegetariano` while `dietaVegano` is still selected: blocked in the reducer (state unchanged) — keeps the AC-2 invariant true at all times, not just at submit time.

***Testing******:***

- Unit test: toggling `dietaVegano` sets `dietaVegetariano` true.
- Unit test: attempting to untoggle `dietaVegetariano` while `dietaVegano` is true is a no-op.

***Estimated time******:*** 1h

---

### Step 2: Add a pure household-validation helper

***Task******:*** Extract the two business rules (`adultos > 0`, `adultos <= num_personas`) into a small, independently testable function, since this is the story's only real validation logic (AC-3).

***File******:*** `lib/validation/onboarding.ts` (new)

***Structure/Logic******:***

- `validateHousehold({ adultos, ninos }): { valid: boolean, message: string | null }`.
- `num*personas` is derived as `adultos + ninos` (the schema's `num*personas` column has no independent input in this UI — the two counts the user enters are adults and children, and their sum is the persisted household total; this keeps a single source of truth instead of asking Laura for a redundant third number).
- Rules: `adultos <= 0` → "Indica al menos un adulto en el hogar."; `ninos < 0` → "El número de niños no puede ser negativo."; (the `adultos <= num*personas` schema constraint is satisfied by construction once `num*personas = adultos + ninos` and `ninos >= 0` — no separate check needed, but the function still asserts it defensively in case the derivation changes later).

***Edge cases handled******:***

- Zero adults with children present: rejected (Laura's household needs at least one adult; the schema's `num_personas > 0` guard is redundant here since `adultos > 0` already forces it).

***Testing******:***

- Unit tests: 0 adults → invalid with specific message; negative children → invalid; valid combination → `valid: true`, `message: null`.

***Estimated time******:*** 45m

---

### Step 3: Rebuild Step 1 & Step 2 UI (diet, allergens, disliked ingredients, cuisines)

***Task******:*** Extend `app/onboarding/page.tsx`'s step 1 to render the full 7-item diet list plus allergen and disliked-ingredient chip sections, and fix step 2's cuisine list to use `TipoCocina` values.

***File******:*** `app/onboarding/page.tsx` (modify)

***Details******:***

- `DIETA*OPTIONS` grows from 5 to 7 entries (add `sin*huevo`, `keto`, `halal`); values switch from the ad-hoc `DietaBase` union to the store's new boolean-flag fields (one toggle button per flag).
- Render the `dietaVegetariano` chip as visually locked (`selected`, non-interactive) whenever `dietaVegano` is active — surfaces AC-2 in the UI, not just in store logic.
- Add `ALERGENO*OPTIONS` and `INGREDIENTE*ODIADO_OPTIONS` constants (short curated lists — reuse the same tag-toggle JSX block already used for diet/cuisine, no new component).
- `COCINA_OPTIONS` becomes `{ value: TipoCocina, label: string }[]` mapping the 7 enum values (`española`, `italiana`, `mexicana`, `asiática`, `mediterránea`, `latina`, `internacional`) to their existing display labels (`Española`, `Italiana`, ... plus new `Latina`, `Internacional` entries the current 6-item list is missing).

***Edge cases handled******:***

- Existing "Mediterránea"/"Asiática" labels keep their look; only the underlying `value` changes to the typed enum, so no visual regression on step 2.

***Testing******:***

- Component/manual: toggling vegano visually locks vegetariano selected; toggling it does not let vegetariano be turned off.
- Manual: all 7 diet chips, allergen chips, and disliked-ingredient chips render and toggle independently.

***Estimated time******:*** 1h

---

### Step 4: Rebuild Step 3 UI (household) + inline validation + persistence

***Task******:*** Replace the single `numPersonas` input with `adultos`/`ninos` inputs, wire in `validateHousehold`, block progression on invalid state, and persist the full profile to `user_profiles` before calling `generateMealPlan`.

***File******:*** `app/onboarding/page.tsx` (modify), new `lib/api/user-profile.ts` (new)

***Structure/Logic******:***

- Step 3 renders two `Input type="number"` fields (adultos, niños) instead of one; validation message renders inline (per the visual spec above) whenever `validateHousehold` returns invalid.
- "Generar mi menú" button `disabled` when `isGenerating` OR household invalid (extends the existing `disabled` condition).
- `lib/api/user-profile.ts` exports `upsertUserProfile(client, profile: Partial<UserProfile>)` — thin wrapper around `supabase.from('user_profiles').upsert({ id: user.id, ...profile })`, resolving the current user via `supabase.auth.getUser()` first (fail fast / throw if no session — public-method contract per `code-standards.md`/`error-handling.md`).
- `handleGenerate` (existing) now: 1) builds the `Partial<UserProfile>` payload from store state, 2) calls `upsertUserProfile`, 3) on success proceeds to the existing `generateMealPlan` call unchanged.

***⚠️ DB note******:*** no new migration needed — `user*profiles` (columns + constraints + RLS) already exists from `supabase/migrations/20260725120100*create*fresco*core_tables.sql`. This step only writes application code against the existing table.

***Edge cases handled******:***

- No authenticated session at submit time: `upsertUserProfile` throws; `handleGenerate`'s existing `try/finally` already resets `isGenerating` — a user-visible error surface for this case is a pre-existing gap shared with the untouched guest-mode TODO, not introduced by this story (guest mode is out of scope per the Jira comment).
- `adultos`/`ninos` left at their defaults without the user touching them: defaults (`adultos: 2, ninos: 0`) already satisfy `validateHousehold`, so a user who never touches step 3 still gets a valid, savable profile.

***Testing******:***

- Manual: entering adultos > (adultos+ninos) shows the specific message and disables "Generar mi menú".
- Manual: valid household + full flow → profile row appears in `user_profiles` for the test user, correct on every column.
- Unit test: `upsertUserProfile` builds the expected payload shape (mocked Supabase client).

***Estimated time******:*** 1h 30m

---

### Step 5: Integration — full 3-step flow, no 4th step

***Task******:*** Confirm the flow start-to-finish matches every AC scenario.

***Flow******:***

1. Laura opens `/onboarding` at step 1, selects diet + allergens + disliked ingredients.
2. Advances to step 2, selects favorite cuisines.
3. Advances to step 3, enters household size; invalid combinations block the CTA with a specific message (AC-3).
4. On valid submit, the profile upserts to `user_profiles` (diet flags including the vegano→vegetariano implication from Step 1, AC-4's allergens, cuisines, household) and only then navigates onward — no step 4 is ever rendered (AC-1, unchanged from the existing `step: 1 | 2 | 3` type + step indicator, which structurally cannot exceed 3).

***Testing******:***

- Manual E2E walk of the 4 Jira AC scenarios against the running dev server (`bun run dev`) per the Live-UI validation doctrine.

***Estimated time******:*** 30m

---

## Technical Decisions (Story-specific)

### Decision 1: Allergens and disliked ingredients are curated tag lists, not free text

***Chosen******:*** Reuse the existing tag-toggle pattern (fixed, short option lists) for allergens and disliked ingredients, instead of a free-text input.

***Reasoning******:***

- ✅ FR-8.1's SQL pre-filter (`get*filtered*recipes`) excludes recipes by exact string overlap against `recipes.alergenos` / `recipes.ingredientes_principales` — free text that doesn't match the catalog's vocabulary would silently fail to filter anything, defeating the food-safety guardrail (ADR-0001 / architecture.md §5) without the user ever knowing.
- ✅ Matches the live UI's existing interaction pattern (Rule 14) — no new component, no new input paradigm mid-flow.
- ❌ Trade-off: a household with an allergen genuinely outside the curated list has no way to declare it in this story. Not a regression (today there's no way to declare **any** allergen) and not architectural — logged as a candidate follow-up (e.g., "other, please specify" free-text extension), not an ADR: it's a content/UX scoping call, not a cross-cutting invariant.

### Decision 2: Household total is derived (`adultos + ninos`), not independently entered

***Chosen******:*** The UI collects `adultos` and `ninos`; `num_personas` is computed as their sum rather than asked as a third field.

***Reasoning******:***

- ✅ Removes a redundant number Laura would otherwise have to keep consistent by hand — directly serves AC-3's "consistent numbers" requirement by construction instead of by post-hoc validation.
- ✅ Still satisfies the DB's `check*adultos*personas` constraint (`adultos <= num*personas`) trivially, since `num*personas` is defined as `adultos + ninos >= adultos`.
- ❌ Trade-off: none identified — this is strictly simpler than the 3-independent-numbers alternative and cannot produce an inconsistent triple.

Neither decision is architectural-and-hard-to-reverse (both are single-story, single-file-scope UX/content calls) — no ADR promotion.

---

## Dependencies

***Pre-requisitos técnicos******:***

- [x] `user*profiles` table, constraints, and RLS policies already live (`supabase/migrations/20260725120100*create*fresco*core_tables.sql`) — no new migration required.
- [x] No hard blockers per `.context/dev-roadmap.md` (Execution Sprint 1; FRESCO-5 and FRESCO-9 are both unblocked and independent of each other).
- [ ] Confirm at Stage 2 that a real authenticated session is reachable in local/staging dev (signup/login flow) to manually verify the persistence step end-to-end — if not yet wired, this story's persistence code is still correct/testable in isolation (unit test + mocked client) but the full manual AC walk needs a real session.

---

## Risks & Mitigations

***Risk 1******:*** Curated allergen/disliked-ingredient lists may not exactly match the seeded `recipes.alergenos` / `ingredientes_principales` vocabulary (recipe.types.ts already flags this as an open reconciliation gap).

- ***Impact******:*** Medium — a mismatch would mean a declared allergen silently fails to filter recipes (food-safety concern, ADR-0001).
- ***Mitigation******:*** Source the curated list directly from the seeded `recipes` values (spot-check via Supabase during Stage 2) rather than inventing labels; flag any residual mismatch as a follow-up tech-debt ticket, not silently ship it.

***Risk 2******:*** No real authenticated session available yet in local dev to manually verify persistence (signup/login may not be wired for this exact story's dev environment).

- ***Impact******:*** Low — unit tests cover the payload-building logic regardless; only the full manual AC walk is affected.
- ***Mitigation******:*** Verify session availability early in Stage 2; if missing, seed a test user directly in Supabase for manual verification and note the gap in the PR description for QA awareness.

---

## Estimated Effort

| Step | Time |
| --- | --- |
| 1. Restructure `onboarding-store.ts` | 1h |
| 2. Household validation helper | 45m |
| 3. Rebuild Step 1 & 2 UI | 1h |
| 4. Rebuild Step 3 UI + persistence | 1h 30m |
| 5. Integration + AC walk | 30m |
| ***Total**** | ****~******4h 45m*** |

***Story points******:*** not set on the Story (`Story Points: -`) — this plan's estimate is informational until the PO sizes it.

---

## Definition of Done Checklist

- [ ] Code implemented per this plan
- [ ] All 4 AC scenarios passing (exact 3 steps; vegano→vegetariano; household validation; allergen persisted)
- [ ] Types from `api/schemas/user-profile.types.ts` and `api/schemas/recipe.types.ts` used for all new state/payloads
- [ ] Household/allergen/cuisine option lists reuse existing `Card`/`Tag`/`Input`/`Button` components — no new design-system components
- [ ] Unit tests: store's vegano→vegetariano lock, `validateHousehold`, `upsertUserProfile` payload shape
- [ ] Manual live-UI walk of all 4 AC scenarios against the running dev server (loading/disabled states included)
- [ ] Code review approved
- [ ] Lint + types + build clean
- [ ] Deployed to staging; manual smoke test on staging (desktop + mobile)

---

## Review Workload Forecast

Estimated: 259 additions + 65 deletions = 324 total lines
400-line budget risk: Medium
Chain strategy: pending
Decision needed before apply: No

Notes: Medium risk from touching one already-large existing file (`app/onboarding/page.tsx`) across all 3 steps plus a store restructure; no chain decision required since risk is not High. Single PR is appropriate for this story's scope.

---


_Synced from Jira by sync-jira-issues_
