'use client';

import type { Recipe } from '@schemas';
import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import type { SlotKey } from '@/lib/calendar/apply-slot-swap';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { SlotContent } from '@/components/calendar/slot-content';
import { SlotDragHandle } from '@/components/calendar/slot-drag-handle';
import { SlotEstadoBadge, SlotMarkControls } from '@/components/calendar/slot-mark-controls';
import { useSlotDnd } from '@/components/calendar/use-slot-dnd';
import { RecipeCardMedia } from '@/components/recipe/recipe-card-media';
import { cn } from '@/lib/utils';

export interface SlotCellProps {
  dia: DiaSemana
  tipo: TipoPlato
  /** `null` — FR-8.2 / AC Scenario 4 (FRESCO-23): no safe recipe for this slot. */
  recipe: Recipe | null
  /** FRESCO-534 — the real `meal_plan_recipes.id`, threaded to the recipe-detail link so it can scope the ingredient-substitution UI to this slot. Distinct from `slotId(slotKey)`, the client-side dnd-kit registry key. */
  dbSlotId: string
  /** STORY-FRESCO-15 — current terminal state; gates the mark buttons vs a status badge. */
  estado: EstadoRecetaSlot
  /** True while this slot is part of an in-flight swap or mark-status call — blocks both. */
  pending: boolean
  /** True while a slot of a DIFFERENT `tipo` is being dragged — this cell can never be a valid drop target for it. */
  dropDisabled: boolean
  /** STORY-FRESCO-15 — marks this slot cocinada/descartada; no-ops if not pendiente. */
  onMark: (estado: 'cocinada' | 'descartada') => void
  /** FRESCO-183 — true for slots in the grid's visible (unscrolled) day range; loads the image eagerly instead of lazily. */
  priority: boolean
}

/**
 * One grid cell — both a drag source and a drop target for its own
 * `(dia, tipo)` slot (`useSlotDnd`).
 *
 * FRESCO-80 — full `RecipeCard`-style treatment (image area, category
 * kicker, title, one diet tag) instead of the old compact icon+name row.
 * Column width dropped from `w-64` to `w-60` to match `RecipeCard`'s own
 * width elsewhere (`/menu`, `/recipes`, `/favorites`). Not literally
 * `<RecipeCard>` — this cell needs the drag handle and mark-status
 * controls that component doesn't have.
 *
 * FRESCO-441 — the image area is now the SHARED `RecipeCardMedia` (photo, or
 * the designed `RecipePlaceholder` — category gradient + typographic initial,
 * never a bare icon), so `/calendar` renders the same photo-forward anatomy
 * as `/menu` and `/recipes`. The media is full-bleed at the top of the cell
 * (it rounds its own top corners to the card radius); the kicker/title/tag
 * and the mark-status controls live in a padded body below it. The drag
 * handle rides on the media (top-left, mirroring where `RecipeCard`'s
 * favourite heart sits) via the media's `overlay` slot. Mark-status controls
 * stay pinned to the bottom (`mt-auto`) — STORY-FRESCO-15, a buttons row
 * competing for width with a long title collapses the title's wrapper.
 *
 * FRESCO-809 — split: drag wiring in `useSlotDnd` + `SlotDragHandle`, body in
 * `SlotContent`, mark controls in `slot-mark-controls.tsx`. This file only
 * composes them and owns the navigation + root styling.
 */
export function SlotCell({ dia, tipo, recipe, dbSlotId, estado, pending, dropDisabled, onMark, priority }: SlotCellProps) {
  const router = useRouter();
  const slotKey: SlotKey = { dia, tipo };

  // FR-8.2 / AC Scenario 4 (FRESCO-23): a slot with no safe recipe can't be
  // dragged (nothing to move) or dropped onto (nothing to swap into) — out
  // of scope per the tech-debt's own plan, kept simple rather than teaching
  // `applySlotSwap()` a null-aware swap it has no real use case for yet.
  const disabled = pending || recipe === null;

  const { setRefs, attributes, listeners, transform, isDragging, isOver } = useSlotDnd({ slotKey, disabled, dropDisabled });

  const openRecipe = recipe && !disabled
    ? () => router.push(`/recipes/${recipe.id}?slot=${dbSlotId}`)
    : undefined;

  return (
    <div
      ref={setRefs}
      data-testid={`calendar_slot_${dia}_${tipo}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      /*
       * STORY-FRESCO-88 — plain `onClick`, not a `<Link>` wrap: this root
       * already hosts nested `<button>` descendants (drag handle + mark
       * controls), and nesting interactive elements inside an `<a>` is
       * invalid HTML. `disabled` (pending || no recipe) covers both "nothing
       * to open" and "swap/mark in flight" cases. The three controls below
       * stop propagation on their own `onClick`/`pointerdown` so a tap on
       * them never bubbles up to this handler — same pattern as the
       * favorite heart in `recipe-card.tsx`.
       *
       * `role`/`tabIndex`/`onKeyDown` (Enter) — a plain `onClick` div is
       * mouse/touch-only; the Inicio surfaces this story also touches use a
       * real `<Link>` (keyboard-accessible for free), so without these this
       * cell would be the one surface in the story a keyboard user can't
       * reach. `event.target === event.currentTarget` guards against the
       * keydown bubbling up from the nested drag-handle/mark buttons when
       * THEY are activated via Enter — those already `stopPropagation()` on
       * `click`, but a native button's `keydown` bubbles independently of
       * that, so the guard is the actual fix, not the stopPropagation.
       */
      onClick={openRecipe}
      role={openRecipe ? 'link' : undefined}
      tabIndex={openRecipe ? 0 : undefined}
      onKeyDown={openRecipe
        ? (event) => {
            if (event.key === 'Enter' && event.target === event.currentTarget) {
              openRecipe();
            }
          }
        : undefined}
      className={cn(
        'flex flex-col rounded-card border border-border bg-surface-raised shadow-sm transition-shadow',
        openRecipe && 'cursor-pointer hover:shadow-md',
        isDragging && 'z-10 opacity-50',
        isOver && 'ring-2 ring-accent-500',
        pending && 'cursor-wait opacity-70',
        estado === 'descartada' && 'opacity-60',
      )}
    >
      {recipe && (
        <RecipeCardMedia
          fotoUrl={recipe.foto_url}
          nombre={recipe.nombre}
          categoria={recipe.clasificacion?.categoria}
          priority={priority}
          sizes="240px"
          // FRESCO-159 — no drag handle for desayuno: user-reported finding,
          // breakfast slots don't need drag & drop. Not rendering the handle
          // is sufficient to disable dragging entirely — no need to also flip
          // `useDraggable`'s `disabled`.
          overlay={tipo !== 'desayuno' && (
            <SlotDragHandle listeners={listeners} attributes={attributes} disabled={disabled} />
          )}
        />
      )}

      <div className="flex flex-1 flex-col p-3">
        <SlotContent dia={dia} tipo={tipo} recipe={recipe} estado={estado} />

        {recipe && estado === 'pendiente' && (
          <SlotMarkControls dia={dia} tipo={tipo} pending={pending} onMark={onMark} />
        )}

        {recipe && estado !== 'pendiente' && (
          <SlotEstadoBadge dia={dia} tipo={tipo} estado={estado} />
        )}
      </div>
    </div>
  );
}
