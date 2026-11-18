import type { MercadonaProduct } from '../../scripts/gen-mercadona-catalog';
import { describe, expect, test } from 'bun:test';
import { buildMercadonaCatalogMatch, PRODUCTOS_FIJADOS, renderFile } from '../../scripts/gen-mercadona-catalog';
import { BASE_QUANTITIES } from '../../supabase/functions/generate-shopping-list/consolidator';
import { MERCADONA_CATALOG_FECHA, MERCADONA_CATALOG_MATCH } from './mercadona-catalog.generated';

/**
 * FRESCO-503 — every entry of `mercadona-catalog.generated.ts` must be
 * well-formed, and the matching heuristic must behave on an inline fixture
 * catalog. Needs no network and no local cache.
 *
 * FRESCO-762: there is deliberately no "committed file matches a fresh
 * generator run" test here. The file is regenerated weekly from a moving
 * dataset, so comparing it with a local, gitignored cache fails whenever that
 * cache is a different week's snapshot. That check now lives in the generator
 * as an explicit, opt-in mode: `bun scripts/gen-mercadona-catalog.ts --check`.
 */

describe('mercadona-catalog.generated — every entry is well-formed', () => {
  test('envaseVenta.cantidad is positive and unidad is g or ml', () => {
    for (const match of Object.values(MERCADONA_CATALOG_MATCH)) {
      expect(match.envaseVenta.cantidad).toBeGreaterThan(0);
      expect(['g', 'ml']).toContain(match.envaseVenta.unidad);
    }
  });

  test('precioMercadona.precioReferencia is positive and formatoReferencia is non-empty', () => {
    for (const match of Object.values(MERCADONA_CATALOG_MATCH)) {
      expect(match.precioMercadona.precioReferencia).toBeGreaterThan(0);
      expect(match.precioMercadona.formatoReferencia.length).toBeGreaterThan(0);
    }
  });

  test('shareUrl is a real Mercadona product URL', () => {
    for (const match of Object.values(MERCADONA_CATALOG_MATCH)) {
      expect(match.shareUrl.startsWith('https://tienda.mercadona.es/product/')).toBe(true);
    }
  });

  test('every key is a real g/ml-unit ingredient (Decision 2: no count-based units)', () => {
    for (const clave of Object.keys(MERCADONA_CATALOG_MATCH)) {
      const porcion = BASE_QUANTITIES[clave];
      expect(porcion).toBeDefined();
      expect(['g', 'ml']).toContain(porcion.unidad);
    }
  });
});

describe('buildMercadonaCatalogMatch — matching heuristic (inline fixture, no network)', () => {
  function product(overrides: Partial<MercadonaProduct> & { display_name: string }): MercadonaProduct {
    return {
      id: overrides.display_name,
      share_url: `https://tienda.mercadona.es/product/${overrides.display_name}`,
      price_instructions: {
        reference_price: '2.50',
        reference_format: 'kg',
        unit_size: 0.5,
        size_format: 'kg',
      },
      ...overrides,
    };
  }

  test('matches an eligible g-unit ingredient against a kg-sized product', () => {
    const catalog = [product({ display_name: 'Espinacas frescas Hacendado' })];
    const match = buildMercadonaCatalogMatch(catalog, { espinacas: { cantidad: 200, unidad: 'g' } });
    expect(match.espinacas).toEqual({
      envaseVenta: { cantidad: 500, unidad: 'g' },
      precioMercadona: { precioReferencia: 2.5, formatoReferencia: 'kg' },
      shareUrl: 'https://tienda.mercadona.es/product/Espinacas frescas Hacendado',
    });
  });

  test('"term is the first word" tie-break wins over a shorter unrelated name', () => {
    const catalog = [
      product({ display_name: 'Compango para fabada', id: 'compango' }), // contains "pan"? no — real noise case: "pan" mid-word
      product({ display_name: '6 Panes de leche 3%', id: 'panes-leche', price_instructions: { reference_price: '3.00', reference_format: 'kg', unit_size: 0.3, size_format: 'kg' } }),
      product({ display_name: 'Pan de molde blanco Hacendado', id: 'pan-molde', price_instructions: { reference_price: '2.33', reference_format: 'kg', unit_size: 0.45, size_format: 'kg' } }),
    ];
    const match = buildMercadonaCatalogMatch(catalog, { pan: { cantidad: 250, unidad: 'g' } });
    expect(match.pan?.envaseVenta).toEqual({ cantidad: 450, unidad: 'g' });
  });

  test('no eligible candidate for the size format → absent from the table, not a placeholder', () => {
    const catalog = [product({ display_name: 'Leche entera Hacendado', price_instructions: { reference_price: '0.90', reference_format: 'L', unit_size: 1, size_format: 'l' } })];
    // "queso" needs a kg-sized match; only an l-sized product exists.
    const match = buildMercadonaCatalogMatch(catalog, { queso: { cantidad: 250, unidad: 'g' } });
    expect(match.queso).toBeUndefined();
  });

  test('count-based unit (unidades) is never eligible (Decision 2)', () => {
    const catalog = [product({ display_name: 'Manzana Golden Hacendado' })];
    const match = buildMercadonaCatalogMatch(catalog, { manzana: { cantidad: 2, unidad: 'unidades' } });
    expect(match.manzana).toBeUndefined();
  });

  test('a product missing unit_size or reference_price is skipped, never a zero/garbage pack size', () => {
    const catalog = [
      product({ display_name: 'Arroz redondo Hacendado', price_instructions: { reference_price: '2.00', reference_format: 'kg', unit_size: null, size_format: 'kg' } }),
      product({ display_name: 'Arroz redondo Hacendado', price_instructions: { reference_price: '0', reference_format: 'kg', unit_size: 0.5, size_format: 'kg' } }),
    ];
    const match = buildMercadonaCatalogMatch(catalog, { arroz: { cantidad: 200, unidad: 'g' } });
    expect(match.arroz).toBeUndefined();
  });

  test('a sub-gram computed pack size (rounds to 0) is skipped rather than emitted as 0', () => {
    const catalog = [product({ display_name: 'Azafran en hebra Hacendado', price_instructions: { reference_price: '400', reference_format: '100 g', unit_size: 0.0002, size_format: 'kg' } })];
    const match = buildMercadonaCatalogMatch(catalog, { azafran: { cantidad: 1, unidad: 'g' } });
    expect(match.azafran).toBeUndefined();
  });

  test('falls back to a SYNONYM_OVERRIDE alternate when the canonical term has no match (boniato → batata)', () => {
    const catalog = [product({ display_name: 'Batata Hacendado', price_instructions: { reference_price: '1.80', reference_format: 'kg', unit_size: 0.8, size_format: 'kg' } })];
    const match = buildMercadonaCatalogMatch(catalog, { boniato: { cantidad: 400, unidad: 'g' } });
    expect(match.boniato?.envaseVenta).toEqual({ cantidad: 800, unidad: 'g' });
  });

  test('plausibility guard: an outsized bulk pack loses the shortest-name tie-break to a plausible one (jamón serrano regression)', () => {
    const catalog = [
      // Shorter name, wins on raw length alone — but 7.5 kg is a 75x multiple
      // of the 100 g recipe portion, an implausible single-recipe purchase.
      product({ display_name: 'Jamon serrano', id: 'jamon-serrano-lote', price_instructions: { reference_price: '9.559', reference_format: 'kg', unit_size: 7.5, size_format: 'kg' } }),
      // Longer name, but a 190 g pack is a plausible 1.9x multiple.
      product({ display_name: 'Jamon serrano en lonchas Hacendado', id: 'jamon-serrano-lonchas', price_instructions: { reference_price: '25', reference_format: 'kg', unit_size: 0.19, size_format: 'kg' } }),
    ];
    const match = buildMercadonaCatalogMatch(catalog, { 'jamon serrano': { cantidad: 100, unidad: 'g' } });
    expect(match['jamon serrano']?.envaseVenta).toEqual({ cantidad: 190, unidad: 'g' });
  });

  test('plausibility guard: when every candidate is implausibly oversized, the ingredient is unmatched, not forced onto the bulk pack', () => {
    const catalog = [product({ display_name: 'Comino en grano Hacendado', price_instructions: { reference_price: '19.828', reference_format: 'kg', unit_size: 0.058, size_format: 'kg' } })];
    // 58 g pack vs. a 2 g recipe portion is a 29x multiple — past the 20x guard.
    const match = buildMercadonaCatalogMatch(catalog, { comino: { cantidad: 2, unidad: 'g' } });
    expect(match.comino).toBeUndefined();
  });
});

// FRESCO-1223: three staples of the catalog were checked against the dataset; two were wrong and are pinned.
describe('buildMercadonaCatalogMatch — pinned staples (FRESCO-1223)', () => {
  function pack(display_name: string, id: string, reference_price: string, unit_size: number): MercadonaProduct {
    return {
      id,
      display_name,
      share_url: `https://tienda.mercadona.es/product/${id}`,
      price_instructions: { reference_price, reference_format: 'kg', unit_size, size_format: 'kg' },
    };
  }
  const garbanzos = [
    pack('Garbanzos a la riojana Hacendado', 'riojana', '3.215', 0.42),
    pack('Garbanzo cocido Hacendado', 'cocido', '2.000', 0.57),
  ];
  const porcion = { garbanzos: { cantidad: 400, unidad: 'g' } };

  test('a pinned product wins over the heuristic pick, and is the one the generator emits', () => {
    const match = buildMercadonaCatalogMatch(garbanzos, porcion, { garbanzos: 'cocido' });
    expect(match.garbanzos?.shareUrl).toBe('https://tienda.mercadona.es/product/cocido');
    expect(match.garbanzos?.envaseVenta).toEqual({ cantidad: 570, unidad: 'g' });
  });

  test('a pin whose product left the dataset falls back to the heuristic instead of emptying the key', () => {
    const match = buildMercadonaCatalogMatch(garbanzos, porcion, { garbanzos: 'ya-no-existe' });
    // The stew is excluded by the plausibility guard, so the only candidate left is the singular product,
    // which the plural term does not name: no match, never the stew.
    expect(match.garbanzos?.shareUrl ?? '').not.toContain('riojana');
  });

  test('every pin names a real ingredient key of the catalog', () => {
    for (const clave of Object.keys(PRODUCTOS_FIJADOS)) {
      expect(BASE_QUANTITIES[clave]).toBeDefined();
    }
  });

  test('the committed catalog holds the verified products for garbanzos, pasta and aceite de oliva', () => {
    // garbanzos: the cooked chickpea, not the "a la riojana" stew; Alcampo and Eroski sell it at the same 2,00 EUR/kg.
    expect(MERCADONA_CATALOG_MATCH.garbanzos.shareUrl).toContain('/26029/garbanzo-cocido-hacendado');
    expect(MERCADONA_CATALOG_MATCH.garbanzos.precioMercadona.precioReferencia).toBe(2);
    // pasta: the house brand at 1,70 EUR/kg, not a manufacturer's brand at 2,80.
    expect(MERCADONA_CATALOG_MATCH.pasta.shareUrl).toContain('/8138/pasta-penne-rigate-hacendado');
    // aceite de oliva: verified, no error. The 1º blend is a fair generic "aceite de oliva".
    expect(MERCADONA_CATALOG_MATCH['aceite de oliva'].shareUrl).toContain('aceite-oliva-1o-hacendado');
  });
});

// FRESCO-1177: the generated file carries the date of the dataset snapshot, so the age rules can apply.
describe('mercadona-catalog.generated — snapshot date', () => {
  test('renderFile writes the snapshot date it is given', () => {
    expect(renderFile({}, '2026-11-09T06:35:46.000Z')).toContain('export const MERCADONA_CATALOG_FECHA = \'2026-11-09T06:35:46.000Z\';');
  });

  test('the committed file carries a real instant, not the epoch', () => {
    expect(new Date(MERCADONA_CATALOG_FECHA).getTime()).toBeGreaterThan(Date.UTC(2026, 0, 1));
  });
});
