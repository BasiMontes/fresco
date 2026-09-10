import type { GroceryInput } from './types';
import { describe, expect, test } from 'bun:test';
import { mapShoppingList, mapShoppingListItem } from './map-item';

describe('mapShoppingListItem — FRESCO-488 acceptance criteria', () => {
  test('AC: ingrediente en unidad no comprable (espinacas 400 g)', () => {
    const r = mapShoppingListItem({ nombre: 'espinacas', cantidad: 400, unidad: 'g' });
    expect(r.unidadVenta).toBe('g');
    expect(r.envasesEstimados).toBeGreaterThan(0);
    expect(r.confianza).toBe('alta');
  });

  test('AC: nombre con contexto de receta perdido (salmón → salmón ahumado)', () => {
    const r = mapShoppingListItem({
      nombre: 'salmón',
      cantidad: 600,
      unidad: 'g',
      usos: [{ receta: 'Tostada con salmón ahumado' }],
    });
    expect(r.terminoBusqueda).toContain('ahumado');
    expect(r.productoCanonico).toBe('salmón ahumado');
    expect(r.confianza).toBe('media');
  });

  test('AC: ingrediente fuera del diccionario (alga nori)', () => {
    const r = mapShoppingListItem({ nombre: 'alga nori', cantidad: 2, unidad: 'unidades' });
    expect(r.productoCanonico).toBe('alga nori');
    expect(r.terminoBusqueda).toBe('alga nori');
    expect(r.pasillo).toBeNull();
    expect(r.confianza).toBe('baja');
    expect(r.envasesEstimados).toBe(1);
  });

  test('AC: unidad por piezas (manzana 4 unidades)', () => {
    const r = mapShoppingListItem({ nombre: 'manzana', cantidad: 4, unidad: 'unidades' });
    expect(r.envasesEstimados).toBe(4);
    expect(r.unidadVenta).toBe('unidad');
    expect(r.confianza).toBe('alta');
  });
});

describe('mapShoppingListItem — unit handling', () => {
  test('kg is normalized to g', () => {
    const r = mapShoppingListItem({ nombre: 'coliflor', cantidad: 1, unidad: 'kg' });
    expect(r.cantidadNormalizada).toBe(1000);
    expect(r.unidadVenta).toBe('g');
  });

  test('l is normalized to ml', () => {
    const r = mapShoppingListItem({ nombre: 'leche', cantidad: 1, unidad: 'l' });
    expect(r.cantidadNormalizada).toBe(1000);
    expect(r.unidadVenta).toBe('ml');
    expect(r.envasesEstimados).toBe(1); // 1000 ml / 1000 ml brick
  });

  test('dientes convert to a cabeza pack', () => {
    const r = mapShoppingListItem({ nombre: 'ajo', cantidad: 3, unidad: 'dientes' });
    expect(r.unidadVenta).toBe('cabeza');
    expect(r.envasesEstimados).toBe(1);
  });

  test('rebanadas convert to a paquete pack', () => {
    const r = mapShoppingListItem({ nombre: 'pan integral', cantidad: 6, unidad: 'rebanadas' });
    expect(r.unidadVenta).toBe('paquete');
    expect(r.envasesEstimados).toBe(1);
  });

  test('quantity over one pack rounds up', () => {
    const r = mapShoppingListItem({ nombre: 'leche', cantidad: 2500, unidad: 'ml' });
    expect(r.envasesEstimados).toBe(3); // ceil(2500 / 1000)
  });

  test('accent-insensitive lookup', () => {
    const conAcento = mapShoppingListItem({ nombre: 'limón', cantidad: 1, unidad: 'unidades' });
    const sinAcento = mapShoppingListItem({ nombre: 'limon', cantidad: 1, unidad: 'unidades' });
    expect(conAcento.productoCanonico).toBe('limón');
    expect(sinAcento.productoCanonico).toBe('limón');
  });
});

describe('mapShoppingListItem — invariants', () => {
  test('deterministic: same input, same output', () => {
    const input: GroceryInput = {
      nombre: 'tomate',
      cantidad: 300,
      unidad: 'g',
      usos: [{ receta: 'Ensalada' }],
    };
    expect(mapShoppingListItem(input)).toEqual(mapShoppingListItem(input));
  });

  test('never drops an unknown ingredient, keeps its quantity', () => {
    const r = mapShoppingListItem({ nombre: 'kombucha casera', cantidad: 500, unidad: 'ml' });
    expect(r.nombreOriginal).toBe('kombucha casera');
    expect(r.cantidadNormalizada).toBe(500);
    expect(r.confianza).toBe('baja');
  });

  test('empty usos does not trigger recovery', () => {
    const r = mapShoppingListItem({ nombre: 'salmón', cantidad: 400, unidad: 'g', usos: [] });
    expect(r.productoCanonico).toBe('salmón');
    expect(r.confianza).toBe('alta');
  });

  test('recovery does not fire when the recipe lacks the qualifier', () => {
    const r = mapShoppingListItem({
      nombre: 'salmón',
      cantidad: 400,
      unidad: 'g',
      usos: [{ receta: 'Salmón a la plancha con eneldo' }],
    });
    expect(r.productoCanonico).toBe('salmón');
  });

  test('recovery fires on a real qualifier past the stopwords (pan → pan de centeno)', () => {
    const r = mapShoppingListItem({
      nombre: 'pan',
      cantidad: 4,
      unidad: 'rebanadas',
      usos: [{ receta: 'Tostada de pan de centeno con aguacate' }],
    });
    expect(r.productoCanonico).toBe('pan de centeno');
    expect(r.confianza).toBe('media');
  });

  test('recovery is not tricked by a stopword-only difference (pan, recipe just says pan)', () => {
    const r = mapShoppingListItem({
      nombre: 'pan',
      cantidad: 4,
      unidad: 'rebanadas',
      usos: [{ receta: 'Tostada de pan con tomate' }],
    });
    expect(r.productoCanonico).toBe('pan');
  });

  test('envasesEstimados is always at least 1', () => {
    const r = mapShoppingListItem({ nombre: 'canela', cantidad: 3, unidad: 'g' });
    expect(r.envasesEstimados).toBeGreaterThanOrEqual(1);
  });

  test('mapShoppingList maps a whole list', () => {
    const out = mapShoppingList([
      { nombre: 'ajo', cantidad: 3, unidad: 'dientes' },
      { nombre: 'alga nori', cantidad: 1, unidad: 'unidades' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].confianza).toBe('alta');
    expect(out[1].confianza).toBe('baja');
  });
});
