import type { DiaSemana, ShoppingListItem } from '@/lib/api/types';
import { capitalize } from '@/lib/utils';

/** How old the linked price is, or `null` when the source gives no date (nothing is better than a made-up age). */
export function textoAntiguedad(dias: number | null): string | null {
  if (dias === null) { return null; }
  if (dias === 0) { return 'precio de hoy'; }
  if (dias === 1) { return 'precio de ayer'; }
  return `precio de hace ${dias} días`;
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
