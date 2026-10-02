import type { ShoppingListItem } from '@/lib/api/types';
import { describe, expect, test } from 'bun:test';
import { INGREDIENT_DICTIONARY } from './ingredient-dictionary';
import { precioLinea } from './line-price';
import { mapShoppingListItem } from './map-item';

function makeItem(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return { nombre: 'leche', cantidad: 1, unidad: 'l', comprado: false, ...overrides };
}

describe('precioLinea (FRESCO-827 — one price per line, same source as the link)', () => {
  test('a linked product is priced at its whole-pack price times packs needed, ignoring the stored estimate', () => {
    const item = makeItem({ nombre: 'leche', cantidad: 1, unidad: 'l', precio_estimado: 0 });
    const mapped = mapShoppingListItem(item);
    const real = mapped.precios[0];

    expect(real).toBeDefined();
    expect(precioLinea(item)).toBeCloseTo(real.precioEnvase * mapped.envasesEstimados, 2);
    expect(precioLinea(item)).toBeGreaterThan(0);
  });

  test('falls back to the stored estimate when no chain priced the ingredient', () => {
    const item = makeItem({ nombre: 'ingrediente inventado', cantidad: 2, unidad: 'unidades', precio_estimado: 1.23 });

    expect(precioLinea(item)).toBe(1.23);
  });

  test('is undefined when there is neither a linked price nor a stored estimate', () => {
    const item = makeItem({ nombre: 'ingrediente inventado', cantidad: 2, unidad: 'unidades' });

    expect(precioLinea(item)).toBeUndefined();
  });

  test('no dictionary ingredient prices to zero or NaN at its recipe portion', () => {
    for (const entry of Object.values(INGREDIENT_DICTIONARY)) {
      const item = makeItem({ nombre: entry.canonico, cantidad: entry.porcionReceta.cantidad, unidad: entry.porcionReceta.unidad, precio_estimado: 1 });
      const precio = precioLinea(item);

      expect(Number.isFinite(precio)).toBe(true);
      expect(precio).toBeGreaterThan(0);
    }
  });
});
