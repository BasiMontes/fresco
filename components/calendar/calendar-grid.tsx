'use client';

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Recipe } from '@schemas';
import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import type { MenuGrid, SlotKey } from '@/lib/calendar/apply-slot-swap';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { EdgeFunctionError, updateRecipeStatus } from '@/lib/api/edge-functions';
import { MealPlanError, swapMealPlanSlots } from '@/lib/api/meal-plan';
import { applySlotSwap } from '@/lib/calendar/apply-slot-swap';
import { getCategoryIcon } from '@/lib/recipes/category-icon';
import { firstActiveDietaLabel } from '@/lib/recipes/labels';
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
/** `Date.prototype.getDay()` order (Sunday = 0) -> this grid's `DiaSemana` keys, for the "today" mark below. */
const JS_WEEKDAY_TO_DIA: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/** Composite id `@dnd-kit` needs for each draggable/droppable slot node. */
function slotId(slot: SlotKey): string {
  return `${slot.dia}:${slot.tipo}`;
}

type EstadosGrid = Record<DiaSemana, Record<TipoPlato, EstadoRecetaSlot>>;

export interface CalendarGridProps {
  initialMenu: MenuGrid
  slotIds: Record<DiaSemana, Record<TipoPlato, string>>
  /** STORY-FRESCO-15 — per-slot cocinado/descartado state, keyed the same as `initialMenu`. */
  initialEstados: EstadosGrid
  /** STORY-FRESCO-15 — gates the Free-tier "esto es una función Pro" notice. */
  userPlan: 'free' | 'pro' | 'family'
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
 */
export function CalendarGrid({
  initialMenu,
  slotIds,
  initialEstados,
  userPlan,
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
  // Tracks the `tipo` of the slot currently being dragged so every OTHER
  // `SlotCell` can disable itself as a drop target for the duration — a
  // franja never accepts a recipe from a different meal type (see the
  // `from.tipo !== to.tipo` guard in `handleDragEnd` below, and the real
  // enforcement in `swap_meal_plan_slots()`). `null` when nothing is being
  // dragged.
  const [draggingTipo, setDraggingTipo] = React.useState<TipoPlato | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  // FRESCO-170 — the meal-type label column ("desayuno"/"comida"/"cena")
  // used `position: sticky; left: 0` to stay pinned while the grid scrolls
  // horizontally. That doesn't work here: `gridAutoFlow: 'column'` places
  // each label in its own single-column grid cell (~90px, sized to content),
  // and a sticky element's containing block is that cell — once scrolled
  // past the cell's own width, the label has nowhere left to "stick" and
  // scrolls away with the rest of the row (unlike a `<table>`'s sticky first
  // column, whose containing block is the full-width `<tr>`). Fixed by
  // manually counter-translating the labels by the scroll container's own
  // `scrollLeft` on every `scroll` event — same visual result as sticky,
  // without depending on a containing block CSS Grid doesn't give this
  // layout. Direct DOM writes (not React state) keep this off the render
  // path so it doesn't add a re-render per scroll frame.
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const labelRefs = React.useRef<(HTMLParagraphElement | null)[]>([]);
  // FRESCO-184 — the grid's horizontal scroll had no visual affordance: the
  // last visible day column just clipped mid-card at 768px/1280px with
  // nothing suggesting more days exist to the right. Tracked via the same
  // scroll listener as the label sync above (one listener, not two) plus a
  // `ResizeObserver` on the scroller itself, since a viewport resize alone
  // (no scroll event) can flip whether the content overflows at all.
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const syncLabelsToScroll = () => {
      const translateX = `translateX(${scroller.scrollLeft}px)`;
      labelRefs.current.forEach((label) => {
        if (label) {
          label.style.transform = translateX;
        }
      });
      // 1px buffer for sub-pixel rounding at the exact scrolled-to-end position.
      setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
    };

    syncLabelsToScroll();
    scroller.addEventListener('scroll', syncLabelsToScroll, { passive: true });
    const resizeObserver = new ResizeObserver(syncLabelsToScroll);
    resizeObserver.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', syncLabelsToScroll);
      resizeObserver.disconnect();
    };
  }, [planningMeals.length, planningDays.length]);

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

    void swapMealPlanSlots(supabase, slotAId, slotBId)
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

  /**
   * STORY-FRESCO-15: marks a pending slot as cocinada/descartada — a
   * terminal, one-way state (Business Rules: "queda fijado — no puede volver
   * a cambiarse"), so unlike the swap above there is no optimistic-then-
   * revert dance: the button only re-enables on a real failure, never
   * flips back to a state the user already committed successfully.
   */
  async function handleMarkEstado(dia: DiaSemana, tipo: TipoPlato, estado: 'cocinada' | 'descartada') {
    const id = slotId({ dia, tipo });
    if (pendingSlots.has(id)) {
      return;
    }

    setErrorMessage(null);
    setPendingSlots(current => new Set(current).add(id));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await updateRecipeStatus(
        { meal_plan_recipe_id: slotIds[dia][tipo], estado },
        session?.access_token ?? null,
      );
      setEstados(current => ({ ...current, [dia]: { ...current[dia], [tipo]: estado } }));
    }
    catch (error) {
      console.error('[CalendarGrid] updateRecipeStatus failed', error);
      // FRESCO-47: 409 is the terminal-state guard in `update-recipe-status`
      // (FR-5.1 — a slot already marked cocinada/descartada can't be
      // re-patched) firing on a real race — another tab/device got there
      // first. That's a distinct, expected case, not the same as a bare
      // network/500 failure.
      setErrorMessage(
        error instanceof EdgeFunctionError && error.status === 409
          ? 'Este plato ya fue marcado. Actualiza la página para ver su estado actual.'
          : 'No se pudo guardar el estado del plato. Vuelve a intentarlo.',
      );
    }
    finally {
      setPendingSlots((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div>
      {userPlan === 'free' && (
        <p
          data-testid="learning_free_tier_notice"
          className="mb-4 rounded-md bg-surface p-3 text-body-sm text-tertiary"
        >
          Marcar un plato como cocinado o descartado se guarda igual en el plan Free. Lo exclusivo de Pro es que tu próximo menú aprenda de esos marcados.
        </p>
      )}

      <DndContext id="calendar-grid" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/*
          Widened from a 7-column CSS grid squeezed into an 840px min-width
          (~120px/day — real recipe names wrapped into a near-unreadable
          vertical word stack) to a horizontally-scrolling row of fixed-width
          columns. Real per-column width beats cramming all 7 days into one
          viewport.

          FRESCO-159 — CSS Grid (not flex) columns, plus a meal-type label
          column pinned during horizontal scroll (FRESCO-170 — via JS
          scroll-sync, not CSS `sticky`; see the label's own comment below):
          replaces the old per-`SlotCell` "DESAYUNO"/"COMIDA"/"CENA" text,
          which repeated identically across every day column
          (a real "why does this say Desayuno 7 times" complaint, not just a
          style nit). A flex-column day-stack next to an independent
          flex-column label-stack would drift out of alignment the moment
          any card's recipe title wraps to a different number of lines than
          its neighbors — CSS Grid's shared row tracks size to the tallest
          cell IN THAT ROW ACROSS EVERY COLUMN by construction, so the label
          for "comida" always lines up with every day's comida card
          regardless of how tall any of them render. `gridAutoFlow: column`
          + an explicit `gridTemplateRows` of exactly `planningMeals.length +
          1` tracks makes this work from plain DOM order: the label column
          contributes 1 (spacer) + N (labels) items, each day column
          contributes 1 (day header) + N (`SlotCell`s) items — every group
          fills one column of the row template before wrapping to the next,
          no manual row/column index bookkeeping needed.
        */}
        <div className="relative">
          {canScrollRight && (
            <div
              aria-hidden="true"
              data-testid="calendar_scroll_hint"
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent"
            />
          )}
          <div ref={scrollerRef} className="overflow-x-auto pb-2">
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `auto repeat(${planningDays.length}, 15rem)`,
                gridTemplateRows: `auto repeat(${planningMeals.length}, auto)`,
                gridAutoFlow: 'column',
              }}
            >
              <div aria-hidden="true" />
              {planningMeals.map((tipo, index) => (
                <p
                  key={tipo}
                  ref={(el) => { labelRefs.current[index] = el; }}
                  className="relative z-10 bg-background pr-3 pt-3 text-h6 uppercase text-tertiary"
                >
                  {tipo}
                </p>
              ))}

              {planningDays.map((dia, diaIndex) => {
                const isToday = dia === JS_WEEKDAY_TO_DIA[new Date().getDay()];
                return (
                  <React.Fragment key={dia}>
                    <p
                      className={cn(
                        'text-label',
                        isToday && 'inline-flex w-fit items-center rounded-full bg-secondary px-3 py-1 text-background',
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
                        estado={estados[dia][tipo]}
                        dropDisabled={draggingTipo !== null && draggingTipo !== tipo}
                        pending={pendingSlots.has(slotId({ dia, tipo }))}
                        onMark={estado => void handleMarkEstado(dia, tipo, estado)}
                        // FRESCO-183: every slot card is the same size, so
                        // Chrome's LCP candidate can be whichever equally-
                        // sized image finishes painting LAST within the
                        // visible (unscrolled) region of this horizontally
                        // scrollable grid — confirmed live via getBoundingClientRect
                        // (grid's own rendered width ~954px vs ~1858px
                        // scrollWidth at a standard desktop viewport, fitting
                        // ~3-4 day columns before the grid clips). Covering
                        // the first 4 days is a safe margin without eager-
                        // loading all ~21 images across every day.
                        priority={diaIndex <= 3}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </div>
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
  /** `null` — FR-8.2 / AC Scenario 4 (FRESCO-23): no safe recipe for this slot. */
  recipe: Recipe | null
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
 * controls that component doesn't have, so it mirrors the same visual
 * structure by hand rather than wrapping it. The drag handle moved onto
 * the image area (top-left, matching where `RecipeCard`'s favorite heart
 * sits top-right) since the compact row's inline handle no longer has a
 * home; mark-status controls stay pinned to the bottom (`mt-auto`) below
 * whatever content precedes them, same "stacked below, not beside" reason
 * as before (STORY-FRESCO-15 — a buttons row competing for width with a
 * long title collapses the title's wrapper).
 */
function SlotCell({ dia, tipo, recipe, estado, pending, dropDisabled, onMark, priority }: SlotCellProps) {
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

  const CategoryIcon = getCategoryIcon(recipe?.clasificacion?.categoria);
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
      onClick={recipe && !disabled ? () => router.push(`/recipes/${recipe.id}`) : undefined}
      role={recipe && !disabled ? 'link' : undefined}
      tabIndex={recipe && !disabled ? 0 : undefined}
      onKeyDown={recipe && !disabled
        ? (event) => {
            if (event.key === 'Enter' && event.target === event.currentTarget) {
              router.push(`/recipes/${recipe.id}`);
            }
          }
        : undefined}
      className={cn(
        'flex flex-col rounded-card bg-surface p-3 shadow-sm',
        !disabled && 'cursor-pointer',
        isDragging && 'z-10 opacity-50',
        isOver && 'ring-2 ring-accent-500',
        pending && 'cursor-wait opacity-70',
        estado === 'descartada' && 'opacity-60',
      )}
    >
      {recipe
        ? (
            <>
              <div className="relative mb-2 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg bg-neutral-200">
                {recipe.foto_url
                  ? (
                      <Image
                        src={recipe.foto_url}
                        alt={recipe.nombre}
                        fill
                        sizes="240px"
                        priority={priority}
                        className="object-cover"
                      />
                    )
                  : (
                      <CategoryIcon className="size-10 text-neutral-400" aria-hidden="true" />
                    )}
                {/*
                  FRESCO-159 — no drag handle for desayuno: user-reported
                  finding, breakfast slots don't need drag & drop. Not
                  rendering the handle is sufficient to disable dragging
                  entirely (see the comment below) — no need to also flip
                  `useDraggable`'s `disabled` flag.

                  Drag activation listeners live ONLY on this handle, not the
                  whole cell (dnd-kit's documented "drag handle" pattern) —
                  spreading them on the outer div, as before FRESCO-15, made
                  the entire cell a drag source, so the PointerSensor captured
                  every pointerdown on the mark buttons below and the drag
                  gesture fired instead of their onClick. Found live: the
                  buttons never worked, dnd-kit's own screen-reader announcer
                  confirmed a self-drop was registered on every click.
                */}
                {tipo !== 'desayuno' && (
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
                    // touch-none`): `touch-action: none` disables the
                    // browser's native touch scrolling unconditionally for
                    // any touch that starts on this element, regardless of
                    // dnd-kit's own activation logic — confirmed live: a
                    // touch swipe starting on this handle couldn't scroll
                    // the grid at all, while the same swipe starting
                    // anywhere else on the card scrolled fine. The `sensors`
                    // activationConstraints above (see the comment there)
                    // now arbitrate scroll-vs-drag intent instead.
                    className="absolute left-2 top-2 cursor-grab disabled:cursor-not-allowed"
                  >
                    <GripVertical className="size-[22px]" />
                  </Button>
                )}
              </div>
              <p className="text-h6 uppercase text-tertiary">{recipe.clasificacion?.categoria ?? '—'}</p>
              <h3 className={cn('text-h5', estado === 'descartada' && 'line-through')}>{recipe.nombre}</h3>
              {dietaLabel && (
                <div className="mt-1">
                  <Tag variant="accent">{dietaLabel}</Tag>
                </div>
              )}
            </>
          )
        : (
            <p data-testid={`calendar_slot_${dia}_${tipo}_sin_receta`} className="text-body-sm italic text-tertiary">
              Sin receta segura
            </p>
          )}

      {recipe && estado === 'pendiente' && (
        <div className="mt-auto flex justify-end gap-1 pt-2">
          <button
            type="button"
            data-testid={`calendar_slot_${dia}_${tipo}_mark_cocinada`}
            aria-label="Marcar como cocinado"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation();
              onMark('cocinada');
            }}
            className="rounded-full p-1 text-tertiary hover:bg-primary hover:text-background disabled:pointer-events-none"
          >
            <Check className="size-4" />
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
            className="rounded-full p-1 text-tertiary hover:bg-error hover:text-background disabled:pointer-events-none"
          >
            <X className="size-4" />
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
  );
}
