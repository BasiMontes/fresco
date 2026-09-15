import type { ConsumProduct } from '../../scripts/gen-consum-catalog';
import { existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import {
  buildConsumCatalogMatch,
  CACHE_DIR,
  parsePackSize,
  renderFile,
} from '../../scripts/gen-consum-catalog';
import { BASE_QUANTITIES } from '../../supabase/functions/generate-shopping-list/consolidator';
import { CONSUM_CATALOG_MATCH } from './consum-catalog.generated';

/**
 * FRESCO-520 — mirrors `mercadona-catalog.test.ts`'s posture (FRESCO-503):
 * the committed file must not drift from a fresh generator run, and every
 * entry must be well-formed.
 *
 * The drift check needs the real Consum search payloads
 * (`scripts/.cache/consum-catalog/`, gitignored, populated by running
 * `bun scripts/gen-consum-catalog.ts`). It is SKIPPED, not failed, when that
 * cache is absent (fresh clone, or a CI runner with no network to Consum) —
 * same `skipIf` posture as `mercadona-catalog.test.ts`. Well-formedness and
 * the matching-heuristic / pack-size-parsing tests below need no network.
 */

const CACHE_AVAILABLE = existsSync(CACHE_DIR);

describe.skipIf(!CACHE_AVAILABLE)('consum-catalog.generated — in sync with the cached search results', () => {
  test('committed file matches a fresh generator run', async () => {
    const terms = new Set<string>();
    for (const clave of Object.keys(BASE_QUANTITIES)) {
      if (BASE_QUANTITIES[clave].unidad !== 'g' && BASE_QUANTITIES[clave].unidad !== 'ml') { continue; }
      terms.add(clave);
    }
    const candidatesByTerm = new Map<string, ConsumProduct[]>();
    for (const term of terms) {
      const cachePath = new URL(`${encodeURIComponent(term)}.json`, CACHE_DIR);
      if (existsSync(cachePath)) {
        candidatesByTerm.set(term, JSON.parse(await Bun.file(cachePath).text()));
      }
    }
    const fresh = renderFile(buildConsumCatalogMatch(candidatesByTerm, BASE_QUANTITIES));
    const committed = await Bun.file(new URL('./consum-catalog.generated.ts', import.meta.url)).text();
    expect(committed).toBe(fresh);
  });
});

describe('consum-catalog.generated — every entry is well-formed', () => {
  test('envaseVenta.cantidad is positive and unidad is g or ml', () => {
    for (const match of Object.values(CONSUM_CATALOG_MATCH)) {
      expect(match.envaseVenta.cantidad).toBeGreaterThan(0);
      expect(['g', 'ml']).toContain(match.envaseVenta.unidad);
    }
  });

  test('precioConsum.precio is positive', () => {
    for (const match of Object.values(CONSUM_CATALOG_MATCH)) {
      expect(match.precioConsum.precio).toBeGreaterThan(0);
    }
  });

  test('url is a real Consum product URL', () => {
    for (const match of Object.values(CONSUM_CATALOG_MATCH)) {
      expect(match.url.startsWith('https://tienda.consum.es/es/p/')).toBe(true);
    }
  });

  test('every key is a real g/ml-unit ingredient (Decision 2: no count-based units)', () => {
    for (const clave of Object.keys(CONSUM_CATALOG_MATCH)) {
      const porcion = BASE_QUANTITIES[clave];
      expect(porcion).toBeDefined();
      expect(['g', 'ml']).toContain(porcion.unidad);
    }
  });
});

describe('parsePackSize — pack size extraction from free-text description', () => {
  test('single unit, kg', () => {
    expect(parsePackSize('Arroz Largo 1 Kg')).toEqual({ cantidad: 1000, unidad: 'g' });
  });

  test('single unit, l', () => {
    expect(parsePackSize('Leche Semidesnatada Brik 1 L')).toEqual({ cantidad: 1000, unidad: 'ml' });
  });

  test('single unit, small grams with comma decimal', () => {
    expect(parsePackSize('Azafrán Hebras 0,5 Gr')).toEqual({ cantidad: 1, unidad: 'g' });
  });

  test('multi-pack, N x M unit', () => {
    expect(parsePackSize('Arroz Basmati Vaso Pack de 2 2 x 125 Gr')).toEqual({ cantidad: 250, unidad: 'g' });
  });

  test('cl converts to ml', () => {
    expect(parsePackSize('Bebida Energética Lata 33 Cl')).toEqual({ cantidad: 330, unidad: 'ml' });
  });

  test('loose produce with no quantity in description → null, never a placeholder', () => {
    expect(parsePackSize('Manzana Royal Gala')).toBeNull();
  });

  test('trailing zero-quantity is rejected, never a garbage pack size', () => {
    expect(parsePackSize('Producto Raro 0 Gr')).toBeNull();
  });
});

describe('buildConsumCatalogMatch — matching heuristic (inline fixture, no network)', () => {
  function product(overrides: Partial<ConsumProduct['productData']> & { name: string, description: string }, precio = 2.5): ConsumProduct {
    return {
      ean: '0000000000000',
      code: overrides.name,
      productData: {
        url: `https://tienda.consum.es/es/p/${overrides.name}/1`,
        ...overrides,
      },
      priceData: { prices: [{ value: { centAmount: precio } }] },
    };
  }

  test('matches an eligible g-unit ingredient', () => {
    const candidatesByTerm = new Map([['espinacas', [product({ name: 'Espinacas frescas Hacendado', description: 'Espinacas frescas Hacendado 200 Gr' }, 1.5)]]]);
    const match = buildConsumCatalogMatch(candidatesByTerm, { espinacas: { cantidad: 200, unidad: 'g' } });
    expect(match.espinacas).toEqual({
      envaseVenta: { cantidad: 200, unidad: 'g' },
      precioConsum: { precio: 1.5 },
      url: 'https://tienda.consum.es/es/p/Espinacas frescas Hacendado/1',
    });
  });

  test('"term is the first word" tie-break wins over a shorter unrelated name', () => {
    const candidatesByTerm = new Map([['pan', [
      product({ name: '6 Panes de leche', description: '6 Panes de leche 300 Gr' }),
      product({ name: 'Pan de molde blanco', description: 'Pan de molde blanco 450 Gr' }),
    ]]]);
    const match = buildConsumCatalogMatch(candidatesByTerm, { pan: { cantidad: 250, unidad: 'g' } });
    expect(match.pan?.envaseVenta).toEqual({ cantidad: 450, unidad: 'g' });
  });

  test('no eligible candidate for the target unit → absent from the table, not a placeholder', () => {
    const candidatesByTerm = new Map([['queso', [product({ name: 'Queso curado', description: 'Queso curado 250 Gr' })]]]);
    // Target unit "ml" but the only candidate parses to "g" — no match.
    const match = buildConsumCatalogMatch(candidatesByTerm, { queso: { cantidad: 100, unidad: 'ml' } });
    expect(match.queso).toBeUndefined();
  });

  test('count-based unit (unidades) is never eligible (Decision 2)', () => {
    const candidatesByTerm = new Map([['manzana', [product({ name: 'Manzana Golden', description: 'Manzana Golden 750 Gr' })]]]);
    const match = buildConsumCatalogMatch(candidatesByTerm, { manzana: { cantidad: 2, unidad: 'unidades' } });
    expect(match.manzana).toBeUndefined();
  });

  test('a product with no parseable quantity is skipped, never a zero/garbage pack size', () => {
    const candidatesByTerm = new Map([['arroz', [product({ name: 'Arroz redondo', description: 'Arroz redondo' })]]]);
    const match = buildConsumCatalogMatch(candidatesByTerm, { arroz: { cantidad: 200, unidad: 'g' } });
    expect(match.arroz).toBeUndefined();
  });

  test('falls back to a SYNONYM_OVERRIDE alternate when the canonical term has no match (boniato → batata)', () => {
    const candidatesByTerm = new Map([['batata', [product({ name: 'Batata', description: 'Batata 800 Gr' })]]]);
    const match = buildConsumCatalogMatch(candidatesByTerm, { boniato: { cantidad: 400, unidad: 'g' } });
    expect(match.boniato?.envaseVenta).toEqual({ cantidad: 800, unidad: 'g' });
  });

  test('plausibility guard: an outsized bulk pack is rejected when every candidate exceeds the 20x ratio', () => {
    const candidatesByTerm = new Map([['comino', [product({ name: 'Comino en grano', description: 'Comino en grano 58 Gr' })]]]);
    // 58 g pack vs. a 2 g recipe portion is a 29x multiple — past the 20x guard.
    const match = buildConsumCatalogMatch(candidatesByTerm, { comino: { cantidad: 2, unidad: 'g' } });
    expect(match.comino).toBeUndefined();
  });
});
