import type { MappedGroceryItem } from './types';
import type { ShoppingListItem } from '@/lib/api/types';
import { mapShoppingListItem } from './map-item';

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
