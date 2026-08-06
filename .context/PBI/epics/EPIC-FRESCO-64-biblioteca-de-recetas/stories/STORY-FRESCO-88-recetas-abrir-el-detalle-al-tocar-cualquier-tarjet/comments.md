# Comments for FRESCO-88

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-88)

---

### Basi Montes - 8/6/2026, 4:46:23 PM

## Acceptance Criteria

```gherkin
Feature: Abrir el detalle de receta desde cualquier tarjeta

Scenario: Abrir detalle desde el menú de hoy en Inicio
  Given que tengo un menú generado para hoy
  When toco la tarjeta de una de mis comidas de hoy
  Then se abre el detalle completo de esa receta

Scenario: Abrir detalle desde "Últimas recetas añadidas" en Inicio
  Given que estoy en Inicio
  When toco una tarjeta de la sección "Últimas recetas añadidas"
  Then se abre el detalle completo de esa receta

Scenario: Abrir detalle desde una tarjeta del Calendario
  Given que estoy viendo mi Calendario semanal
  When toco la tarjeta de una comida planificada
  Then se abre el detalle completo de esa receta

Scenario: Las acciones propias de la tarjeta del Calendario no abren el detalle por accidente
  Given que estoy viendo mi Calendario semanal
  When arrastro una tarjeta para reordenarla, o toco marcar como cocinada/descartada
  Then esa acción se ejecuta normalmente
  And no se abre el detalle de la receta
```

## Scope

- Tocar una tarjeta de receta en "Inicio" (menú de hoy, y "últimas recetas añadidas") abre el detalle de esa receta.
- Tocar una tarjeta de receta en el Calendario abre el detalle de esa receta.
- Las acciones propias de cada tarjeta (guardar en favoritos, marcar como cocinada/descartada, arrastrar para reordenar) siguen funcionando sin abrir el detalle por error.

## Out of Scope

- Biblioteca de Recetas y Favoritos: ya abren el detalle al tocar una tarjeta (implementado en FRESCO-69) — sin cambios ahí.
- Cambios al contenido o diseño del propio detalle de receta — esta historia es solo de navegación de entrada, no toca la pantalla de destino.

---

### Basi Montes - 8/6/2026, 4:52:23 PM

## Spec Implementation Plan (Dev)

### Goal

Every recipe card in the app opens the recipe detail (`/recipes/[id]`) on tap. Already true in the Biblioteca catalog, "Tus recetas", and Favorites (all wrapped in `next/link`). Three surfaces still miss it: Inicio's "hoy" cards, Inicio's "Últimas recetas añadidas" strip, and every Calendar slot cell.

### AC → implementation step mapping

| Gherkin scenario | File | Step |
| --- | --- | --- |
| Abrir detalle desde el menú de hoy en Inicio | `app/(app)/menu/page.tsx` | Step 1 |
| Abrir detalle desde "Últimas recetas añadidas" en Inicio | `components/menu/latest-recipes-section.tsx` | Step 2 |
| Abrir detalle desde una tarjeta del Calendario | `components/calendar/calendar-grid.tsx` (`SlotCell`) | Step 3 |
| Las acciones propias de la tarjeta del Calendario no abren el detalle por accidente | `components/calendar/calendar-grid.tsx` (`SlotCell`) | Step 4 |

### Step 1 — `app/(app)/menu/page.tsx` (~line 176-186)

Wrap the existing `<FavoriteRecipeCard recipe={hoy[slot]} .../>` in `<Link href={`/recipes/${hoy[slot].id}`}>`, same pattern already used by `recipe-library.tsx` and `favorites/page.tsx`. `Link` is already imported in this file (used for `/favorites`, `/notifications`, `/calendar`). No new import needed. Low risk, ~3 lines.

### Step 2 — `components/menu/latest-recipes-section.tsx` (~line 55-62)

Wrap each `<FavoriteRecipeCard>` inside the `.map()` in `<Link href={`/recipes/${recipe.id}`}>`. `Link` is already imported (used for "Ver todas"). Low risk, ~3 lines.

### Step 3 & 4 — `components/calendar/calendar-grid.tsx` (`SlotCell`, ~line 327-470) — the real technical decision

***dnd-kit finding (verified via Context7, ****`/clauderic/dnd-kit`****, ****`@dnd-kit/core`**** v6.3.1 — the version installed in this repo)******:**** dnd-kit's `PointerSensor` only treats an element as a drag activator where the hook's `listeners` object (`onPointerDown`/`onKeyDown`, etc.) is explicitly spread. `useDraggable`'s `setNodeRef` alone (used for measuring/transform) does ****not*** attach any pointer listeners.

In this codebase, `{...listeners}` is spread ***only**** on the `GripVertical` drag-handle `<Button>` (line ~404-415) — not on the outer `SlotCell` div. That isolation is the FRESCO-15 fix already in place (documented in the code comment at line ~394-402): the historical bug was `{...listeners}` on the **whole cell*, so `PointerSensor` captured every pointerdown, including clicks meant for the mark-cocinada/descartada buttons. That bug is about drag-listener placement, not about `onClick` in general — confirmed by reading dnd-kit's sensor source: the sensor never listens outside the elements it's told to listen on.

***Consequence******:*** adding a plain `onClick` handler to the `SlotCell` root `<div>` (the one holding `ref={setRefs}`) is safe from dnd-kit's perspective — the `PointerSensor` has no listeners there today and this plan does not add any. No `activationConstraint` change is needed and the existing `useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))` config stays untouched.

***Remaining real risk (not dnd-kit's sensor, plain DOM event bubbling)******:*** the drag-handle button and the two mark-cocinada/mark-descartada buttons are DOM descendants of the cell. A `click` DOM event on any of them bubbles to a parent `onClick` unless stopped — same reason `recipe-card.tsx:96-103`'s favorite heart calls `event.preventDefault(); event.stopPropagation();` inside its own `onClick`. Apply the identical pattern to all three controls in `SlotCell`:

- The `GripVertical` drag-handle `<Button>` currently has no `onClick` of its own (only `{...listeners}` + `{...attributes}`) — add one that calls `event.stopPropagation()` (no `preventDefault`, since dnd-kit's own pointer handling must still fire).
- `mark_cocinada` button's existing `onClick={() => onMark('cocinada')}` — add `event.stopPropagation()` as the first line.
- `mark_descartada` button's existing `onClick={() => onMark('descartada')}` — same.

***Step 3 (navigation)******:**** add `onClick` on the `SlotCell` root div, guarded by `recipe !== null` (a `Sin receta segura` slot has nothing to open) and by `!disabled`/`!pending` (consistent with the existing drag/drop disabled logic). Use `useRouter()` from `next/navigation` (file is already `'use client'`) and `router.push(`/recipes/${recipe.id}`)` — ****not*** a `<Link>` wrap, because `SlotCell`'s root already hosts two `<button>` descendants (drag handle + mark controls) and nesting interactive elements inside an `<a>` is invalid HTML; `router.push` avoids that entirely. Add `cursor-pointer` to the root's className when a recipe is present, for a visible affordance.

***Step 4 (no accidental navigation)******:*** the three `stopPropagation()` additions above, applied together with Step 3's `onClick`, satisfy Scenario 4 structurally — the click never reaches the parent handler when it originates on drag-handle/mark controls.

### Residual risk — flagged, not blocking

`stopPropagation()` on a `click` event guards against the DOM bubbling path. It does ***not**** by itself prove that a real drag gesture (pointerdown on the handle → move → drop elsewhere) never also fires a stray native `click` on the parent afterward — browser click-after-drag suppression behavior for pointer-events-based libraries (not native HTML5 DnD) was not exhaustively verified against this exact dnd-kit version in static research. Context7 doc snippets for the **newer** `@dnd-kit/dom` package show it explicitly registers a `preventDefault`-on-click listener during an active drag; whether `@dnd-kit/core` v6.3.1 (the version actually installed here) does the same was not confirmed. ****Action******:*** verify live during Stage 2 — perform a real drag-and-drop reorder in the running dev server and confirm no navigation fires on drop. Non-blocking (structurally the click is scoped to the handle/buttons, which already stopPropagation), but called out explicitly per the "don't hide open risk" instruction.

### Out of scope (per story's own Jira Out of Scope field)

- `/recipes` (Biblioteca) and `/favorites` — already wired via FRESCO-69, no changes.
- Recipe detail screen content/design — navigation-only story.

### Live-UI validation (Stage 2/3, per sprint-development doctrine)

UI story — validate against the running dev server, not a production build. Check on both desktop and mobile viewport per the story's own Definition of Done ("Revisado en desktop y mobile"): tapping a "hoy" card, a "Últimas recetas" card, and a Calendar slot each opens `/recipes/[id]`; dragging a Calendar slot still reorders; tapping mark-cocinada/descartada still marks state, in neither case navigating away.

## Review Workload Forecast

Estimated: ~24 additions + ~4 deletions = ~28 total lines
400-line budget risk: Low
Chain strategy: stacked-to-main
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
