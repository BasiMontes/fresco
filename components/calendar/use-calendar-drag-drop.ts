import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DiaSemana, TipoPlato } from '@/lib/api/types';
import type { MenuGrid, SlotKey } from '@/lib/calendar/apply-slot-swap';
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import * as React from 'react';
import { MealPlanError, swapMealPlanSlots } from '@/lib/api/meal-plan';
import { applySlotSwap, slotId } from '@/lib/calendar/apply-slot-swap';

export interface UseCalendarDragDropArgs {
  supabase: SupabaseClient
  slotIds: Record<DiaSemana, Record<TipoPlato, string>>
  setMenu: React.Dispatch<React.SetStateAction<MenuGrid>>
  setErrorMessage: (message: string | null) => void
  pendingSlots: ReadonlySet<string>
  setPendingSlots: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>
}

/**
 * STORY-FRESCO-11/FRESCO-170 — owns `@dnd-kit`'s sensors plus the
 * drag-start/drag-end handlers for the calendar grid: optimistic
 * `applySlotSwap()` on drop, `swapMealPlanSlots()` in the background, revert
 * + inline error on failure. Extracted from `CalendarGrid` (A5-M1,
 * god-component split) — no behavior change from the original inline
 * implementation.
 */
export function useCalendarDragDrop({ supabase, slotIds, setMenu, setErrorMessage, pendingSlots, setPendingSlots }: UseCalendarDragDropArgs) {
  // Tracks the `tipo` of the slot currently being dragged so every OTHER
  // `SlotCell` can disable itself as a drop target for the duration — a
  // franja never accepts a recipe from a different meal type (see the
  // `from.tipo !== to.tipo` guard in `handleDragEnd` below, and the real
  // enforcement in `swap_meal_plan_slots()`). `null` when nothing is being
  // dragged.
  const [draggingTipo, setDraggingTipo] = React.useState<TipoPlato | null>(null);

  // FRESCO-170 — split mouse vs touch instead of one shared `PointerSensor`,
  // each with its own activation constraint, because the two inputs need
  // opposite disambiguation strategies on the same 36×36 drag handle:
  //  - Mouse: `distance: 8` — a drag starts the moment the pointer travels
  //    8px, matching the previous snappy desktop feel.
  //  - Touch: `delay: 200, tolerance: 8` (long-press) — a quick swipe that
  //    starts on the handle is released back to the browser as a scroll
  //    within the 200ms window (see `hasExceededDistance` cancelling the
  //    pending drag in dnd-kit's `AbstractPointerSensor.handleMove`); only a
  //    press-and-hold activates a drag. A touch-side `distance` constraint
  //    alone doesn't work here — once the handle's `touch-action: none` is
  //    removed (see below), the browser can commit to native scrolling
  //    within the first few px of *any* touch move, and dnd-kit's later
  //    `preventDefault()` can no longer cancel a scroll already in
  //    progress. `delay` sidesteps the race entirely: nothing moves during
  //    the hold, so the browser never starts scrolling in the first place.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    const from = event.active.data.current as SlotKey | undefined;
    setDraggingTipo(from?.tipo ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTipo(null);
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const from = active.data.current as SlotKey | undefined;
    const to = over.data.current as SlotKey | undefined;
    if (!from || !to) {
      return;
    }

    // Each slot's `tipo` is fixed at generation time — a reorder can only
    // move a recipe to a different DAY, never a different meal type. The
    // real enforcement lives in `swap_meal_plan_slots()` itself (rejects a
    // mismatched swap outright); this is the UX-level guard so a mismatched
    // drag never even starts the optimistic update or the RPC round trip.
    if (from.tipo !== to.tipo) {
      return;
    }

    const fromId = slotId(from);
    const toId = slotId(to);
    if (pendingSlots.has(fromId) || pendingSlots.has(toId)) {
      return;
    }

    setMenu(current => applySlotSwap(current, from, to));
    setErrorMessage(null);
    setPendingSlots(current => new Set(current).add(fromId).add(toId));

    const slotAId = slotIds[from.dia][from.tipo];
    const slotBId = slotIds[to.dia][to.tipo];

    void swapMealPlanSlots(supabase, { slotAId, slotBId })
      .catch((error) => {
        console.error('[CalendarGrid] swapMealPlanSlots failed, reverting', error);
        setMenu(current => applySlotSwap(current, from, to));
        // FRESCO-47: `MealPlanError` wraps a real RPC rejection (stale data —
        // the slot or its meal plan changed under us, e.g. another tab) —
        // distinct from a network/timeout failure, which throws a plain
        // fetch/TypeError instead. Same narrowing precedent as onboarding's
        // 422-vs-generic split, applied to this path's own error shape.
        setErrorMessage(
          error instanceof MealPlanError
            ? 'No se pudo guardar el nuevo orden: el menú cambió mientras tanto. Actualiza la página.'
            : 'No se pudo guardar el nuevo orden. Revisa tu conexión e inténtalo de nuevo.',
        );
      })
      .finally(() => {
        setPendingSlots((current) => {
          const next = new Set(current);
          next.delete(fromId);
          next.delete(toId);
          return next;
        });
      });
  }

  return { sensors, draggingTipo, handleDragStart, handleDragEnd };
}
