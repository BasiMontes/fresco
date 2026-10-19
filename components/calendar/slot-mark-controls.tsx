import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import { Check, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Spoken forms of the day, with their accent, for the accessible names below. */
const DIA_HABLADO: Record<DiaSemana, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
};

interface SlotMarkControlsProps {
  dia: DiaSemana
  tipo: TipoPlato
  /** The dish in this slot: the accessible name says which one is being marked (FRESCO-1013, A7-UI-05). */
  nombre?: string | null
  pending: boolean
  /** STORY-FRESCO-15 — marks this slot cocinada/descartada; no-ops if not pendiente. */
  onMark: (estado: 'cocinada' | 'descartada') => void
}

/**
 * FRESCO-373 (A4-M27): was a pair of ~24px icon-only buttons pinned
 * bottom-right — the single interaction the paid tier depends on.
 * Now two full-width labelled buttons, ≥44px tall (WCAG 2.5.5).
 * FRESCO-974: `flex-auto` + `flex-wrap` — in a narrow day column (~190px at
 * 1440px) the two labels do not fit side by side, so they stack instead of
 * overflowing the card; wide columns still show one row.
 */
export function SlotMarkControls({ dia, tipo, nombre, pending, onMark }: SlotMarkControlsProps) {
  // FRESCO-1013 (A7-UI-05, WCAG 2.5.3 Label in Name): the name STARTS with the visible word, so "pulsa Descartar"
  // matches, and it carries the dish and the slot, so twenty-one identical buttons are told apart.
  const donde = `${nombre ? `${nombre}, ` : ''}${DIA_HABLADO[dia]}, ${tipo}`;
  return (
    <div className="mt-auto flex flex-wrap gap-2 pt-3">
      <button
        type="button"
        data-testid={`calendar_slot_${dia}_${tipo}_mark_cocinada`}
        aria-label={`Cocinado: ${donde}`}
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          onMark('cocinada');
        }}
        className="flex min-h-11 flex-auto items-center justify-center gap-2 rounded-full border border-neutral-600 text-body-sm font-semibold text-tertiary transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-65"
      >
        <Check className="size-4 shrink-0" />
        Cocinado
      </button>
      <button
        type="button"
        data-testid={`calendar_slot_${dia}_${tipo}_mark_descartada`}
        aria-label={`Descartar: ${donde}`}
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          onMark('descartada');
        }}
        className="flex min-h-11 flex-auto items-center justify-center gap-2 rounded-full border border-neutral-600 text-body-sm font-semibold text-tertiary transition-colors hover:border-error hover:text-error disabled:pointer-events-none disabled:opacity-65"
      >
        <X className="size-4 shrink-0" />
        Descartar
      </button>
    </div>
  );
}

interface SlotEstadoBadgeProps {
  dia: DiaSemana
  tipo: TipoPlato
  estado: EstadoRecetaSlot
}

/** Terminal-state label shown instead of the mark controls once a slot is not `pendiente`. */
export function SlotEstadoBadge({ dia, tipo, estado }: SlotEstadoBadgeProps) {
  return (
    <p
      data-testid={`calendar_slot_${dia}_${tipo}_estado_badge`}
      className={cn(
        'mt-auto pt-2 text-right text-caption uppercase',
        estado === 'cocinada' ? 'text-primary' : 'text-tertiary',
      )}
    >
      {estado === 'cocinada' ? 'Cocinado' : 'Descartado'}
    </p>
  );
}

interface SlotChangeMarkControlsProps {
  dia: DiaSemana
  tipo: TipoPlato
  /** The slot's current mark. */
  estado: 'cocinada' | 'descartada'
  pending: boolean
  onMark: (estado: 'cocinada' | 'descartada' | 'pendiente') => void
}

/**
 * FRESCO-1014 (A7-UI-15): a mark used to be permanent after a five-second snackbar, so one mis-tap on
 * "Descartar" banned a dish for two weeks with no way back. Inside the current week the mark can be taken
 * back or switched to the other one. Same 44 px labelled buttons as `SlotMarkControls`.
 */
export function SlotChangeMarkControls({ dia, tipo, estado, pending, onMark }: SlotChangeMarkControlsProps) {
  const other = estado === 'cocinada' ? 'descartada' : 'cocinada';
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        data-testid={`calendar_slot_${dia}_${tipo}_unmark`}
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          onMark('pendiente');
        }}
        className="flex min-h-11 flex-auto items-center justify-center gap-2 rounded-full border border-neutral-600 text-body-sm font-semibold text-tertiary transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-65"
      >
        <Undo2 className="size-4 shrink-0" />
        Quitar marca
      </button>
      <button
        type="button"
        data-testid={`calendar_slot_${dia}_${tipo}_switch`}
        disabled={pending}
        onClick={(event) => {
          event.stopPropagation();
          onMark(other);
        }}
        className="flex min-h-11 flex-auto items-center justify-center gap-2 rounded-full border border-neutral-600 text-body-sm font-semibold text-tertiary transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-65"
      >
        {other === 'cocinada' ? <Check className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />}
        {other === 'cocinada' ? 'Cambiar a cocinado' : 'Cambiar a descartado'}
      </button>
    </div>
  );
}
