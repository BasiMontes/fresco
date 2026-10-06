import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SlotDragHandleProps {
  listeners: DraggableSyntheticListeners
  attributes: DraggableAttributes
  disabled: boolean
}

/**
 * Drag activation listeners live ONLY on this handle, not the whole cell
 * (dnd-kit's documented "drag handle" pattern) — spreading them on the outer
 * div, as before FRESCO-15, made the entire cell a drag source, so the
 * PointerSensor captured every pointerdown on the mark buttons below and the
 * drag gesture fired instead of their onClick.
 */
export function SlotDragHandle({ listeners, attributes, disabled }: SlotDragHandleProps) {
  return (
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
  );
}
