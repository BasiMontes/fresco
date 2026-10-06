import type { SlotKey } from '@/lib/calendar/apply-slot-swap';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import * as React from 'react';
import { slotId } from '@/lib/calendar/apply-slot-swap';

interface UseSlotDndArgs {
  slotKey: SlotKey
  /** `pending || recipe === null` — nothing to move, or a swap/mark call is in flight. */
  disabled: boolean
  /** True while a slot of a DIFFERENT `tipo` is being dragged. */
  dropDisabled: boolean
}

/**
 * `useDraggable`/`useDroppable` are two independent dnd-kit hooks; their
 * `setNodeRef` callbacks are chained onto the same DOM node via `setRefs`
 * (dnd-kit tracks draggable/droppable ids in separate registries, so reusing
 * the same composite id for both is safe).
 */
export function useSlotDnd({ slotKey, disabled, dropDisabled }: UseSlotDndArgs) {
  const id = slotId(slotKey);

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

  return { setRefs, attributes, listeners, transform, isDragging, isOver };
}
