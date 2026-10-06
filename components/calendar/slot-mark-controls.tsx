import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlotMarkControlsProps {
  dia: DiaSemana
  tipo: TipoPlato
  pending: boolean
  /** STORY-FRESCO-15 — marks this slot cocinada/descartada; no-ops if not pendiente. */
  onMark: (estado: 'cocinada' | 'descartada') => void
}

/**
 * FRESCO-373 (A4-M27): was a pair of ~24px icon-only buttons pinned
 * bottom-right — the single interaction the paid tier depends on.
 * Now two full-width labelled buttons, ≥44px tall (WCAG 2.5.5).
 */
export function SlotMarkControls({ dia, tipo, pending, onMark }: SlotMarkControlsProps) {
  return (
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
