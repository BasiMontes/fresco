import type { ConsumProduct } from '../../scripts/gen-consum-catalog';
import { existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import {
  buildConsumCatalogMatch,
  CACHE_DIR,
  demasiadosFallos,
  describirDiffCatalogo,
  fechaDeCache,
  parsePackSize,
  renderFile,
} from '../../scripts/gen-consum-catalog';
import { BASE_QUANTITIES } from '../../supabase/functions/generate-shopping-list/consolidator';
import { CONSUM_CATALOG_FECHA, CONSUM_CATALOG_MATCH } from './consum-catalog.generated';

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
    const fresh = renderFile(buildConsumCatalogMatch(candidatesByTerm, BASE_QUANTITIES), await fechaDeCache());
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

// FRESCO-1193: a regeneration must not bring back the wrong matches it produced, and a human reviews what changed.
describe('buildConsumCatalogMatch — the wrong matches of FRESCO-1193', () => {
  function product(name: string, description: string): ConsumProduct {
    return {
      ean: '0000000000000',
      code: name,
      productData: { name, description, url: `https://tienda.consum.es/es/p/${name}/1` },
      priceData: { prices: [{ value: { centAmount: 2 } }] },
    };
  }

  test.each([
    ['tocino', 'Tocino de cielo pack de 2 unidades', 'Tocino de cielo pack de 2 unidades 200 Gr', { cantidad: 200, unidad: 'g' }],
    ['nueces', 'Turrón nata nueces', 'Turrón nata nueces 250 Gr', { cantidad: 100, unidad: 'g' }],
    ['pasta', 'Pasta de lenteja roja', 'Pasta de lenteja roja 250 Gr', { cantidad: 200, unidad: 'g' }],
    ['uvas', 'Uvas de la suerte 12 unidades', 'Uvas de la suerte 12 unidades 30 Gr', { cantidad: 150, unidad: 'g' }],
    ['ternera', 'Yatekomo Ternera Cup', 'Yatekomo Ternera Cup 65 Gr', { cantidad: 500, unidad: 'g' }],
  ] as const)('%s gets no entry when the only candidate is "%s"', (clave, name, description, porcion) => {
    const match = buildConsumCatalogMatch(new Map([[clave, [product(name, description)]]]), { [clave]: porcion });
    expect(match[clave]).toBeUndefined();
  });

  test('with the plain product next to the wrong one, the plain one is picked', () => {
    const candidatos = [
      product('Tocino de cielo pack de 2 unidades', 'Tocino de cielo pack de 2 unidades 200 Gr'),
      product('Tocino fresco entreverado', 'Tocino fresco entreverado 250 Gr'),
    ];
    const match = buildConsumCatalogMatch(new Map([['tocino', candidatos]]), { tocino: { cantidad: 200, unidad: 'g' } });
    expect(match.tocino?.url).toBe('https://tienda.consum.es/es/p/Tocino fresco entreverado/1');
  });
});

// FRESCO-1192: a scheduled run must not turn a blocked or failing Consum into a catalog with no prices.
describe('demasiadosFallos — when a run must not write the catalog', () => {
  test('a few failed search terms are tolerated', () => {
    expect(demasiadosFallos(0, 162)).toBe(false);
    expect(demasiadosFallos(8, 162)).toBe(false);
  });

  test('more than one in twenty failed terms stops the run', () => {
    expect(demasiadosFallos(9, 162)).toBe(true);
    expect(demasiadosFallos(162, 162)).toBe(true);
  });

  test('a run that searched nothing stops too', () => {
    expect(demasiadosFallos(0, 0)).toBe(true);
  });
});

describe('describirDiffCatalogo — what a regeneration changed', () => {
  const entrada = (url: string) => ({ envaseVenta: { cantidad: 100, unidad: 'g' as const }, precioConsum: { precio: 1 }, url });

  test('lists new, changed and removed entries, and nothing for the identical ones', () => {
    const anterior = { arroz: entrada('u/arroz'), jamon: entrada('u/jamon-a'), sal: entrada('u/sal') };
    const nuevo = { arroz: entrada('u/arroz'), jamon: entrada('u/jamon-b'), tocino: entrada('u/tocino') };

    // New and changed entries come together sorted by key; the gone ones follow.
    expect(describirDiffCatalogo(anterior, nuevo)).toEqual([
      '~ jamon: u/jamon-a -> u/jamon-b',
      '+ tocino: u/tocino',
      '- sal: u/sal',
    ]);
  });

  test('is empty when nothing changed', () => {
    const catalogo = { arroz: entrada('u/arroz') };
    expect(describirDiffCatalogo(catalogo, { ...catalogo })).toEqual([]);
  });
});

// FRESCO-1177: the generated file carries the moment the prices were read, so the age rules can apply.
describe('consum-catalog.generated — observation date', () => {
  test('renderFile writes the date it is given', () => {
    expect(renderFile({}, '2026-11-10T15:54:06.619Z')).toContain('export const CONSUM_CATALOG_FECHA = \'2026-11-10T15:54:06.619Z\';');
  });

  test('the committed file carries a real instant, not the epoch', () => {
    expect(new Date(CONSUM_CATALOG_FECHA).getTime()).toBeGreaterThan(Date.UTC(2026, 0, 1));
  });
});
