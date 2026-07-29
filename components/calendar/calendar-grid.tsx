'use client';

import type { DragEndEvent } from '@dnd-kit/core';
import type { Recipe } from '@schemas';
import type { DiaSemana, TipoPlato } from '@/lib/api/types';
import type { MenuGrid, SlotKey } from '@/lib/calendar/apply-slot-swap';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { swapMealPlanSlots } from '@/lib/api/meal-plan';
import { applySlotSwap } from '@/lib/calendar/apply-slot-swap';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const DIA_LABELS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

const DIAS = Object.keys(DIA_LABELS) as DiaSemana[];
const SLOTS: TipoPlato[] = ['desayuno', 'comida', 'cena'];

/** Composite id `@dnd-kit` needs for each draggable/droppable slot node. */
function slotId(slot: SlotKey): string {
  return `${slot.dia}:${slot.tipo}`;
}

export interface CalendarGridProps {
  initialMenu: MenuGrid
  slotIds: Record<DiaSemana, Record<TipoPlato, string>>
}

/**
 * `'use client'` island (STORY-FRESCO-11) — owns all drag-and-drop
 * interactivity for the calendar's 7x3 grid. Wraps `@dnd-kit/core`'s
 * `DndContext`; each cell is both a draggable source and a drop target
 * (`useDraggable` + `useDroppable` on the same node, keyed by its
 * `(dia, tipo)` composite id), so any slot can be picked up and dropped onto
 * any other.
 *
 * Prop-driven only — does not fetch `initialMenu`/`slotIds` itself (that
 * stays server-side in `/calendar/page.tsx`, wired in a later batch). Owns
 * exactly one mutation: on drop, applies `applySlotSwap()` synchronously for
 * the optimistic UI update (AC Scenario 1 — "sin necesidad de una acción
 * adicional"), then calls `swapMealPlanSlots()` in the background. On
 * failure, reapplies the same swap to revert (a swap is its own inverse)
 * and surfaces an inline, dismissible error message (AC Scenario 3),
 * reusing the `text-error` token precedent from `app/onboarding/page.tsx`'s
 * `generateError` surface.
 */
export function CalendarGrid({ initialMenu, slotIds }: CalendarGridProps) {
  const [menu, setMenu] = React.useState<MenuGrid>(initialMenu);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const from = active.data.current as SlotKey | undefined;
    const to = over.data.current as SlotKey | undefined;
    if (!from || !to) {
      return;
    }

    setMenu(current => applySlotSwap(current, from, to));
    setErrorMessage(null);

    const slotAId = slotIds[from.dia][from.tipo];
    const slotBId = slotIds[to.dia][to.tipo];

    void swapMealPlanSlots(supabase, slotAId, slotBId).catch(() => {
      setMenu(current => applySlotSwap(current, from, to));
      setErrorMessage('No se pudo guardar el nuevo orden. Vuelve a intentarlo.');
    });
  }

  return (
    <div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto">
          <div className="grid min-w-[840px] grid-cols-7 gap-3">
            {DIAS.map(dia => (
              <div key={dia} className="flex flex-col gap-3">
                <p className="text-label">{DIA_LABELS[dia]}</p>
                {SLOTS.map(tipo => (
                  <SlotCell
                    key={tipo}
                    dia={dia}
                    tipo={tipo}
                    recipe={menu[dia][tipo]}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </DndContext>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-3 rounded-md border-l-4 border-error bg-surface p-3 shadow-sm"
        >
          <p data-testid="calendar_swap_error_message" className="text-body-sm text-error">
            {errorMessage}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            aria-label="Cerrar mensaje de error"
          >
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}

interface SlotCellProps {
  dia: DiaSemana
  tipo: TipoPlato
  recipe: Recipe
}

/**
 * One grid cell — both a drag source and a drop target for its own
 * `(dia, tipo)` slot. `useDraggable`/`useDroppable` are two independent
 * dnd-kit hooks; their `setNodeRef` callbacks are chained onto the same DOM
 * node via `setRefs` below (dnd-kit tracks draggable/droppable ids in
 * separate registries, so reusing the same composite id for both is safe).
 */
function SlotCell({ dia, tipo, recipe }: SlotCellProps) {
  const slotKey: SlotKey = { dia, tipo };
  const id = slotId(slotKey);

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id, data: slotKey });

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, data: slotKey });

  const setRefs = React.useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );

  return (
    <div
      ref={setRefs}
      {...listeners}
      {...attributes}
      data-testid={`calendar_slot_${dia}_${tipo}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'flex items-start gap-2 rounded-card bg-surface p-3 shadow-sm',
        isDragging && 'z-10 opacity-50',
        isOver && 'ring-2 ring-accent-500',
      )}
    >
      <GripVertical className="mt-0.5 size-4 shrink-0 text-tertiary" />
      <div>
        <p className="text-caption uppercase text-tertiary">{tipo}</p>
        <p className="text-body-sm">{recipe.nombre}</p>
      </div>
    </div>
  );
}
