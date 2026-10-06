import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import * as React from 'react';
import { EdgeFunctionError, updateRecipeStatus } from '@/lib/api/edge-functions';
import { slotId } from '@/lib/calendar/apply-slot-swap';
import { getAccessToken } from '@/lib/client-api/auth';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';

/** FRESCO-373 (A4-M27): how long the "Deshacer" snackbar stays before the mark commits. */
const UNDO_WINDOW_MS = 5000;

type EstadosGrid = Record<DiaSemana, Record<TipoPlato, EstadoRecetaSlot>>;

export interface UseSlotMarkingArgs {
  slotIds: Record<DiaSemana, Record<TipoPlato, string>>
  estados: EstadosGrid
  setEstados: React.Dispatch<React.SetStateAction<EstadosGrid>>
  setErrorMessage: (message: string | null) => void
  pendingSlots: ReadonlySet<string>
  setPendingSlots: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>
}

export interface PendingMark {
  dia: DiaSemana
  tipo: TipoPlato
  estado: 'cocinada' | 'descartada'
  prevEstado: EstadoRecetaSlot
}

/**
 * STORY-FRESCO-15 / FRESCO-373 — owns the "mark slot cocinada/descartada"
 * flow: optimistic update, a 5s undo window before the write commits to the
 * backend, and the `pagehide`/unmount flush so a pending mark is never lost.
 * Extracted from `CalendarGrid` (A5-M1, god-component split) — no behavior
 * change from the original inline implementation.
 */
export function useSlotMarking({ slotIds, estados, setEstados, setErrorMessage, pendingSlots, setPendingSlots }: UseSlotMarkingArgs) {
  // FRESCO-373: a mark still in its undo window when the user leaves the
  // page must not be lost — commit it. `pagehide` covers a real navigation /
  // reload (React's unmount cleanup does not run reliably then); the return
  // cleanup covers a client-side route change.
  const [pendingMark, setPendingMark] = React.useState<PendingMark | null>(null);
  const commitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMarkRef = React.useRef(pendingMark);

  React.useEffect(() => {
    pendingMarkRef.current = pendingMark;
  }, [pendingMark]);

  const commitMark = React.useCallback(async (mark: PendingMark) => {
    const id = slotId({ dia: mark.dia, tipo: mark.tipo });
    setPendingSlots(current => new Set(current).add(id));
    try {
      const accessToken = await getAccessToken();
      await updateRecipeStatus(
        { meal_plan_recipe_id: slotIds[mark.dia][mark.tipo], estado: mark.estado },
        accessToken,
      );
      captureEvent(
        mark.estado === 'cocinada'
          // "usados" half of the North-star KPI (ADR-0013).
          ? POSTHOG_EVENTS.RECIPE_MARKED_COOKED
          // FRESCO-366: discard rate per menu is a product-quality metric.
          : POSTHOG_EVENTS.RECIPE_MARKED_DISCARDED,
      );
    }
    catch (error) {
      console.error('[CalendarGrid] updateRecipeStatus failed', error);
      // Revert the optimistic mark — the write never landed.
      setEstados(current => ({
        ...current,
        [mark.dia]: { ...current[mark.dia], [mark.tipo]: mark.prevEstado },
      }));
      // FRESCO-47: 409 is the terminal-state guard firing on a real race
      // (another tab/device got there first) — a distinct, expected case.
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
  }, [slotIds, setEstados, setErrorMessage, setPendingSlots]);

  const flushPendingMark = React.useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    const mark = pendingMarkRef.current;
    if (mark) {
      pendingMarkRef.current = null;
      setPendingMark(null);
      void commitMark(mark);
    }
  }, [commitMark]);

  React.useEffect(() => {
    const onPageHide = () => flushPendingMark();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      flushPendingMark();
    };
  }, [flushPendingMark]);

  /**
   * STORY-FRESCO-15 / FRESCO-373: marks a pending slot cocinada/descartada.
   * The UI updates optimistically; the backend write is deferred by a 5s
   * undo window (snackbar). Marking a second slot flushes the first.
   */
  const handleMarkEstado = React.useCallback(({ dia, tipo, estado }: { dia: DiaSemana, tipo: TipoPlato, estado: 'cocinada' | 'descartada' }) => {
    const id = slotId({ dia, tipo });
    if (pendingSlots.has(id)) {
      return;
    }
    setErrorMessage(null);
    // Only one undo window at a time — commit whatever is already pending.
    flushPendingMark();

    const prevEstado = estados[dia][tipo];
    setEstados(current => ({ ...current, [dia]: { ...current[dia], [tipo]: estado } }));
    const mark: PendingMark = { dia, tipo, estado, prevEstado };
    setPendingMark(mark);
    pendingMarkRef.current = mark;
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      pendingMarkRef.current = null;
      setPendingMark(null);
      void commitMark(mark);
    }, UNDO_WINDOW_MS);
  }, [pendingSlots, estados, setErrorMessage, flushPendingMark, setEstados, commitMark]);

  const handleUndoMark = React.useCallback(() => {
    const mark = pendingMarkRef.current;
    if (!mark) {
      return;
    }
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    setEstados(current => ({
      ...current,
      [mark.dia]: { ...current[mark.dia], [mark.tipo]: mark.prevEstado },
    }));
    captureEvent(POSTHOG_EVENTS.RECIPE_MARK_UNDONE, { estado: mark.estado });
    pendingMarkRef.current = null;
    setPendingMark(null);
  }, [setEstados]);

  return { pendingMark, handleMarkEstado, handleUndoMark };
}
