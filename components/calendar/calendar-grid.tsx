'use client';

import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import type { MenuGrid } from '@/lib/calendar/apply-slot-swap';
import { DndContext } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { SlotCell } from '@/components/calendar/slot-cell';
import { useCalendarDragDrop } from '@/components/calendar/use-calendar-drag-drop';
import { useSlotMarking } from '@/components/calendar/use-slot-marking';
import { useVisibleDayWindow } from '@/components/calendar/use-visible-day-window';
import { Button } from '@/components/ui/button';
import { slotId } from '@/lib/calendar/apply-slot-swap';
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
/** `Date.prototype.getDay()` order (Sunday = 0) -> this grid's `DiaSemana` keys, for the "today" mark below. */
const JS_WEEKDAY_TO_DIA: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

type EstadosGrid = Record<DiaSemana, Record<TipoPlato, EstadoRecetaSlot>>;

export interface CalendarGridProps {
  initialMenu: MenuGrid
  slotIds: Record<DiaSemana, Record<TipoPlato, string>>
  /** STORY-FRESCO-15 — per-slot cocinado/descartado state, keyed the same as `initialMenu`. */
  initialEstados: EstadosGrid
  /**
   * FRESCO-153 — the user's onboarding/profile day and meal-type choices.
   * Every one of the 21 `meal_plan_recipes` rows still exists in the DB
   * (`reshapeMenu`'s fail-fast invariant requires the full grid — see
   * `lib/api/meal-plan.ts`), this only narrows what's *rendered*: days/meal
   * types she opted out of stay generated but hidden here. Defaults to the
   * full week/all 3 meals when omitted (e.g. no profile row yet).
   */
  planningDays?: DiaSemana[]
  planningMeals?: TipoPlato[]
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
 *
 * A5-M1 (god-component split): drag/drop, mark/undo, and the visible-day
 * window each own hooks now (`use-calendar-drag-drop.ts`,
 * `use-slot-marking.ts`, `use-visible-day-window.ts`); `SlotCell` lives in
 * its own file. This component is left as pure composition + the grid JSX.
 * `pendingSlots` stays here because both drag-swap and mark-status share it
 * — it's the one piece of state the two hooks need to coordinate on.
 */
export function CalendarGrid({
  initialMenu,
  slotIds,
  initialEstados,
  planningDays = DIAS,
  planningMeals = SLOTS,
}: CalendarGridProps) {
  const [menu, setMenu] = React.useState<MenuGrid>(initialMenu);
  const [estados, setEstados] = React.useState<EstadosGrid>(initialEstados);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  // Slots with an in-flight swapMealPlanSlots() call, keyed by dnd-kit id
  // (`slotId()`). Blocks both ends of a swap from being re-dragged until
  // the RPC settles — without this, a second drag overlapping an unresolved
  // first swap composes on top of the still-optimistic state, and the first
  // swap's revert-on-failure (below) re-applies against the WRONG state,
  // corrupting the grid in a way nothing re-syncs from afterward. Found in
  // Stage 3 review; fixed by making overlapping drags impossible rather than
  // reconciling them after the fact.
  const [pendingSlots, setPendingSlots] = React.useState<ReadonlySet<string>>(new Set());

  const { sensors, draggingTipo, handleDragStart, handleDragEnd } = useCalendarDragDrop({
    slotIds,
    setMenu,
    setErrorMessage,
    pendingSlots,
    setPendingSlots,
  });

  const { pendingMark, handleMarkEstado, handleUndoMark } = useSlotMarking({
    slotIds,
    estados,
    setEstados,
    setErrorMessage,
    pendingSlots,
    setPendingSlots,
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const { visibleDays, setStartIndex, canGoPrevDay, canGoNextDay } = useVisibleDayWindow(planningDays, containerRef);

  return (
    <div ref={containerRef} className="relative">
      {/* FRESCO-516: shares the grid's day-header row instead of its own row
          above it — that row used to be nearly empty (buttons right-aligned,
          nothing to their left), reading as a band of dead white space above
          the actual grid. Absolutely positioned against this `relative`
          wrapper, which starts exactly at the grid's top edge, so `top-0`
          lands in the header row; the day-header `<p>` below gets a matching
          `min-h-8` so the grid's row-1 track (sized to the tallest cell in
          it, per the comment below) is never shorter than these buttons. */}
      <div className="absolute right-0 top-0 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStartIndex(i => i - 1)}
          disabled={!canGoPrevDay}
          aria-label="Día anterior"
          data-testid="calendar_day_nav_prev"
          className="grid size-8 place-items-center rounded-full bg-surface text-primary hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-surface"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setStartIndex(i => i + 1)}
          disabled={!canGoNextDay}
          aria-label="Día siguiente"
          data-testid="calendar_day_nav_next"
          className="grid size-8 place-items-center rounded-full bg-surface text-primary hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-surface"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <DndContext id="calendar-grid" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/*
          FRESCO-159 — CSS Grid (not flex) columns, plus a meal-type label
          column shared with every day column in one grid: a flex-column
          day-stack next to an independent flex-column label-stack would
          drift out of alignment the moment any card's recipe title wraps to
          a different number of lines than its neighbors — CSS Grid's shared
          row tracks size to the tallest cell IN THAT ROW ACROSS EVERY COLUMN
          by construction, so the label for "comida" always lines up with
          every visible day's comida card regardless of how tall any of them
          render. `gridAutoFlow: column` + an explicit `gridTemplateRows` of
          exactly `planningMeals.length + 1` tracks makes this work from
          plain DOM order: the label column contributes 1 (spacer) + N
          (labels) items, each day column contributes 1 (day header) + N
          (`SlotCell`s) items — every group fills one column of the row
          template before wrapping to the next, no manual row/column index
          bookkeeping needed.

          FRESCO-271 — only `visibleDays` (a `startIndex`-based window, see
          the `useVisibleDayWindow` hook) is ever rendered as actual day
          columns, not the full week. There is nothing to scroll and
          nothing to keep pinned during a scroll, so the label column just
          sits in column 1 like any other grid column — no sticky, no
          transform, no scroll-sync of any kind.
        */}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `max-content repeat(${visibleDays.length}, 15rem)`,
            gridTemplateRows: `auto repeat(${planningMeals.length}, auto)`,
            gridAutoFlow: 'column',
            justifyContent: 'start',
          }}
        >
          <div aria-hidden="true" />
          {planningMeals.map(tipo => (
            <p key={tipo} className="pr-3 pt-3 text-h6 uppercase text-tertiary">
              {tipo}
            </p>
          ))}

          {visibleDays.map((dia) => {
            const isToday = dia === JS_WEEKDAY_TO_DIA[new Date().getDay()];
            return (
              <React.Fragment key={dia}>
                <p
                  className={cn(
                    'flex min-h-8 w-fit items-center text-label',
                    isToday && 'rounded-full bg-secondary px-3 py-1 text-on-warning',
                  )}
                >
                  {DIA_LABELS[dia]}
                </p>
                {planningMeals.map(tipo => (
                  <SlotCell
                    key={tipo}
                    dia={dia}
                    tipo={tipo}
                    recipe={menu[dia][tipo]}
                    dbSlotId={slotIds[dia][tipo]}
                    estado={estados[dia][tipo]}
                    dropDisabled={draggingTipo !== null && draggingTipo !== tipo}
                    pending={pendingSlots.has(slotId({ dia, tipo }))}
                    onMark={estado => void handleMarkEstado({ dia, tipo, estado })}
                    // FRESCO-183/FRESCO-271: only the visible day window is
                    // ever rendered now (see `useVisibleDayWindow`), so
                    // every currently-rendered slot is by definition in the
                    // unscrolled viewport — all of them are safe LCP
                    // priority candidates, same order of magnitude as the
                    // original "first 4 days" cap this replaces.
                    priority
                  />
                ))}
              </React.Fragment>
            );
          })}
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

      {pendingMark && (
        <div
          data-testid="mark_undo_snackbar"
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-lg bg-primary px-4 py-2.5 text-body-sm text-on-brand shadow-lg"
        >
          <span>
            {pendingMark.estado === 'cocinada' ? 'Marcado como cocinado' : 'Marcado como descartado'}
          </span>
          <button
            type="button"
            data-testid="mark_undo_button"
            onClick={handleUndoMark}
            className="-my-1 flex min-h-11 shrink-0 items-center px-2 font-semibold underline"
          >
            Deshacer
          </button>
        </div>
      )}
    </div>
  );
}
