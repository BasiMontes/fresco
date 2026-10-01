import type { MercadonaProduct } from '../../scripts/gen-mercadona-catalog';
import { describe, expect, test } from 'bun:test';
import { buildMercadonaCatalogMatch } from '../../scripts/gen-mercadona-catalog';
import { BASE_QUANTITIES } from '../../supabase/functions/generate-shopping-list/consolidator';
import { MERCADONA_CATALOG_MATCH } from './mercadona-catalog.generated';

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
