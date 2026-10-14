import type { ShoppingListItem, ShoppingListPasillo, ShoppingListSuggestion } from '@/lib/api/types';

/**
 * FRESCO-948 — pure state transitions for "Sugerencias para ti". Adding a
 * suggestion stores an item marked `origen: 'sugerencia'` in its aisle (so the
 * toggle coordinates and the `jsonb_set_comprado` RPC are unchanged); the view
 * shows those items in their own section instead of inside the aisle.
 *
 * Kept free of React and of `@/lib/api/*` so the add / remove / count rules are
 * unit-testable without the network.
 */

export interface AddedSuggestion {
  pasilloNombre: string
  pasilloIdx: number
  itemIdx: number
  item: ShoppingListItem
}

export function addSuggestionToPasillos(
  pasillos: ShoppingListPasillo[],
  suggestion: ShoppingListSuggestion,
): { pasillos: ShoppingListPasillo[], item: ShoppingListItem } {
  const item: ShoppingListItem = {
    nombre: suggestion.nombre,
    cantidad: suggestion.cantidad,
    unidad: suggestion.unidad,
    comprado: false,
    precio_estimado: suggestion.precio_estimado,
    origen: 'sugerencia',
  };
  const idx = pasillos.findIndex(p => p.nombre === suggestion.pasillo);
  if (idx === -1) {
    return { pasillos: [...pasillos, { nombre: suggestion.pasillo, orden: pasillos.length + 1, items: [item] }], item };
  }
  return { pasillos: pasillos.map((p, i) => (i === idx ? { ...p, items: [...p.items, item] } : p)), item };
}

/**
 * Takes an added suggestion back out. Mirrors `jsonb_remove_item`: only an item
 * marked `origen: 'sugerencia'` goes, addressed by aisle + name, so a meal-plan
 * item with the same name stays. A pasillo it empties is dropped unless the list
 * already had it when it loaded (`pasillosOriginales`).
 */
export function removeAddedItem(
  pasillos: ShoppingListPasillo[],
  { pasilloNombre, itemNombre, pasillosOriginales }: { pasilloNombre: string, itemNombre: string, pasillosOriginales: ReadonlySet<string> },
): ShoppingListPasillo[] {
  return pasillos
    .map(p =>
      p.nombre === pasilloNombre
        ? { ...p, items: p.items.filter(i => !(i.nombre === itemNombre && i.origen === 'sugerencia')) }
        : p,
    )
    .filter(p => p.items.length > 0 || pasillosOriginales.has(p.nombre));
}

export function listAddedSuggestions(pasillos: ShoppingListPasillo[]): AddedSuggestion[] {
  return pasillos.flatMap((pasillo, pasilloIdx) =>
    pasillo.items.flatMap((item, itemIdx) =>
      item.origen === 'sugerencia' ? [{ pasilloNombre: pasillo.nombre, pasilloIdx, itemIdx, item }] : [],
    ),
  );
}

/** The carousel card an added item came from, so "Quitar" can put it back. */
export function suggestionFromAddedItem(pasilloNombre: string, item: ShoppingListItem): ShoppingListSuggestion {
  return {
    nombre: item.nombre,
    pasillo: pasilloNombre,
    cantidad: item.cantidad,
    unidad: item.unidad,
    precio_estimado: item.precio_estimado ?? 0,
  };
}

export function countPendientes(pasillos: ShoppingListPasillo[]): number {
  return pasillos.reduce((count, pasillo) => count + pasillo.items.filter(item => !item.comprado).length, 0);
}
