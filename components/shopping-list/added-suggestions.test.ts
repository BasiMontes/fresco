import type { ShoppingListPasillo, ShoppingListSuggestion } from '@/lib/api/types';
import { describe, expect, test } from 'bun:test';
import {
  addSuggestionToPasillos,
  countPendientes,
  listAddedSuggestions,
  removeAddedItem,
  suggestionFromAddedItem,
} from './added-suggestions';

/**
 * FRESCO-948 — the state transitions behind "Sugerencias para ti": an added
 * suggestion becomes an item marked `origen: 'sugerencia'` and shows in its own
 * section; removing it puts the card back. Kept pure so the add / remove / count
 * rules are tested without the network (the repo avoids mocking `@/lib/api/*`).
 */

const JENGIBRE: ShoppingListSuggestion = { nombre: 'jengibre', pasillo: 'Especias', cantidad: 1, unidad: 'ud', precio_estimado: 1.2 };

function lista(): ShoppingListPasillo[] {
  return [
    { nombre: 'Verduras', orden: 1, items: [{ nombre: 'Tomate', cantidad: 2, unidad: 'ud', comprado: false }] },
    { nombre: 'Especias', orden: 2, items: [{ nombre: 'Pimienta', cantidad: 1, unidad: 'ud', comprado: true }] },
  ];
}

const ORIGINALES = new Set(['Verduras', 'Especias']);

describe('addSuggestionToPasillos', () => {
  test('appends the item, marked as coming from a suggestion, to its existing pasillo', () => {
    const { pasillos, item } = addSuggestionToPasillos(lista(), JENGIBRE);

    expect(item).toEqual({ nombre: 'jengibre', cantidad: 1, unidad: 'ud', comprado: false, precio_estimado: 1.2, origen: 'sugerencia' });
    expect(pasillos[1].items.map(i => i.nombre)).toEqual(['Pimienta', 'jengibre']);
  });

  test('creates the pasillo at the end when the list has none for that aisle', () => {
    const { pasillos } = addSuggestionToPasillos(lista(), { ...JENGIBRE, pasillo: 'Panadería' });

    expect(pasillos).toHaveLength(3);
    expect(pasillos[2]).toMatchObject({ nombre: 'Panadería', orden: 3 });
    expect(pasillos[2].items.map(i => i.nombre)).toEqual(['jengibre']);
  });

  test('does not mutate the list it is given', () => {
    const before = lista();
    addSuggestionToPasillos(before, JENGIBRE);

    expect(before).toEqual(lista());
  });
});

describe('removeAddedItem', () => {
  test('add then remove gives back the original list: no duplicate, nothing lost', () => {
    const { pasillos } = addSuggestionToPasillos(lista(), JENGIBRE);

    const after = removeAddedItem(pasillos, { pasilloNombre: 'Especias', itemNombre: 'jengibre', pasillosOriginales: ORIGINALES });

    expect(after).toEqual(lista());
  });

  test('drops a pasillo it empties when that pasillo was not in the original list', () => {
    const { pasillos } = addSuggestionToPasillos(lista(), { ...JENGIBRE, pasillo: 'Panadería' });

    const after = removeAddedItem(pasillos, { pasilloNombre: 'Panadería', itemNombre: 'jengibre', pasillosOriginales: ORIGINALES });

    expect(after.map(p => p.nombre)).toEqual(['Verduras', 'Especias']);
  });

  test('keeps an original pasillo even when its last item goes', () => {
    const original: ShoppingListPasillo[] = [{ nombre: 'Especias', orden: 1, items: [{ nombre: 'jengibre', cantidad: 1, unidad: 'ud', comprado: false, origen: 'sugerencia' }] }];

    const after = removeAddedItem(original, { pasilloNombre: 'Especias', itemNombre: 'jengibre', pasillosOriginales: new Set(['Especias']) });

    expect(after).toEqual([{ nombre: 'Especias', orden: 1, items: [] }]);
  });

  test('never removes an item that came from the meal plan, even when it is named', () => {
    const after = removeAddedItem(lista(), { pasilloNombre: 'Verduras', itemNombre: 'Tomate', pasillosOriginales: ORIGINALES });

    expect(after).toEqual(lista());
  });
});

describe('listAddedSuggestions', () => {
  test('returns the marked items with their aisle and the coordinates the toggle needs', () => {
    const { pasillos } = addSuggestionToPasillos(lista(), JENGIBRE);

    const added = listAddedSuggestions(pasillos);

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ pasilloNombre: 'Especias', pasilloIdx: 1, itemIdx: 1 });
    expect(added[0].item.nombre).toBe('jengibre');
  });

  test('is empty for a list with no suggestion items', () => {
    expect(listAddedSuggestions(lista())).toEqual([]);
  });
});

describe('suggestionFromAddedItem', () => {
  test('rebuilds the carousel card from the stored item', () => {
    const { pasillos, item } = addSuggestionToPasillos(lista(), JENGIBRE);

    expect(suggestionFromAddedItem(pasillos[1].nombre, item)).toEqual(JENGIBRE);
  });

  test('uses 0 when the item has no stored price', () => {
    const card = suggestionFromAddedItem('Especias', { nombre: 'sal', cantidad: 1, unidad: 'ud', comprado: false, origen: 'sugerencia' });

    expect(card.precio_estimado).toBe(0);
  });
});

describe('countPendientes', () => {
  test('counts items not yet bought, so adding goes up by one and removing goes back down', () => {
    const base = lista();
    const { pasillos } = addSuggestionToPasillos(base, JENGIBRE);

    expect(countPendientes(base)).toBe(1);
    expect(countPendientes(pasillos)).toBe(2);
    expect(countPendientes(removeAddedItem(pasillos, { pasilloNombre: 'Especias', itemNombre: 'jengibre', pasillosOriginales: ORIGINALES }))).toBe(1);
  });

  test('a bought suggestion no longer counts as pending', () => {
    const { pasillos } = addSuggestionToPasillos(lista(), JENGIBRE);
    const bought = pasillos.map(p => ({ ...p, items: p.items.map(i => (i.origen ? { ...i, comprado: true } : i)) }));

    expect(countPendientes(bought)).toBe(1);
  });
});
