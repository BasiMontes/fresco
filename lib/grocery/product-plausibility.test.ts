import type { ProductoSupermercado } from './supermarket/types';
import { describe, expect, test } from 'bun:test';
import { CONSUM_CATALOG_MATCH } from './consum-catalog.generated';
import { MERCADONA_CATALOG_MATCH } from './mercadona-catalog.generated';
import { esProductoPlausible } from './product-plausibility';
import { emparejarIngrediente } from './supermarket/matcher';

/**
 * FRESCO-785 — a shopping-list link or price must never point at the wrong
 * product. The cases below are the ones observed in the audit-6 run on staging
 * plus the generated-catalog regression for the most used ingredients.
 */

describe('esProductoPlausible — the 6 observed wrong matches are rejected', () => {
  const observados: [string, string, string][] = [
    ['fideos', 'Fideos chocolate Hacendado especial repostería postres paquete', 'pastry sprinkles'],
    ['nueces', 'Trenza con nueces 4 pieza', 'bakery'],
    ['nueces', 'Bifidus desnatado con nueces cereales Hacendado pack 4', 'dairy with nuts as an add-in'],
    ['pechuga de pollo', 'Pechuga pollo 92% Hacendado lonchas paquete', 'cold cut'],
    ['salmon', 'Salmón ahumado noruego', 'smoked, the ingredient did not ask for it'],
    ['carne picada', 'Preparado carne picada cerdo bandeja', 'pork, not named by the ingredient'],
  ];

  test.each(observados)('%s does not resolve to "%s" (%s)', (ingrediente, producto) => {
    expect(esProductoPlausible(ingrediente, producto)).toBe(false);
  });
});

describe('esProductoPlausible — real products stay eligible', () => {
  const validos: [string, string][] = [
    ['aceite de oliva', 'Aceite oliva 1º Hacendado botella'],
    ['pechuga de pollo', 'Filetes pechuga pollo bandeja'],
    ['salmon', 'Salmón rodajas pieza'],
    ['salmon ahumado', 'Salmón ahumado noruego lonchas'],
    ['muslos de pollo', 'Muslos pollo deshuesados con piel bandeja'],
    ['carne picada de ternera', 'Carne picada ternera bandeja'],
    ['espinacas', 'Espinacas baby paquete'],
    ['sal', 'Sal fina Hacendado paquete'],
  ];

  test.each(validos)('%s accepts "%s"', (ingrediente, producto) => {
    expect(esProductoPlausible(ingrediente, producto)).toBe(true);
  });
});

describe('esProductoPlausible — species guard (Halal without reading the profile)', () => {
  test('a generic meat ingredient rejects a pork product', () => {
    expect(esProductoPlausible('carne picada', 'Carne picada cerdo bandeja')).toBe(false);
  });

  test('a generic meat ingredient rejects a pork and beef blend', () => {
    expect(esProductoPlausible('carne picada', 'Carne picada mixta Hacendado')).toBe(false);
  });

  test('an ingredient that names its species keeps its own species', () => {
    expect(esProductoPlausible('carne picada de ternera', 'Carne picada ternera bandeja')).toBe(true);
  });

  test('a ready meal built on a protein is not the protein', () => {
    expect(esProductoPlausible('merluza', 'Merluza con pisto al pimentón')).toBe(false);
  });
});

describe('emparejarIngrediente — the runtime matcher shares the guard', () => {
  function producto(id: string, nombre: string, precioEnvase: number): ProductoSupermercado {
    return {
      cadena: 'mercadona',
      idExterno: id,
      nombre,
      marca: null,
      envase: { cantidad: 500, unidad: 'g' },
      precioEnvase,
      url: `https://example.test/${id}`,
      disponible: true,
      zona: 'catalogo',
      observadoEn: '2026-10-02T00:00:00.000Z',
    };
  }

  test('skips the cheaper wrong product and takes the right one', () => {
    const match = emparejarIngrediente({
      ingrediente: { terminos: ['nueces'], porcion: { cantidad: 50, unidad: 'g' } },
      candidatos: [producto('trenza', 'Trenza con nueces', 1), producto('nueces', 'Nueces peladas Hacendado', 4)],
    });
    expect(match?.producto.idExterno).toBe('nueces');
  });

  test('returns no match when only wrong products exist', () => {
    const match = emparejarIngrediente({
      ingrediente: { terminos: ['carne picada'], porcion: { cantidad: 400, unidad: 'g' } },
      candidatos: [producto('cerdo', 'Preparado carne picada cerdo bandeja', 3)],
    });
    expect(match).toBeNull();
  });

  test('a term does not match inside a longer word ("sal" is not "salsa")', () => {
    const match = emparejarIngrediente({
      ingrediente: { terminos: ['sal'], porcion: { cantidad: 10, unidad: 'g' } },
      candidatos: [producto('salsa', 'Salsa trufas bote', 2)],
    });
    expect(match).toBeNull();
  });
});

describe('generated catalogs — no wrong product for the observed or most used ingredients', () => {
  const MAS_USADOS = [
    'aceite de oliva',
    'arroz',
    'tomate',
    'patata',
    'pasta',
    'leche',
    'pechuga de pollo',
    'salmon',
    'carne picada',
    'sal',
    'queso',
    'atun',
    'lentejas',
    'garbanzos',
    'merluza',
    'mantequilla',
    'champinones',
    'espinacas',
    'brocoli',
    'fideos',
    'nueces',
  ];

  function nombreDeUrl(url: string): string {
    return decodeURIComponent(new URL(url).pathname)
      .replace(/^\/product\/[\d.]+\//, '')
      .replace(/^\/es\/p\//, '')
      .replace(/\/\d+$/, '')
      .replaceAll('-', ' ');
  }

  test.each(MAS_USADOS)('%s links to a plausible product in every chain that has one', (clave) => {
    const mercadona = MERCADONA_CATALOG_MATCH[clave];
    const consum = CONSUM_CATALOG_MATCH[clave];
    if (mercadona) {
      expect(esProductoPlausible(clave, nombreDeUrl(mercadona.shareUrl))).toBe(true);
    }
    if (consum) {
      expect(esProductoPlausible(clave, nombreDeUrl(consum.url))).toBe(true);
    }
  });

  test.each(['fideos', 'nueces', 'carne picada'])('%s has no Mercadona link (no reliable match)', (clave) => {
    expect(MERCADONA_CATALOG_MATCH[clave as keyof typeof MERCADONA_CATALOG_MATCH]).toBeUndefined();
  });

  test('no entry points to a pork product when the ingredient does not name pork', () => {
    const urls = [
      ...Object.entries(MERCADONA_CATALOG_MATCH).map(([clave, m]) => [clave, m.shareUrl] as const),
      ...Object.entries(CONSUM_CATALOG_MATCH).map(([clave, m]) => [clave, m.url] as const),
    ];
    // Only generic meat ingredients: "tocino" or "bacon" are pork by definition.
    const cerdoSinPedirlo = urls.filter(([clave, url]) =>
      /\b(?:carne|pechuga|filete|chuleta|solomillo|picada)\b/.test(clave)
      && /\bcerdo\b/.test(nombreDeUrl(url))
      && !/\bcerdo\b/.test(clave),
    );
    expect(cerdoSinPedirlo).toEqual([]);
  });
});
