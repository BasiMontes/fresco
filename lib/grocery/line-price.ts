import type { MappedGroceryItem } from './types';
import type { ShoppingListItem } from '@/lib/api/types';
import { mapShoppingListItem } from './map-item';

/** +/- band around the point estimate: "mejor esfuerzo, nunca exacto". Mirrors `COSTE_MARGEN` in `generate-shopping-list/aisle-pricing.ts`. */
export const COSTE_MARGEN = 0.15;

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Whole-pack price of the linked product, or `null` when no chain priced it (ADR-0036: `precioEnvase` is always the whole pack). */
function precioEnvaseReal(mapped: MappedGroceryItem): number | null {
  const real = mapped.precios[0];
  return real && Number.isFinite(real.precioEnvase) && real.precioEnvase > 0 ? real.precioEnvase : null;
}

/**
 * FRESCO-827 — the ONE price a shopping-list line shows. When a supermarket
 * product is linked, the line costs what that product costs at the till
 * (whole-pack price × packs needed), so the figure agrees with the link next
 * to it. With no linked price it falls back to the estimate the Edge Function
 * stored (`precio_estimado`, per-gram table). `undefined` when neither exists.
 * Never throws or returns `NaN`.
 */
export function precioLinea(item: ShoppingListItem, mapped: MappedGroceryItem = mapShoppingListItem(item)): number | undefined {
  const envase = precioEnvaseReal(mapped);
  if (envase !== null) {
    const envases = Number.isFinite(mapped.envasesEstimados) && mapped.envasesEstimados > 0 ? mapped.envasesEstimados : 1;
    return redondear2(envase * envases);
  }
  return item.precio_estimado;
}

/** Summary range for a whole list, summed from the same per-line prices the rows show so total and lines cannot disagree. */
export function costeResumen(items: readonly ShoppingListItem[]): { min: number, max: number } {
  const total = items.reduce((suma, item) => suma + (precioLinea(item) ?? 0), 0);
  return { min: redondear2(total * (1 - COSTE_MARGEN)), max: redondear2(total * (1 + COSTE_MARGEN)) };
}
