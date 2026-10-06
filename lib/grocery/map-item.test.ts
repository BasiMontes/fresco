import type { GroceryInput } from './types';
import { describe, expect, test } from 'bun:test';
import { CONSUM_CATALOG_MATCH } from './consum-catalog.generated';
import { INGREDIENT_DICTIONARY } from './ingredient-dictionary';
import { mapShoppingList, mapShoppingListItem, preciosNormalizados } from './map-item';
import { MERCADONA_CATALOG_MATCH } from './mercadona-catalog.generated';
import { conectorConsum, conectorMercadona } from './supermarket/catalog-connectors';
import { crearRegistro } from './supermarket/connector';

// FRESCO-762: the catalog is refreshed weekly, so pack sizes asserted below
// are read from it instead of hardcoded — a refresh must not break these.
const LECHE_PACK_ML = MERCADONA_CATALOG_MATCH.leche.envaseVenta.cantidad;

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
    expect(r.envasesEstimados).toBe(Math.ceil(1000 / LECHE_PACK_ML));
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
    expect(r.envasesEstimados).toBe(Math.ceil(2500 / LECHE_PACK_ML));
  });

  test('accent-insensitive lookup', () => {
    const conAcento = mapShoppingListItem({ nombre: 'limón', cantidad: 1, unidad: 'unidades' });
    const sinAcento = mapShoppingListItem({ nombre: 'limon', cantidad: 1, unidad: 'unidades' });
    expect(conAcento.productoCanonico).toBe('limón');
    expect(sinAcento.productoCanonico).toBe('limón');
  });
});

describe('mapShoppingListItem — FRESCO-503 acceptance criteria (Mercadona pack/price)', () => {
  test('AC1: ingrediente con equivalente en el catálogo de Mercadona → usa envase y precio reales', () => {
    const r = mapShoppingListItem({ nombre: 'espinacas', cantidad: 200, unidad: 'g' });
    expect(r.origenEnvase).toBe('mercadona');
    expect(r.precios).toHaveLength(1);
    expect(r.precios[0].cadena).toBe('mercadona');
    expect(r.precios[0].precioEnvase).toBeGreaterThan(0);
  });

  test('AC2: ingrediente sin equivalente en el catálogo → usa el envase estimado a mano, nunca se descarta', () => {
    const r = mapShoppingListItem({ nombre: 'kale', cantidad: 150, unidad: 'g' });
    expect(r.origenEnvase).toBe('estimado');
    expect(r.precios).toEqual([]);
    expect(r.unidadVenta).toBe('g'); // RETAIL_PACK_OVERRIDE fallback, item still mapped
  });

  // Exercises the pre-existing FRESCO-488 "unknown ingredient never dropped"
  // invariant, which this story's fallback path also relies on — not AC3's
  // own scenario ("catálogo no disponible"). AC3 is satisfied structurally
  // (no I/O anywhere on the request path), not by a runtime test.
  test('unknown-ingredient fallback (FRESCO-488 invariant): ingrediente fuera del diccionario nunca se bloquea, sigue con origenEnvase estimado', () => {
    const r = mapShoppingListItem({ nombre: 'kombucha casera', cantidad: 500, unidad: 'ml' });
    expect(r.origenEnvase).toBe('estimado');
    expect(r.precios).toEqual([]);
    expect(r.confianza).toBe('baja');
  });
});

describe('mapShoppingListItem — FRESCO-520 acceptance criteria (Consum pack/price)', () => {
  test('AC1: ingrediente con equivalente en el catálogo de Consum → usa envase y precio reales', () => {
    const r = mapShoppingListItem({ nombre: 'alubias rojas', cantidad: 300, unidad: 'g' });
    expect(r.origenEnvase).toBe('consum');
    expect(r.precios).toHaveLength(1);
    expect(r.precios[0].cadena).toBe('consum');
    expect(r.precios[0].precioEnvase).toBeGreaterThan(0);
    expect(r.precios[0].url).not.toBeNull();
  });

  test('AC2: ingrediente sin equivalente en ningún catálogo → usa el envase estimado a mano, nunca se descarta', () => {
    const r = mapShoppingListItem({ nombre: 'kale', cantidad: 150, unidad: 'g' });
    expect(r.origenEnvase).toBe('estimado');
    expect(r.precios).toEqual([]);
  });

  // AC3 ("catálogo no disponible") is satisfied structurally, same posture as FRESCO-503's own AC3 — no I/O on the request path.
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

describe('mapShoppingListItem — FRESCO-768 normalized prices', () => {
  test('a Mercadona item carries one price in the common shape', () => {
    const item = mapShoppingListItem({ nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml' });

    expect(item.origenEnvase).toBe('mercadona');
    expect(item.precios).toHaveLength(1);
    const [precio] = item.precios;
    expect(precio.cadena).toBe('mercadona');
    expect(precio.precioEnvase).toBeGreaterThan(0);
    expect(precio.precioReferencia.por).toBe('l');
    expect(precio.url).toBe(MERCADONA_CATALOG_MATCH['aceite de oliva'].shareUrl);
  });

  test('a Consum item carries its pack price as is (ADR-0037)', () => {
    const consum = Object.values(INGREDIENT_DICTIONARY).find(e => e.origenEnvase === 'consum');
    expect(consum).toBeDefined();
    const item = mapShoppingListItem({ nombre: consum!.clave, cantidad: 1, unidad: 'g' });
    expect(item.precios).toHaveLength(1);
    expect(item.precios[0].cadena).toBe('consum');
    const catalogo = CONSUM_CATALOG_MATCH[consum!.clave];
    expect(item.precios[0].precioEnvase).toBe(catalogo.precioConsum.precio);
    expect(item.precios[0].url).toBe(catalogo.url);
  });

  test('an unknown ingredient carries no prices', () => {
    expect(mapShoppingListItem({ nombre: 'ingrediente-inexistente-xyz', cantidad: 1, unidad: 'g' }).precios).toEqual([]);
  });
});

// FRESCO-790 (A6-P2): ADR-0037 promises that if Consum asks us to stop, the
// switch is ONE line in `supermarket/registry.ts`. These tests prove the claim
// at the point where every price is resolved (`preciosNormalizados`, which the
// shopping list, the cost estimate and the savings cards all go through): with
// Consum out of the registry, or not in a runnable state, no Consum price and
// no Consum link reaches the shopper, and Mercadona is untouched.
describe('Consum kill-switch (ADR-0037)', () => {
  const consum = Object.values(INGREDIENT_DICTIONARY).find(e => e.origenEnvase === 'consum')!;
  const mercadona = Object.values(INGREDIENT_DICTIONARY).find(e => e.origenEnvase === 'mercadona')!;

  test('the registry as shipped prices a Consum ingredient (the switch is on)', () => {
    expect(preciosNormalizados({ entry: consum }).map(p => p.cadena)).toEqual(['consum']);
  });

  test('removing the Consum connector from the registry removes its prices and links', () => {
    const registro = crearRegistro([conectorMercadona]);
    expect(preciosNormalizados({ entry: consum, registro })).toEqual([]);
  });

  test('a Consum connector marked "rechazado" is dropped even though it is still registered', () => {
    const registro = crearRegistro([conectorMercadona, { ...conectorConsum, permiso: 'rechazado' }]);
    expect(preciosNormalizados({ entry: consum, registro })).toEqual([]);
  });

  test('a Consum connector without a cited reference is dropped (fail-closed)', () => {
    const registro = crearRegistro([conectorMercadona, { ...conectorConsum, permisoRef: '' }]);
    expect(preciosNormalizados({ entry: consum, registro })).toEqual([]);
  });

  test('switching Consum off leaves Mercadona prices intact', () => {
    const registro = crearRegistro([conectorMercadona]);
    expect(preciosNormalizados({ entry: mercadona, registro }).map(p => p.cadena)).toEqual(['mercadona']);
  });
});
