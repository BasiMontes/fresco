import type { CompraPorItem, LineaCompra } from './compra';
import { describe, expect, test } from 'bun:test';
import { claveItemCompra } from './compra';
import { BASICOS_MARCA_PROPIA, CADENAS_ESTIMADAS, estimarCadenas, precioBaseEstimacion, totalesReales } from './estimacion-cadenas';
import { INGREDIENT_DICTIONARY } from './ingredient-dictionary';
import { MERCADONA_CATALOG_FECHA, MERCADONA_CATALOG_MATCH } from './mercadona-catalog.generated';
import { resolverCompra } from './shopping-list-compra';

const AHORA = new Date(MERCADONA_CATALOG_FECHA);

function enlace(cadena: string, antiguedadDias: number | null, nombreCadena = cadena) {
  return { cadena, nombreCadena, url: `https://example.test/${cadena}`, antiguedadDias };
}

function item(nombre: string) {
  return { nombre, cantidad: 1, unidad: 'unidades', comprado: false };
}

const mercadona = (precio: number, dias: number | null = 3): LineaCompra => ({ precio, enlaces: [enlace('mercadona', dias, 'Mercadona')] });

describe('BASICOS_MARCA_PROPIA', () => {
  test('every staple resolves in the Mercadona catalog and the shopping-list vocabulary', () => {
    for (const clave of BASICOS_MARCA_PROPIA) {
      expect(MERCADONA_CATALOG_MATCH[clave]).toBeDefined();
      expect(INGREDIENT_DICTIONARY[clave]?.origenEnvase).toBe('mercadona');
    }
  });

  test('the five measured chains, and neither Lidl nor Aldi', () => {
    expect(CADENAS_ESTIMADAS.map(c => c.id)).toEqual(['dia', 'carrefour', 'eroski', 'alcampo', 'ahorramas']);
  });
});

describe('precioBaseEstimacion', () => {
  test('a staple with a fresh Mercadona price counts', () => {
    expect(precioBaseEstimacion({ nombre: 'Leche', linea: mercadona(0.96) })).toBe(0.96);
  });

  test('a price that is old but still shown counts', () => {
    expect(precioBaseEstimacion({ nombre: 'arroz', linea: mercadona(1.2, 20) })).toBe(1.2);
  });

  test('a price hidden for age does not count', () => {
    expect(precioBaseEstimacion({ nombre: 'leche', linea: mercadona(0.96, 31) })).toBeUndefined();
  });

  test('a price with no date does not count', () => {
    expect(precioBaseEstimacion({ nombre: 'leche', linea: mercadona(0.96, null) })).toBeUndefined();
  });

  test('a staple with no linked price (stored estimate only) does not count', () => {
    expect(precioBaseEstimacion({ nombre: 'leche', linea: { precio: 0.5, enlaces: [] } })).toBeUndefined();
  });

  test('a staple priced by another chain does not count: the base is Mercadona only', () => {
    expect(precioBaseEstimacion({ nombre: 'leche', linea: { precio: 0.9, enlaces: [enlace('consum', 1)] } })).toBeUndefined();
  });

  test('a product outside the set produces no estimate', () => {
    expect(precioBaseEstimacion({ nombre: 'aceite de oliva', linea: mercadona(3.8) })).toBeUndefined();
    expect(precioBaseEstimacion({ nombre: 'garbanzos', linea: mercadona(1.35) })).toBeUndefined();
    expect(precioBaseEstimacion({ nombre: 'pasta', linea: mercadona(1.4) })).toBeUndefined();
  });
});

describe('estimarCadenas', () => {
  const pasillos = [{ nombre: 'Despensa', items: [item('leche'), item('arroz'), item('aceite de oliva'), item('mantequilla')] }];
  const compra: CompraPorItem = {
    [claveItemCompra({ pasillo: 'Despensa', item: 'leche' })]: { ...mercadona(0.96), precioBaseEstimacion: 0.96 },
    [claveItemCompra({ pasillo: 'Despensa', item: 'arroz' })]: { ...mercadona(1.2), precioBaseEstimacion: 1.2 },
    [claveItemCompra({ pasillo: 'Despensa', item: 'aceite de oliva' })]: mercadona(3.8),
    [claveItemCompra({ pasillo: 'Despensa', item: 'mantequilla' })]: mercadona(2.1, 40),
  };

  test('sums only the staple rows, with factor 1.0, for each of the five chains', () => {
    const resultado = estimarCadenas({ pasillos, compra });

    expect(resultado.map(r => r.nombre)).toEqual(['Dia', 'Carrefour', 'Eroski', 'Alcampo', 'Ahorramás']);
    for (const r of resultado) {
      expect(r.importe).toBe(2.16);
      expect(r.incluidos).toBe(2);
      expect(r.productos).toBe(4);
    }
  });

  test('a list with no staple yields no estimate at all', () => {
    const sinBasicos = [{ nombre: 'Despensa', items: [item('aceite de oliva')] }];
    const c: CompraPorItem = { [claveItemCompra({ pasillo: 'Despensa', item: 'aceite de oliva' })]: mercadona(3.8) };

    expect(estimarCadenas({ pasillos: sinBasicos, compra: c })).toEqual([]);
    expect(estimarCadenas({ pasillos, compra: undefined })).toEqual([]);
  });

  test('reads only the Mercadona base: no other chain price enters the figure', () => {
    const conConsum: CompraPorItem = {
      ...compra,
      [claveItemCompra({ pasillo: 'Despensa', item: 'arroz' })]: { precio: 9.99, enlaces: [enlace('consum', 1)], precioBaseEstimacion: undefined },
    };

    expect(estimarCadenas({ pasillos, compra: conConsum })[0]?.importe).toBe(0.96);
  });
});

describe('totalesReales', () => {
  test('sums each chain through its own linked rows and reports coverage', () => {
    const pasillos = [{ nombre: 'A', items: [item('leche'), item('alubias'), item('tomate'), item('sal')] }];
    const compra: CompraPorItem = {
      [claveItemCompra({ pasillo: 'A', item: 'leche' })]: mercadona(0.96),
      [claveItemCompra({ pasillo: 'A', item: 'alubias' })]: { precio: 1.5, enlaces: [enlace('consum', 2, 'Consum')] },
      [claveItemCompra({ pasillo: 'A', item: 'tomate' })]: mercadona(1.0, 45),
    };

    expect(totalesReales({ pasillos, compra })).toEqual([
      { cadena: 'consum', nombre: 'Consum', importe: 1.5, incluidos: 1, productos: 4 },
      { cadena: 'mercadona', nombre: 'Mercadona', importe: 0.96, incluidos: 1, productos: 4 },
    ]);
  });
});

describe('resolverCompra with the estimate (regression)', () => {
  const pasillos = [{
    nombre: 'Despensa',
    items: [
      { nombre: 'leche', cantidad: 500, unidad: 'ml', comprado: false },
      { nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml', comprado: false },
      { nombre: 'pasta', cantidad: 300, unidad: 'g', comprado: false },
      { nombre: 'aguacate', cantidad: 1, unidad: 'unidades', comprado: false, precio_estimado: 0.9 },
    ],
  }];

  test('only staples carry the estimate base, equal to the Mercadona line price', () => {
    const compra = resolverCompra({ pasillos, ahora: AHORA });
    const leche = compra[claveItemCompra({ pasillo: 'Despensa', item: 'leche' })];

    expect(leche.precioBaseEstimacion).toBeGreaterThan(0);
    expect(leche.precioBaseEstimacion).toBe(leche.precio);
    for (const nombre of ['aceite de oliva', 'pasta', 'aguacate']) {
      expect(compra[claveItemCompra({ pasillo: 'Despensa', item: nombre })].precioBaseEstimacion).toBeUndefined();
    }
  });

  test('a Mercadona price older than 30 days feeds no estimate', () => {
    const tarde = new Date(AHORA.getTime() + 31 * 86_400_000);
    const compra = resolverCompra({ pasillos, ahora: tarde });

    expect(compra[claveItemCompra({ pasillo: 'Despensa', item: 'leche' })].precioBaseEstimacion).toBeUndefined();
    expect(estimarCadenas({ pasillos, compra })).toEqual([]);
  });
});
