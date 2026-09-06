# Comments for FRESCO-441

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-441)

---

### Basi Montes - 9/5/2026, 5:40:51 PM

## Acceptance Criteria

### Escenario: foto protagonista

- ***Dado*** una card con foto
- ***Entonces*** la foto ocupa la zona superior, sin borde, con radio 16–20
- ***Y*** el título no compite con ella (2 líneas máx, peso calmado)

### Escenario: placeholder que es decisión de diseño

- ***Dado*** una card sin foto
- ***Entonces*** muestra un gradiente monocromo por categoría o una inicial tipográfica
- ***Y*** una rejilla con mezcla de cards con y sin foto se ve coherente, no rota

### Escenario: misma card en todas partes

- ***Dado*** Menú, Calendario y Biblioteca
- ***Entonces*** la card de receta es el mismo componente con la misma anatomía

---

### Basi Montes - 9/6/2026, 12:53:51 PM

## Spec Implementation Plan (Dev) — FRESCO-441

### Goal

Redesign the recipe card into a photo-forward, editorial unit with a designed
no-photo placeholder (category gradient + typographic initial), and make Menú,
Calendario and Biblioteca render the **same** component anatomy.

### Context

- Epic FRESCO-436 (editorial redesign). Blockers FRESCO-438 (type) + FRESCO-439

  (components) are Finalizada.

- `DESIGN.md` §Components `recipe-card` (line ~370) is the frozen contract:

  photo leads, full-width image at top (`rounded.image` 16px, `object-fit:cover`),
  title below in Figtree capped 2 lines (`typography.h5`), meta + single tag
  secondary, favourite `button-icon` top-right over the photo; no-photo state =
  designed placeholder (monochrome gradient keyed to meal category OR typographic
  initial) — never a lone line-icon. Same component + element order on
  `/menu`, `/calendar`, `/recipes`.

- One-accent discipline (FRESCO-440): placeholder gradient stays in the warm

  `neutral-*` ramp — no orange/accent-2.

- FRESCO-447 owns the final photo ratio + grade unifier — 441 keeps `aspect-[4/3]`.
- Not in master-design-plan §8 (redesign-epic stories generally aren't). Rule 14:

  build LIVE-UI-FIRST against live components + DESIGN.md contract, then UPSERT a
  §8 row + note as part of this story. No hard stop.

### Current state

- `components/recipe/recipe-card.tsx` — canonical card. Image area is inset by the

  card's `p-3` (reads "framed"), sits in `bg-neutral-200` box, `text-h4` title,
  no-photo = `<CategoryIcon>` from `lib/recipes/category-icon.tsx`.

- `components/recipe/favorite-recipe-card.tsx` — client wrapper, optimistic toggle.
- `components/recipes/personal-recipe-card.tsx` — bespoke (no photo ever),

  `<NotebookPen>` icon on `bg-neutral-200`.

- `components/calendar/calendar-grid.tsx` `SlotCell` — hand-mirrors the card

  anatomy (image area + kicker + title + tag) + drag handle overlay + mark-status
  controls. Not `<RecipeCard>`.

- Render sites in scope: `/menu` (`latest-recipes-section.tsx`, `menu/page.tsx`

  "hoy" slots), `/calendar` (`calendar-grid.tsx`), `/recipes`
  (`recipe-library.tsx` — favorite grid + personal grid). `/favorites`
  (`favorites-grid.tsx`) inherits for free.

- `MenuHistoryCard` (`/profile`) is NOT a recipe card — out of scope.
- `rounded-image` / `rounded-card` already in `tailwind.config`. No recipe-card

  unit tests today.

### Tasks

1. `lib/recipes/category-gradient.ts`*** (new)*** — `categoryGradient(categoria)` →

   `{ from, to }` classes (or CSS vars) drawn from the warm `neutral-*` ramp,
   one stable hue pair per `CategoriaReceta` (12 values) + `ChefHat`-equivalent
   default for `null`. Pure data, no JSX, server-safe (mirrors `category-icon`
   split rationale but no `'use client'`).
   verify: `bun run build` clean; unit test maps all 12 + null.

1. `components/recipe/recipe-placeholder.tsx`*** (new)*** — `<RecipePlaceholder

   name categoria className />`. Renders a subtle monochrome gradient background
   (from task 1) + the recipe name's first grapheme, uppercased, in the Fraunces
   display face (`font-display`, low-contrast e.g. `text-neutral-500/70`),
   centered, `aria-hidden`. Fills its parent (absolute inset-0 or `size-full`).
   Empty/whitespace name → fall back to category initial or a neutral glyph, not
   a crash.
   verify: unit test — renders initial for "Paella" → "P"; handles ""/emoji-first.

1. `components/recipe/recipe-card-media.tsx`*** (new)*** — `<RecipeCardMedia recipe

   priority overlay className />`. Owns the photo-vs-placeholder decision:
   `aspect-[4/3] w-full overflow-hidden rounded-image` (no `bg-neutral-200`,
   no border), `next/image` `fill object-cover` when `foto_url`, else
   `<RecipePlaceholder>`. `overlay` slot renders on top (favourite heart / drag
   handle). This is the single shared media primitive.
   verify: unit test — photo branch renders `<img>`; no-photo renders placeholder;
   overlay node present.

1. `components/recipe/recipe-card.tsx`*** (rework)*** — consume `RecipeCardMedia`.

   Photo goes ***full-bleed***: media is flush to the card's top/left/right edges
   (card keeps `rounded-card` + hairline + `surface-raised`; move `p-3` off the
   root onto a body wrapper only, media has no padding, `rounded-image` corners
   sit inside the card's larger radius). Favourite `Button` passed via `overlay`.
   Title → `text-h5` (was `text-h4`), keep `line-clamp-2`. Kicker / tag / meta
   unchanged (already secondary). Keep the FRESCO-78 `h-full flex flex-col` +
   `flex-1`-compose contract and the FRESCO-248 like-burst wiring.
   verify: `bun run lint:check` + `build` + component tests green; live `/menu`,
   `/favorites`, `/recipes`.

1. `components/recipes/personal-recipe-card.tsx`*** (update)*** — swap the

   `<NotebookPen>`-on-`bg-neutral-200` block for `<RecipePlaceholder name={
   receta.nombre} categoria={null} />` inside a `rounded-image` media box, so a
   mixed `/recipes` grid (catalog + personal) reads coherent. Keep the "Tu receta"
   tag + ingredient count. Title stays `text-h5`. No photo support (RecetaPropia
   has none) — placeholder only.
   verify: live `/recipes` personal grid; unit test unchanged shape.

1. `components/calendar/calendar-grid.tsx`*** ****`SlotCell`**** (update)*** — replace the

   hand-rolled image-area `<div>` (photo/`CategoryIcon`) with `<RecipeCardMedia
   recipe={recipe} priority={priority} overlay={dragHandle} />`. Drag handle
   (`GripVertical` button, `tipo !== 'desayuno'`) moves into the `overlay` slot,
   top-left, listeners/attributes unchanged. Title already `text-h5` — keep.
   Keep the FRESCO-80 drag/drop, FRESCO-88 keyboard-nav, FRESCO-159/170/373
   contracts. Remove now-unused `getCategoryIcon` import if nothing else needs it.
   verify: `bun run test:e2e` calendar scenarios green (dnd-kit 8px drag,
   windowed grid); live `/calendar` drag + mark + no-photo slot.

1. ***Placeholder icon cleanup*** — `lib/recipes/category-icon.tsx` is now only used

   (if at all) by non-card surfaces. Grep; if fully orphaned, note it for a
   follow-up (don't delete in this PR unless trivially safe). `getCategoryIcon`
   stays if `recipe-detail` or others still use it.

1. `.context/design/master-design-plan.md` — UPSERT a §8 US→Screen row for

   FRESCO-441 (Primary screen: 4.10 Recipe library; Also touches: 4.7 Home /menu,
   4.8 Calendar, 4.12 Favorites) + a one-line §5 note that the photo-forward
   `recipe-card` + `RecipePlaceholder` landed here against the DESIGN.md contract.

1. ***Tests (****`bun`**** component tests, happy-dom + RTL)*** — `recipe-card.test.tsx`

   (photo branch, no-photo branch renders placeholder not icon, title is h5,
   favourite overlay present, click-through to detail), `recipe-placeholder.test.tsx`
   (initial extraction, empty name, all-category gradient map). Re-register preload
   in `beforeEach` per the GH-Actions infra gotcha (FRESCO-409). No `mock.module`
   on `@api`.

### Technical decisions (story-local, not ADR)

- ***Shared media primitive over full component reuse in calendar.*** `SlotCell`

  needs a drag handle, root click-nav, and bottom mark-status controls that
  `RecipeCard` has no reason to carry. Extracting `RecipeCardMedia` (the part
  that's genuinely identical) and letting `SlotCell` compose it beats forcing a
  slot-heavy `<RecipeCard>` that serves two masters. Title/kicker/tag markup
  (~4 lines) stays duplicated — cheaper than a second shared component for a
  trivial block.

- ***Gradient in the neutral ramp, keyed by category, + Fraunces initial.***

  Gradient alone is too quiet for recognisability across a grid; initial alone
  loses the "designed surface" read. Both together = coherent mixed grid.
  Neutral ramp only (no accent-2) respects one-accent discipline (FRESCO-440).

- `aspect-[4/3]`*** retained.*** FRESCO-447 owns the final ratio/grade unifier;

  changing it here would pre-empt that card.

### AC → task map

| AC scenario | Task(s) |
| --- | --- |
| Foto protagonista (no border, radius 16–20, title doesn't compete) | 3, 4 |
| Placeholder que es decisión de diseño (gradient/initial, mixed grid coherent) | 1, 2, 3, 5 |
| Misma card en todas partes (Menú/Calendario/Biblioteca same component anatomy) | 3, 4, 6 |

### Out of scope

- Photo ratio/grade unifier → FRESCO-447.
- Photo coverage ≥90% → FRESCO-442.
- `MenuHistoryCard` (profile) — not a recipe card.

### Review Workload Forecast

Estimated: ~300 additions + ~70 deletions = ~370 total lines
400-line budget risk: Medium
Chain strategy: single PR (solo-main)
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
