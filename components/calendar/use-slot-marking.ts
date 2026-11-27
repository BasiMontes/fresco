import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import * as React from 'react';
import { edgeFailureMessage, mayHaveLanded } from '@/lib/api/edge-function-timeout';
import { EdgeFunctionError, updateRecipeStatus } from '@/lib/api/edge-functions';
import { slotId } from '@/lib/calendar/apply-slot-swap';
import { getAccessToken } from '@/lib/client-api/auth';
import { getSlotEstado } from '@/lib/client-api/meal-plan';
import { listaDesactualizadaDeSlot } from '@/lib/client-api/shopping-list';
import { captureEvent } from '@/lib/posthog/events';
import { committedMarkEvent, undoneMarkEvent } from '@/lib/posthog/mark-events';

/**
 * FRESCO-373 (A4-M27): how long the "Deshacer" snackbar stays before the mark commits. FRESCO-1014 (A7-UI-15,
 * WCAG 2.2.1): ten seconds, not five, so a screen-reader or motor-impaired user can reach it; and a committed
 * mark can still be changed inside the current week (`SlotChangeMarkControls`).
 */
const UNDO_WINDOW_MS = 10_000;

type EstadosGrid = Record<DiaSemana, Record<TipoPlato, EstadoRecetaSlot>>;

/** FRESCO-1284: the write got no answer and the database could not be asked either. */
const UNCONFIRMED_MESSAGE = 'No hemos podido comprobar si se guardó el estado del plato. Recarga la página.';

/** What the database holds for the slot, or `null` when it cannot be known. */
async function readSavedEstado(mealPlanRecipeId: string): Promise<EstadoRecetaSlot | null> {
  try {
    return await getSlotEstado(mealPlanRecipeId);
  }
  catch (error) {
    console.error('[CalendarGrid] could not read the slot after a failed mark', error);
    return null;
  }
}

export interface UseSlotMarkingArgs {
  slotIds: Record<DiaSemana, Record<TipoPlato, string>>
  estados: EstadosGrid
  setEstados: React.Dispatch<React.SetStateAction<EstadosGrid>>
  setErrorMessage: (message: string | null) => void
  pendingSlots: ReadonlySet<string>
  setPendingSlots: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>
  /** FRESCO-1010: called when a discard left the shopping list stale (it was generated before this change). */
  onListaDesactualizada?: () => void
}

export interface PendingMark {
  dia: DiaSemana
  tipo: TipoPlato
  /** `pendiente` takes a committed mark back (FRESCO-1014). */
  estado: 'cocinada' | 'descartada' | 'pendiente'
  prevEstado: EstadoRecetaSlot
}

/**
 * STORY-FRESCO-15 / FRESCO-373 — owns the "mark slot cocinada/descartada"
 * flow: optimistic update, a 5s undo window before the write commits to the
 * backend, and the `pagehide`/unmount flush so a pending mark is never lost.
 * Extracted from `CalendarGrid` (A5-M1, god-component split) — no behavior
 * change from the original inline implementation.
 */
export function useSlotMarking({ slotIds, estados, setEstados, setErrorMessage, pendingSlots, setPendingSlots, onListaDesactualizada }: UseSlotMarkingArgs) {
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

  /** The mark is in the database: the funnel event and, for a discard, the stale shopping list notice. */
  const onMarkSaved = React.useCallback(async (mark: PendingMark) => {
    // FRESCO-1014: `pendiente` is a committed mark taken back (not the in-window "Deshacer", which never reaches
    // the server). FRESCO-1031: every mark event carries the plan tier.
    const event = committedMarkEvent(mark.estado, mark.prevEstado);
    captureEvent(event.name, event.properties);
    // FRESCO-1010: discarding a dish takes its ingredients off the list, but only once the list is
    // updated. The database has flagged it by now; say so (cooking a dish does not change the list).
    if (mark.estado === 'descartada' && onListaDesactualizada && await listaDesactualizadaDeSlot(slotIds[mark.dia][mark.tipo])) {
      onListaDesactualizada();
    }
  }, [slotIds, onListaDesactualizada]);

  /**
   * FRESCO-1284: the response of a mark can get lost after the write arrived, so a failure is settled with what the
   * database holds. Saved: keep it, no message. Something else: show that and say why. Unknown with no answer at
   * all: keep the mark and ask to reload, never to retry something that may be saved.
   */
  const settleFailedMark = React.useCallback(async (mark: PendingMark, error: unknown) => {
    const saved = await readSavedEstado(slotIds[mark.dia][mark.tipo]);
    if (saved === mark.estado) {
      await onMarkSaved(mark);
      return;
    }
    if (saved === null && mayHaveLanded(error)) {
      setErrorMessage(UNCONFIRMED_MESSAGE);
      return;
    }
    setEstados(current => ({
      ...current,
      [mark.dia]: { ...current[mark.dia], [mark.tipo]: saved ?? mark.prevEstado },
    }));
    // FRESCO-47: 409 is the terminal-state guard firing on a real race
    // (another tab/device got there first) — a distinct, expected case.
    setErrorMessage(
      error instanceof EdgeFunctionError && error.status === 409
        ? 'Este plato ya fue marcado. Actualiza la página para ver su estado actual.'
        : edgeFailureMessage(error, 'No se pudo guardar el estado del plato. Vuelve a intentarlo.'),
    );
  }, [slotIds, setEstados, setErrorMessage, onMarkSaved]);

  const commitMark = React.useCallback(async (mark: PendingMark) => {
    const id = slotId({ dia: mark.dia, tipo: mark.tipo });
    setPendingSlots(current => new Set(current).add(id));
    try {
      const accessToken = await getAccessToken();
      await updateRecipeStatus(
        { meal_plan_recipe_id: slotIds[mark.dia][mark.tipo], estado: mark.estado },
        accessToken,
      );
      await onMarkSaved(mark);
    }
    catch (error) {
      console.error('[CalendarGrid] updateRecipeStatus failed', error);
      await settleFailedMark(mark, error);
    }
    finally {
      setPendingSlots((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }, [slotIds, setPendingSlots, onMarkSaved, settleFailedMark]);

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
  const handleMarkEstado = React.useCallback(({ dia, tipo, estado }: { dia: DiaSemana, tipo: TipoPlato, estado: 'cocinada' | 'descartada' | 'pendiente' }) => {
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
    const event = undoneMarkEvent(mark.estado);
    captureEvent(event.name, event.properties);
    pendingMarkRef.current = null;
    setPendingMark(null);
  }, [setEstados]);

  return { pendingMark, handleMarkEstado, handleUndoMark };
}
