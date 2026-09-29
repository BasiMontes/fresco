'use client';

import type { Recipe } from '@schemas';
import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import type { SlotKey } from '@/lib/calendar/apply-slot-swap';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Ban, Check, GripVertical, UtensilsCrossed, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { RecipeCardMedia } from '@/components/recipe/recipe-card-media';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { slotId } from '@/lib/calendar/apply-slot-swap';
import { firstActiveDietaLabel } from '@/lib/recipes/labels';
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
 * `(dia, tipo)` slot. `useDraggable`/`useDroppable` are two independent
 * dnd-kit hooks; their `setNodeRef` callbacks are chained onto the same DOM
 * node via `setRefs` below (dnd-kit tracks draggable/droppable ids in
 * separate registries, so reusing the same composite id for both is safe).
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
 */
export function SlotCell({ dia, tipo, recipe, dbSlotId, estado, pending, dropDisabled, onMark, priority }: SlotCellProps) {
  const router = useRouter();
  const slotKey: SlotKey = { dia, tipo };
  const id = slotId(slotKey);

  // FR-8.2 / AC Scenario 4 (FRESCO-23): a slot with no safe recipe can't be
  // dragged (nothing to move) or dropped onto (nothing to swap into) — out
  // of scope per the tech-debt's own plan, kept simple rather than teaching
  // `applySlotSwap()` a null-aware swap it has no real use case for yet.
  const disabled = pending || recipe === null;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id, data: slotKey, disabled });

  // A slot never accepts a drop from a different `tipo` (see `draggingTipo`
  // in the parent) — disabling the droppable outright, not just styling it
  // differently, means dnd-kit's own `over` never resolves to this cell, so
  // there is nothing for `handleDragEnd`'s guard to even need to catch.
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, data: slotKey, disabled: disabled || dropDisabled });

  const setRefs = React.useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );

  const dietaLabel = recipe ? firstActiveDietaLabel(recipe.dieta) : null;

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
      onClick={recipe && !disabled ? () => router.push(`/recipes/${recipe.id}?slot=${dbSlotId}`) : undefined}
      role={recipe && !disabled ? 'link' : undefined}
      tabIndex={recipe && !disabled ? 0 : undefined}
      onKeyDown={recipe && !disabled
        ? (event) => {
            if (event.key === 'Enter' && event.target === event.currentTarget) {
              router.push(`/recipes/${recipe.id}?slot=${dbSlotId}`);
            }
          }
        : undefined}
      className={cn(
        'flex flex-col rounded-card border border-border bg-surface-raised shadow-sm transition-shadow',
        !disabled && recipe && 'cursor-pointer hover:shadow-md',
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
          overlay={tipo !== 'desayuno' && (
            /*
              FRESCO-159 — no drag handle for desayuno: user-reported
              finding, breakfast slots don't need drag & drop. Not
              rendering the handle is sufficient to disable dragging
              entirely — no need to also flip `useDraggable`'s `disabled`.

              Drag activation listeners live ONLY on this handle, not the
              whole cell (dnd-kit's documented "drag handle" pattern) —
              spreading them on the outer div, as before FRESCO-15, made
              the entire cell a drag source, so the PointerSensor captured
              every pointerdown on the mark buttons below and the drag
              gesture fired instead of their onClick.
            */
            <Button
              type="button"
              variant="icon"
              size="sm"
              {...listeners}
              {...attributes}
              aria-label="Arrastrar para reordenar"
              disabled={disabled}
              // STORY-FRESCO-88 — dnd-kit's own pointer handling (via
              // `listeners`) must still fire, so no `preventDefault()`
              // here; only stop the `click` from bubbling into the
              // cell's navigation `onClick`.
              onClick={event => event.stopPropagation()}
              // FRESCO-170 — no `touch-none` here (was `cursor-grab
              // touch-none`): `touch-action: none` disables the browser's
              // native touch scrolling unconditionally for any touch that
              // starts on this element, regardless of dnd-kit's own
              // activation logic. The `sensors` activationConstraints
              // arbitrate scroll-vs-drag intent instead.
              className="absolute left-2 top-2 cursor-grab disabled:cursor-not-allowed"
            >
              <GripVertical className="size-6" />
            </Button>
          )}
        />
      )}

      <div className="flex flex-1 flex-col p-3">
        {recipe
          ? (
              <>
                <p className="text-h6 uppercase text-tertiary">{recipe.clasificacion?.categoria ?? '—'}</p>
                <h3 className={cn('line-clamp-2 text-h5', estado === 'descartada' && 'line-through')}>{recipe.nombre}</h3>
                {dietaLabel && (
                  <div className="mt-1">
                    <Tag variant="accent">{dietaLabel}</Tag>
                  </div>
                )}
              </>
            )
          : estado === 'excluida'
            ? (
                // FRESCO-451: a bare italic line read as an unfinished slot,
                // not a designed empty state — a small icon (mirroring
                // `EmptyState`'s icon-above-copy shape, scaled down for this
                // compact cell) gives it the same visual language.
                <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
                  <Ban className="size-5 text-tertiary" aria-hidden="true" />
                  <p data-testid={`calendar_slot_${dia}_${tipo}_excluida`} className="text-body-sm italic text-tertiary">
                    Excluida por ti
                  </p>
                </div>
              )
            : (
                <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
                  <UtensilsCrossed className="size-5 text-tertiary" aria-hidden="true" />
                  <p data-testid={`calendar_slot_${dia}_${tipo}_sin_receta`} className="text-body-sm italic text-tertiary">
                    Sin receta
                  </p>
                </div>
              )}

        {recipe && estado === 'pendiente' && (
          // FRESCO-373 (A4-M27): was a pair of ~24px icon-only buttons pinned
          // bottom-right — the single interaction the paid tier depends on.
          // Now two full-width labelled buttons, ≥44px tall (WCAG 2.5.5).
          <div className="mt-auto flex gap-2 pt-3">
            <button
              type="button"
              data-testid={`calendar_slot_${dia}_${tipo}_mark_cocinada`}
              aria-label="Marcar como cocinado"
              disabled={pending}
              onClick={(event) => {
                event.stopPropagation();
                onMark('cocinada');
              }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-neutral-600 text-body-sm font-semibold text-tertiary transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-65"
            >
              <Check className="size-4 shrink-0" />
              Cocinado
            </button>
            <button
              type="button"
              data-testid={`calendar_slot_${dia}_${tipo}_mark_descartada`}
              aria-label="Marcar como descartado"
              disabled={pending}
              onClick={(event) => {
                event.stopPropagation();
                onMark('descartada');
              }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-neutral-600 text-body-sm font-semibold text-tertiary transition-colors hover:border-error hover:text-error disabled:pointer-events-none disabled:opacity-65"
            >
              <X className="size-4 shrink-0" />
              Descartar
            </button>
          </div>
        )}

        {recipe && estado !== 'pendiente' && (
          <p
            data-testid={`calendar_slot_${dia}_${tipo}_estado_badge`}
            className={cn(
              'mt-auto pt-2 text-right text-caption uppercase',
              estado === 'cocinada' ? 'text-primary' : 'text-tertiary',
            )}
          >
            {estado === 'cocinada' ? 'Cocinado' : 'Descartado'}
          </p>
        )}
      </div>
    </div>
  );
}
