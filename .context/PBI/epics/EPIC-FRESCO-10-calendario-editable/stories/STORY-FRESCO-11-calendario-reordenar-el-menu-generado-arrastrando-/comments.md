# Comments for FRESCO-11

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-11)

---

### Basi Montes - 7/27/2026, 7:29:34 PM

## Criterios de Aceptación

```gherkin
Scenario: Laura intercambia dos platos de su menú
  Given Laura tiene un menú semanal generado con los 21 espacios llenos
  When arrastra el plato del lunes cena al espacio de martes comida
  Then los platos de ambos espacios se intercambian
  And el nuevo orden se guarda inmediatamente sin necesidad de una acción adicional

Scenario: Laura recarga la página después de reordenar
  Given Laura reordenó su menú semanal arrastrando platos
  When vuelve a abrir el calendario más tarde
  Then ve el menú en el orden que dejó, no el orden original generado

Scenario: El intercambio falla por un error de red o de base de datos
  Given Laura intenta arrastrar un plato a otro espacio
  When el guardado del nuevo orden falla
  Then el plato vuelve visualmente a su posición original
  And ve un mensaje claro de que el cambio no se guardó
```


---

### Basi Montes - 7/27/2026, 7:29:35 PM

## Alcance

- Reordenar (intercambiar) dos platos del menú generado mediante arrastrar y soltar
- Persistir el nuevo orden en el mismo plan generado, sin crear un plan nuevo
- Reflejar el nuevo orden inmediatamente en la interfaz tras el arrastre
- Revertir visualmente el cambio si el guardado falla, mostrando un mensaje claro


---

### Basi Montes - 7/27/2026, 7:29:36 PM

## Fuera de Alcance

- Generar el menú semanal (propiedad de la historia de Generación de Menú)
- Marcar un plato como cocinado, descartado o sustituido (épico separado de Aprendizaje Cocinado/Descartado)
- Construir la lista de la compra a partir del menú (épico separado de Lista de la Compra)
- Añadir o eliminar espacios del menú (el menú siempre tiene exactamente 21 espacios fijos, por regla de negocio de Generación de Menú)


---

### Basi Montes - 7/27/2026, 7:29:38 PM

## Especificación de Reglas de Negocio

- Cada espacio del menú (día × tipo de plato) solo puede contener una receta a la vez — intercambiar dos platos nunca debe dejar un espacio vacío ni duplicado
- El intercambio de posición nunca cambia el estado de aprendizaje (cocinado/descartado) de ninguna receta — es una operación neutral sobre ese estado
- Un menú siempre mantiene exactamente 21 espacios; el reordenamiento nunca añade, elimina, ni genera espacios nuevos


---

### Basi Montes - 7/27/2026, 8:04:58 PM

## Spec Implementation Plan (Dev)

# Implementation Plan: STORY-FRESCO-11 - Calendario | Reordenar el menú generado arrastrando platos entre espacios

## Overview

`/calendar` (STORY-FRESCO-7) already renders the real, persisted weekly menu via `getMealPlanForWeek()` — a full 7×3 grid, one slot per (día, tipo_plato), with a static `GripVertical` icon left as a non-functional placeholder. Its own doc comment names this story as the one that makes the handle real. Nothing else about FRESCO-7's read path, the `generate-meal-plan` Edge Function, or `prompt.ts`/`validator.ts` is touched or re-implemented here.

What this story adds, scoped tightly:

1. A drag-and-drop interaction that lets the user pick up one slot's dish and drop it onto another, swapping the two.
2. A persistence write path for that swap against the existing `meal*plan*recipes` rows (no new plan, no new table).
3. Optimistic UI (immediate visual swap) with rollback + a clear error message if the write fails (AC Scenario 3).
4. A structural fix at the data layer to make the swap even possible: `getMealPlanForWeek()`'s current return shape has no per-slot identifier, only the joined `Recipe` — additive, non-breaking change (see Technical Decisions §1).

***Acceptance Criteria to satisfy*** (from Jira comments, Spanish original):

- Scenario 1: dragging a dish from one slot onto another swaps the two; the new order persists immediately, no extra confirmation action.
- Scenario 2: reloading the page later still shows the reordered state, not the original generated order.
- Scenario 3: on a network/DB failure, the dragged dish visually reverts to its original slot and the user sees a clear message that the change wasn't saved.

---

## Coverage Assessment (per AC scenario)

| # | Scenario | Status | Plan |
| --- | --- | --- | --- |
| 1 | Swap on drop, saved immediately | New | Drag-drop island (`CalendarGrid`) calls `swapMealPlanSlots()` on drop; optimistic local state update happens synchronously, write fires in the background. |
| 2 | Reload shows the reordered state | New | Persistence is a real DB write (new `swap*meal*plan*slots` Postgres function) against `meal*plan_recipes`, not client-only state — the next Server Component render of `/calendar` re-reads via the unmodified `getMealPlanForWeek()` query path and reflects the swap. |
| 3 | Failed write reverts + clear message | New | Optimistic-with-rollback pattern (Technical Decision §2): on RPC error, the local state reverts to the pre-drop snapshot and an inline error surface renders next to the grid. |

---

## Technical Approach

***Chosen approach******:*** keep `/calendar/page.tsx` as the async Server Component FRESCO-7 built (data fetch stays server-side, no behavior change to the read path), and introduce one new `'use client'` island (`CalendarGrid`) that owns all drag-drop interactivity and the swap write. The Server Component fetches the plan + a new parallel `slotIds` map and passes both down as props; the client island renders the 21 cells, wires drag sensors, and calls a new `swapMealPlanSlots()` function from `lib/api/meal-plan.ts` directly against Supabase (no new Edge Function — see Technical Decision §3).

1. Extend `MenuSemanalPersistido` (additive field, `lib/api/meal-plan.ts`) with `slotIds: Record<DiaSemana, Record<TipoPlato, string>>` so the client can address each `meal*plan*recipes` row by its real `id` without changing the existing `menu` shape `/menu/page.tsx` already consumes.
2. Add a new Postgres function `swap*meal*plan*slots(p*slot*a*id uuid, p*slot*b*id uuid)` (new migration) that swaps `(recipe*id, estado, rating)` between two sibling rows of the same `meal*plan*id`, atomically, while disabling `recipe*learning*trigger` for the duration — see ADR-0002 (promoted from this plan's own Technical Decision §4).
3. Add `swapMealPlanSlots(client, slotAId, slotBId): Promise<void>` to `lib/api/meal-plan.ts`, a thin fail-fast wrapper around `client.rpc('swap*meal*plan_slots', ...)`, mirroring `MealPlanError`'s existing pattern.
4. Add `lib/calendar/apply-slot-swap.ts`: a pure function `applySlotSwap(menu, slotAKey, slotBKey)` that returns a new grid with two slots' recipes exchanged — used for the optimistic local update, independently unit-testable without React or a DB.
5. Build `components/calendar/calendar-grid.tsx` (`'use client'`): wraps the grid in `@dnd-kit/core`'s `DndContext`, one `useDraggable` + `useDroppable` pair per slot, `onDragEnd` triggers the optimistic update + fire-and-await the RPC, reverting local state and showing an inline error on failure.
6. Wire `/calendar/page.tsx` to render `<CalendarGrid initialMenu={plan.menu} slotIds={plan.slotIds} />` instead of the static grid markup; `AlertBanner` stays exactly where it is (see Technical Decision §5 — it is untouched by this story).

***Alternatives considered******:***

- ***A new Edge Function (****`update-recipe-status`****-style) to perform the swap.*** Rejected: the swap needs no AI call, no external service, and the RLS `mpr*update*own` policy already lets an authenticated owner update their own `meal*plan*recipes` rows directly — this mirrors the precedent already named in `app/(app)/shopping-list/page.tsx`'s own doc comment ("the real `comprado` toggle bypasses the Edge Function layer entirely via a direct Supabase... RPC call"). Introducing a network hop to an Edge Function for a same-owner row update adds latency and a second deploy surface for no benefit.
- ***Two independent client-side ****`.update()`**** calls (one per row) instead of one RPC.*** Rejected: a network drop between the two calls (the exact failure mode AC Scenario 3 names) would leave one row updated and the other not — a genuinely corrupted, duplicated-recipe state the business rules explicitly forbid ("nunca debe dejar un espacio vacío ni duplicado"). A single Postgres function makes the swap atomic by construction. Full reasoning: Technical Decision §4 / ADR-0002.
- `@dnd-kit/sortable`*** instead of ****`@dnd-kit/core`****.**** Rejected: `sortable` models an insertable, order-preserving list (its whole API is "here is index N, shift everything after it"). This grid is 21 ****fixed*** slots being pairwise swapped, never inserted/reordered as a list — `useDraggable`/`useDroppable` primitives from `@dnd-kit/core` map directly onto "pick up slot A, drop on slot B," with no index-shifting semantics to fight.

***Why this approach******:***

- Reuses FRESCO-7's read path and page shape unchanged — the only structural change to `lib/api/meal-plan.ts` is additive (new field, new function), so `/menu/page.tsx` needs zero changes.
- Follows this repo's own established "direct-write bypasses Edge Function for already-generated-plan mutations" pattern instead of inventing a new one.
- Isolates all interactivity in one client island, keeping the Server Component's data-fetch/empty-state/error-state logic (FRESCO-7's own three-state pattern) completely untouched.

---

## Types & Type Safety

- `lib/api/meal-plan.ts`: `MenuSemanalPersistido` gains `slotIds: Record<DiaSemana, Record<TipoPlato, string>>` (additive — existing `menu` field's shape is unchanged). `MealPlanJoinRow`'s nested `meal*plan*recipes` array gains `id: string` in the select projection.
- New `lib/calendar/apply-slot-swap.ts` exports a `SlotKey = { dia: DiaSemana, tipo: TipoPlato }` type and `applySlotSwap(menu: Record<DiaSemana, Record<TipoPlato, Recipe>>, a: SlotKey, b: SlotKey): Record<DiaSemana, Record<TipoPlato, Recipe>>`.
- `components/calendar/calendar-grid.tsx` props: `{ initialMenu: Record<DiaSemana, Record<TipoPlato, Recipe>>, slotIds: Record<DiaSemana, Record<TipoPlato, string>> }` — no new types needed beyond what `@schemas`/`lib/api/types.ts` already export.
- No changes to `api/schemas/***` or `generate-meal-plan/***` — this story is entirely a read-shape extension + one new write path.

---

## UI/UX Design

No per-screen mockup exists for this story (`.context/design/master-design-plan.md` does not exist yet, per `dev-roadmap.md` §5) — DESIGN.md-only fidelity, and per the LIVE-UI-FIRST rule (Critical Rule #14) the current live `/calendar` grid is the source of truth to extend, not redesigned. `DESIGN.md`'s icon set already names a "6-dot drag handle" for this exact affordance; the current `GripVertical` (a 2-dot vertical icon from `lucide-react`) is a close-enough stand-in already in place from FRESCO-7 — swapping it for a literal 6-dot icon is a cosmetic nit, not blocking, and out of this story's stated scope (drag mechanics, not icon fidelity).

***States to add*** (the grid currently only renders the static happy-path list):

- ***Idle***: unchanged from FRESCO-7 — the existing grid markup, cards, and `AlertBanner`.
- ***Dragging***: the picked-up card follows the pointer (dnd-kit's default drag overlay behavior); the hovered drop target gets a visual affordance (e.g. a ring/border via an existing Tailwind utility, no new token needed).
- ***Optimistic-success***: on drop, the two cards' contents swap instantly — no loading spinner, per AC Scenario 1's "sin necesidad de una acción adicional."
- ***Rollback + error***: on RPC failure, the swap visually reverts and an inline error message renders (reusing the existing `alert`/`role="alert"` pattern `AlertBanner` already establishes, but as its own small, dismissible surface — see Technical Decision §2 for why this is NOT folded into `AlertBanner` itself).

`AlertBanner` + `advertencias` (AC-5's warning surface from FRESCO-7/FRESCO-9) stays exactly as-is, rendered above the grid, unaffected by any reorder — see Technical Decision §5.

***Accessibility note***: `@dnd-kit/core` ships a `KeyboardSensor` alongside the default `PointerSensor` — wiring both (not just pointer) is a small addition and keeps the swap usable without a mouse, worth including in Step 5 rather than deferring.

---

## Implementation Steps

### Step 1: Extend `lib/api/meal-plan.ts` with per-slot ids (additive)

***Files******:*** `lib/api/meal-plan.ts` (modify), `lib/api/meal-plan.test.ts` (modify).

***Task******:**** Add `id` to the `meal*plan*recipes` select projection (`.select('semana*iso, advertencias, meal*plan*recipes(id, dia, tipo*plato, recipes(**))')`), add `id: string` to `MealPlanJoinRow`'s nested array type, add `slotIds` to `MenuSemanalPersistido`, and populate it in `getMealPlanForWeek()` alongside the existing `reshapeMenu()` call (a small sibling loop, or extend `reshapeMenu()` to build both structures in one pass over the same rows — either is fine, prefer one pass to avoid iterating the 21 rows twice). No change to `reshapeMenu()`'s existing validation behavior (still throws `MealPlanError` on a missing recipe or incomplete grid).

***Testing******:*** Extend the existing happy-path test case to assert `slotIds` is populated with the expected 21 ids; existing no-plan / DB-error test cases need no change (they never reach the new field).

### Step 2: `swap*meal*plan_slots` Postgres function (new migration)

***File******:*** `supabase/migrations/<timestamp>*add*swap*meal*plan*slots*function.sql` (new).

***Task******:*** `security definer` function taking `p*slot*a*id uuid, p*slot*b*id uuid`. Verifies both rows exist, share the same `meal*plan*id`, and that `meal*plan*id` is owned by `auth.uid()` (explicit join-back check, since `security definer` bypasses RLS — mirrors the `mpr*update*own` policy's own logic). No-ops if `p*slot*a*id = p*slot*b*id`. `ALTER TABLE ... DISABLE TRIGGER recipe*learning*trigger`, swaps `(recipe*id, estado, rating)` between the two rows, `ALTER TABLE ... ENABLE TRIGGER recipe*learning_trigger`, all inside the one function call (implicit transaction — any raised exception rolls back the disable too). Raises a clear exception on any ownership/existence violation rather than silently no-op-ing. Full rationale: ADR-0002.

***Testing******:*** No unit-test harness exists for SQL functions in this repo today (Edge Function tests, where they exist, are integration-level against a real/local Supabase instance — out of scope to newly introduce here). Verification for this step is a manual `supabase db reset` + direct SQL exercise (swap two rows, confirm `recipes.veces*cocinada` unchanged, confirm ownership check rejects a foreign `meal*plan_id`) before Stage 2 wiring depends on it.

### Step 3: `swapMealPlanSlots()` client wrapper

***Files******:*** `lib/api/meal-plan.ts` (modify), `lib/api/meal-plan.test.ts` (modify).

***Task******:*** `export async function swapMealPlanSlots(client: SupabaseClient<Database>, slotAId: string, slotBId: string): Promise<void>` — calls `client.rpc('swap*meal*plan*slots', { p*slot*a*id: slotAId, p*slot*b_id: slotBId })`, throws `MealPlanError` on any returned error (fail-fast, matching `getMealPlanForWeek()`'s own convention).

***Testing******:*** Unit tests mocking the Supabase client: successful RPC resolves; RPC error surfaces as `MealPlanError` with the underlying message.

### Step 4: `applySlotSwap()` pure helper

***Files******:*** `lib/calendar/apply-slot-swap.ts` (new), `lib/calendar/apply-slot-swap.test.ts` (new).

***Task******:*** Pure function, no React/DOM dependency — given the current `menu` grid and two `{ dia, tipo }` slot keys, returns a new grid with the two recipes exchanged (immutable update, doesn't mutate the input). This is the function the client island calls for the optimistic update and calls again (with the same two keys) to revert on failure — reuse for both directions since a swap is its own inverse.

***Testing******:*** Unit tests: swapping two distinct slots exchanges their recipes and leaves the other 19 untouched; swapping a slot with itself is a no-op (returns an equivalent grid); applying the same swap twice returns the original grid (proves the revert-by-reapplying approach is correct).

### Step 5: `CalendarGrid` client island + wire `/calendar`

***Files******:*** `components/calendar/calendar-grid.tsx` (new), `app/(app)/calendar/page.tsx` (modify), `package.json` (modify — add `@dnd-kit/core`).

***Task******:*** `'use client'` component taking `{ initialMenu, slotIds }`. Wraps the 7×3 grid in `DndContext` (`PointerSensor` + `KeyboardSensor`), each cell is both a `useDraggable` and `useDroppable` target keyed by its `(dia, tipo)`. `onDragEnd`: if dropped on a different valid slot, (1) optimistically call `applySlotSwap()` and update local state immediately, (2) call `swapMealPlanSlots()` with the two slots' ids from `slotIds`, (3) on failure, call `applySlotSwap()` again with the same two keys to revert, and set an inline error message. `/calendar/page.tsx` replaces the static grid markup (the `GripVertical`-per-cell block) with `<CalendarGrid initialMenu={plan.menu} slotIds={plan.slotIds} />`; `AlertBanner` and the empty-state branch stay untouched.

***Testing******:**** No component-render test suite exists in this repo today (confirmed — zero `**.test.tsx` files; existing tests are all `lib/***` pure-function unit tests). This story does not introduce the first one; the interactive drag behavior is verified via ****live-UI validation*** (Playwright CLI, per the sprint-development Live-UI doctrine) during Stage 2/3, not a new RTL suite. `applySlotSwap()` (Step 4) already carries the logic-level unit coverage.

### Step 6: Verification pass

***Task******:*** `bun test` (Bun's built-in runner — confirmed no `"test"` script exists in `package.json`; do not invent `bun run test`), `bun run types:check`, `bun run lint:check`, in that order per CLAUDE.md rule #6. Confirm no regression in `lib/api/meal-plan.test.ts`'s existing three cases (happy path, no-plan, DB error).

---

## Technical Decisions (Story-specific)

### Decision 1: `MenuSemanalPersistido` gets an additive `slotIds` field, not a reshaped `menu`

***Chosen******:*** Add a new, parallel `slotIds: Record<DiaSemana, Record<TipoPlato, string>>` field to `MenuSemanalPersistido`, leaving the existing `menu: Record<DiaSemana, Record<TipoPlato, Recipe>>` field's shape untouched.

***Reasoning******:***

- The alternative — wrapping every grid cell as `{ id, recipe }` instead of a bare `Recipe` — would force a matching change in `/menu/page.tsx` (which reads `plan.menu[dia][slot].nombre` directly today) even though `/menu` has no drag-drop and no use for a slot id. That violates the task's explicit instruction not to touch FRESCO-7 surface area beyond what's strictly necessary.
- A parallel additive field is a non-breaking change to the return contract: any existing consumer that destructures `menu` and ignores unknown sibling fields keeps working unmodified. Only `/calendar/page.tsx` (this story's own file) reads `slotIds`.

***ADR-gate verdict******:*** does NOT qualify for an ADR. Gate 1 (architectural): fails — this is a local, additive extension to one function's return shape, not a system-wide invariant. Gate 2 (hard-to-reverse): fails — removing `slotIds` later is a one-file, no-migration change with a single consumer.

### Decision 2: Optimistic UI update with rollback-on-error, not pessimistic wait-for-confirm

***Chosen******:*** The swap applies to local UI state synchronously on drop; the DB write happens in the background; on failure, the local state reverts and an inline error renders.

***Reasoning******:***

- This isn't really a discretionary choice — the AC dictates it almost word-for-word: Scenario 1 requires the new order to be visible with "sin necesidad de una acción adicional" (no extra action, i.e. no spinner-then-confirm step), and Scenario 3 explicitly describes a visual revert plus a clear message on failure — which is the literal definition of optimistic-update-with-rollback. A pessimistic (wait-for-server-then-render) implementation would contradict Scenario 1 outright (the UI would visibly pause before updating).
- The DB write is a single atomic RPC (Decision 4 / ADR-0002), so "reverting on failure" has a clean, well-defined trigger (the RPC promise rejects) rather than an ambiguous partial-failure state to reason about.

***ADR-gate verdict******:*** does NOT qualify for an ADR. Gate 1: fails — this is a UI-interaction pattern scoped to one screen's one component, not a cross-cutting system invariant. Gate 2: fails — reversing it (switching to pessimistic) later touches only `CalendarGrid`'s `onDragEnd` handler, no data migration, no other consumer.

### Decision 3: `@dnd-kit/core` as the new dependency, not `@dnd-kit/sortable` or a different library

***Chosen******:*** Add `@dnd-kit/core` (only — not the `@dnd-kit/sortable` package) as a new `dependencies` entry. No drag-and-drop library exists in `package.json` today (confirmed by reading it directly).

***Reasoning******:***

- `@dnd-kit/core`'s `useDraggable`/`useDroppable` primitives model exactly this story's shape: a fixed set of 21 addressable slots, pairwise-swapped, never inserted or reordered as a list. `@dnd-kit/sortable` (a common companion package) is built for insertable/reorderable lists with index-shifting semantics that don't apply here and would add unused complexity.
- Actively maintained, React 18/19-compatible, zero legacy dependency on the older `react-dnd`/HTML5 drag API (which has known mobile-touch limitations `@dnd-kit` was built to fix) — a reasonable default for a project that will eventually need mobile-web support (Fresco's personas plan around a phone-first grocery-trip flow, per `user-journeys.md` Step 4).
- Verify current React 19 / Next 16 compatibility via Context7 before Stage 2 implementation, per `AGENTS.md`'s explicit warning that this Next.js version has breaking changes from training-data assumptions — not assumed here, flagged for Stage 2.

***ADR-gate verdict******:*** does NOT qualify for an ADR. Gate 1 (architectural): borderline — it is a new runtime dependency, but its usage is scoped entirely to one feature's client island (`components/calendar/calendar-grid.tsx`), not a cross-cutting concern every feature must adopt (unlike, say, a state-management library or an auth pattern). Gate 2 (hard-to-reverse): fails — per this repo's own precedent (FRESCO-7 Decision 1's reasoning), swapping the library later touches only the one component subtree that imports it; no shared UI component, no other page, and no data shape depends on which drag library is used. Per the ADR anti-pattern list ("a framework/library choice with real lock-in" earns an ADR; one bounded to a single feature's client island does not), this stays here as a story-local decision, not promoted.

### Decision 4: Atomic RPC swap that bypasses `recipe*learning*trigger` — promoted to ADR-0002

***Chosen******:*** A new `security definer` Postgres function performs the swap (`recipe*id` + `estado` + `rating` moved together, per the business rule that a swap must be learning-neutral) and explicitly disables/re-enables `recipe*learning*trigger` for the duration, rather than either (a) swapping only `recipe*id` and leaving `estado` in place, or (b) swapping the full bundle and letting the trigger fire as designed.

***Reasoning******:**** both naive alternatives corrupt ADR-0001's learning-moat aggregate data — full analysis (why each naive option fails, the exact trigger mechanics, the chosen fix) lives in ****ADR-0002*** (`.context/ADR/ADR-0002-position-swaps-bypass-learning-trigger.md`), drafted as part of this planning pass.

***ADR-gate verdict******:**** ****DOES qualify for an ADR — promoted, not left here.*** Gate 1 (architectural): passes — it directly interacts with ADR-0001's cross-cutting learning-trigger mechanism, and establishes a pattern (position-changes must bypass the trigger) that any future feature relocating a `meal*plan*recipes.recipe*id` must also follow. Gate 2 (hard-to-reverse): passes — once other code paths start relying on "a swap is learning-neutral," the bypass mechanism becomes load-bearing infrastructure other stories may reuse; getting it wrong corrupts pricing-relevant aggregate data (`recipes.veces*cocinada`/`veces*descartada`/`rating*promedio`) silently, with no natural error signal. See ADR-0002 for the full write-up, alternatives considered, and consequences.

### Decision 5: No no-repeat guard is added for the swap — by mathematical necessity, not oversight

***Finding******:*** the story's own AC/Scope/Business-Rules fields never mention the "no lunch/dinner repeat in the same week" rule (that invariant belongs to FRESCO-7's generation-time `validator.ts`) — and this is correct, not a gap, for a structural reason worth stating explicitly so a reviewer doesn't flag its absence as a missing check.

***Reasoning******:**** a two-slot swap is, by definition, a transposition (a permutation of exactly two elements) applied to the existing 21-recipe assignment. It never introduces a recipe_id that wasn't already somewhere in the plan, and it never removes one — Business Rule 3 states this directly ("el reordenamiento nunca añade, elimina, ni genera espacios nuevos"). Because `validator.ts` already guarantees zero duplicate recipe ids across the combined comida+cena pool (14 slots) at generation time, and a transposition of a duplicate-free set can never produce a duplicate (it only relocates two already-distinct values), ****no swap — same-day, cross-day, same-tipo, or cross-tipo, exactly as AC Scenario 1's own example does (lunes-cena ↔ martes-comida) — can ever violate the no-repeat invariant.*** This holds regardless of which two slots are chosen. No client-side or server-side no-repeat guard is needed for the swap operation itself; the invariant is preserved automatically by the operation's own algebra.

***ADR-gate verdict******:*** not applicable — this is a proof that no new logic is needed, not a decision with an alternative to weigh.

---

## Dependencies

- ***Hard dependency, already satisfied******:*** STORY-FRESCO-7 (Menu Generation) — `getMealPlanForWeek()` and the real, non-mock `/calendar` page this story extends. Confirmed `Finalizada` in Jira.
- ***New dependency introduced******:*** `@dnd-kit/core` (Decision 3) — no existing drag-and-drop library in `package.json`.
- ***New migration introduced******:*** `swap*meal*plan_slots` Postgres function (Decision 4 / ADR-0002) — additive, no changes to existing tables' columns or constraints.
- ***Soft dependency******:*** ADR-0001 (Behavioral-learning moat) — this story's write path must not corrupt its aggregate data; ADR-0002 exists specifically to guarantee that.
- ***Blocks (downstream, noted for ****`/dev-roadmap`****)******:*** none among FRESCO-13/FRESCO-15 depend on this story's completion, per `dev-roadmap.md`'s own note that the three Master-Sprint-1 stories are independent extensions of the same upstream table.

---

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| A naive swap implementation (recipe*id only, or full bundle without disabling the trigger) silently corrupts `recipes.veces*cocinada`/`veces*descartada`/`rating*promedio` — the exact data ADR-0001's Pro pricing is built on | ADR-0002 specifies the correct mechanism explicitly; Step 2's manual SQL verification checks aggregate counters are unchanged before Stage 2 wiring depends on it. |
| `@dnd-kit/core`'s React 19 / Next 16 compatibility is assumed, not yet verified against this repo's actual (breaking-changed) versions | Context7 lookup before Stage 2 implementation, per `AGENTS.md`'s explicit warning — named here rather than assumed. |
| Two-row swap is not natively transactional if implemented as two separate client `.update()` calls | Resolved structurally: the swap is one Postgres function call (Decision 4), not two client calls — atomicity is guaranteed by Postgres, not by client-side error handling. |
| No component-render test suite exists to catch a broken drag interaction before it reaches a human reviewer | Live-UI validation (Playwright CLI) during Stage 2/3 per the sprint-development doctrine is the designated safety net for this gap — named explicitly rather than silently skipped. |
| `swap*meal*plan_slots` has no automated test (no SQL test harness in this repo) | Manual `supabase db reset` + direct SQL exercise required before Stage 2 depends on the function; flagged as a real gap, not assumed safe. |

---

## Estimated Effort

Medium-High — one new SQL function (with a real correctness subtlety around the learning trigger, now resolved via ADR-0002), one small additive change to an already-complete read function, one new pure helper, and one new client component with a new dependency. No changes to `generate-meal-plan/**`, `prompt.ts`, `validator.ts`, or `/menu/page.tsx`.

---

## Definition of Done Checklist

- [ ] `MenuSemanalPersistido.slotIds` added additively; `lib/api/meal-plan.test.ts` covers it; `/menu/page.tsx` unmodified.
- [ ] `swap*meal*plan*slots` migration written, manually verified (ownership check rejects foreign plans, aggregate counters unchanged after a swap, `unique*slot` never violated).
- [ ] `swapMealPlanSlots()` client wrapper implemented + unit-tested (success + error-to-`MealPlanError` cases).
- [ ] `applySlotSwap()` pure helper implemented + unit-tested (distinct-slot swap, self-swap no-op, double-apply reverts to original).
- [ ] `CalendarGrid` built with `@dnd-kit/core` (`PointerSensor` + `KeyboardSensor`), wired into `/calendar/page.tsx`; `AlertBanner` and the empty-state branch unchanged.
- [ ] Optimistic swap + rollback-on-error + inline error message verified live (Playwright CLI) against the running dev server, not just against types/lint/tests.
- [ ] ADR-0002 reviewed and, ideally, moved from `Proposed` to `Accepted` by the founder before or during Stage 2.
- [ ] `bun test`, `bun run types:check`, `bun run lint:check` all pass.
- [ ] Chain strategy (stacked-to-main, 3 PRs — see Review Workload Forecast) confirmed before Stage 2 starts.

---

## Review Workload Forecast

Estimated: 620 additions + 199 deletions = 819 total lines
400-line budget risk: High
Chain strategy: stacked-to-main
Decision needed before apply: No

Notes:

- Suggested 3-PR stack: ***PR1 (data + persistence foundation)**** = `supabase/migrations/<ts>*add*swap*meal*plan*slots*function.sql` (new), `lib/api/meal-plan.ts` (Steps 1 + 3), `lib/api/meal-plan.test.ts`. ****PR2 (pure logic)**** = `lib/calendar/apply-slot-swap.ts` + its test, `package.json` (`@dnd-kit/core`). ****PR3 (interactive UI, largest and most review-sensitive)*** = `components/calendar/calendar-grid.tsx`, `app/(app)/calendar/page.tsx` — reuses PR1+PR2 primitives, smallest diff-to-risk ratio of the three since the hard correctness work already landed.
- `calendar-grid.tsx` is the single biggest line-count driver in this estimate (dnd-kit wiring, 21 slot handlers, optimistic/rollback state, inline error UI) — if it comes in smaller than estimated in practice, overall risk may land in the upper end of Medium rather than High; the `pending`→resolved chain strategy above is deliberately conservative given that uncertainty.
- ADR-0002 itself is a `.context/ADR/` document, not application code — excluded from the line count above (matches the "generated/non-reviewed-as-code" spirit of the buffer notes, though this one is dev-authored prose, not generated).

---


_Synced from Jira by sync-jira-issues_
