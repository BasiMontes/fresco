import type { DiaSemana, ShoppingListItem } from '@/lib/api/types';
import { capitalize } from '@/lib/utils';

/** FRESCO-1028 — owner-set thresholds (2026-10-21): from 14 days the age is highlighted, past 30 the price is hidden. */
const PRECIO_ANTIGUO_DESDE_DIAS = 14;
const PRECIO_OCULTO_TRAS_DIAS = 30;

export type FrescuraPrecio = 'reciente' | 'antiguo' | 'oculto' | 'sin_fecha';

/** How fresh the linked price is. A price with no date is never `reciente`: nothing says it is current. */
export function frescuraPrecio(dias: number | null): FrescuraPrecio {
  if (dias === null) { return 'sin_fecha'; }
  if (dias > PRECIO_OCULTO_TRAS_DIAS) { return 'oculto'; }
  if (dias >= PRECIO_ANTIGUO_DESDE_DIAS) { return 'antiguo'; }
  return 'reciente';
}

/** What the row says about the linked price's age. Past the second threshold it says there is no recent price instead of an age. */
export function textoAntiguedad(dias: number | null): string {
  switch (frescuraPrecio(dias)) {
    case 'sin_fecha': return 'precio sin fecha';
    case 'oculto': return 'sin precio reciente';
    default:
      if (dias === 0) { return 'precio de hoy'; }
      if (dias === 1) { return 'precio de ayer'; }
      return `precio de hace ${dias} días`;
  }
}

/** Same mapping `calendar-grid.tsx` uses for `DiaSemana` values — kept local rather than shared since this is the only other consumer today. */
const DIA_LABELS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

/**
 * FRESCO-212 — "used for X, on Y" per ingredient row. `dia` is typed as
 * `DiaSemana`, but this reads out of a persisted jsonb blob (`items` on
 * `shopping_lists`) that the type doesn't enforce at runtime — `?? capitalize`
 * falls back for a value that predates or doesn't match the enum, same
 * conservative-fallback pattern as `getPasilloIcon`.
 */
export function formatUsos(usos: ShoppingListItem['usos']): string | null {
  if (!usos || usos.length === 0) { return null; }
  return usos
    .map(uso => `${uso.receta} (${DIA_LABELS[uso.dia] ?? capitalize(uso.dia)})`)
    .join(', ');
}
