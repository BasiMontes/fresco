import type { DiaSemana, ShoppingListItem, ShoppingListPasillo } from '@/lib/api/types';
import type { CompraPorItem } from '@/lib/grocery/compra';
import { claveItemCompra } from '@/lib/grocery/compra';
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

/**
 * FRESCO-1099 — the price a row prints: the linked product's price, else the stored estimate, and nothing once
 * the linked price is too old to show. The row and the summary total both read it, so the total is the sum of the rows.
 */
export function precioDeFila({ item, linea }: { item: ShoppingListItem, linea: CompraPorItem[string] | undefined }): number | undefined {
  const enlaces = linea?.enlaces ?? [];
  // The age rules apply to a linked price only; a row with no link shows its stored estimate as before.
  const frescura = enlaces.length > 0 ? frescuraPrecio(enlaces[0]?.antiguedadDias ?? null) : 'reciente';
  return frescura === 'oculto' ? undefined : (linea?.precio ?? item.precio_estimado);
}

/** FRESCO-1099 — sum of the rows' printed prices, to the cent; `undefined` when no row prints one. */
export function totalDeLista({ pasillos, compra }: { pasillos: readonly Pick<ShoppingListPasillo, 'nombre' | 'items'>[], compra: CompraPorItem | undefined }): number | undefined {
  let total = 0;
  let conPrecio = false;
  for (const pasillo of pasillos) {
    for (const item of pasillo.items) {
      const precio = precioDeFila({ item, linea: compra?.[claveItemCompra({ pasillo: pasillo.nombre, item: item.nombre })] });
      if (precio !== undefined && Number.isFinite(precio) && precio > 0) {
        total += precio;
        conPrecio = true;
      }
    }
  }
  return conPrecio ? Math.round(total * 100) / 100 : undefined;
}

/** FRESCO-1172 — how many rows print a price, out of all rows: what the list total actually covers. */
export function cobertura({ pasillos, compra }: { pasillos: readonly Pick<ShoppingListPasillo, 'nombre' | 'items'>[], compra: CompraPorItem | undefined }): { conPrecio: number, articulos: number } {
  let conPrecio = 0;
  let articulos = 0;
  for (const pasillo of pasillos) {
    for (const item of pasillo.items) {
      articulos += 1;
      const precio = precioDeFila({ item, linea: compra?.[claveItemCompra({ pasillo: pasillo.nombre, item: item.nombre })] });
      if (precio !== undefined && Number.isFinite(precio) && precio > 0) { conPrecio += 1; }
    }
  }
  return { conPrecio, articulos };
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
