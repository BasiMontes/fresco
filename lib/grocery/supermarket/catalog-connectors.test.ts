import { describe, expect, test } from 'bun:test';
import { CONSUM_CATALOG_MATCH } from '../consum-catalog.generated';
import { packPrice } from '../estimate-menu-cost';
import { INGREDIENT_DICTIONARY } from '../ingredient-dictionary';
import { mapShoppingListItem } from '../map-item';
import { MERCADONA_CATALOG_MATCH } from '../mercadona-catalog.generated';
import { conectorConsum, conectorMercadona, idMercadonaDeUrl, productosParaCarga, ZONA_CATALOGO } from './catalog-connectors';
import { puedeEjecutarse } from './connector';
import { registroSupermercados } from './registry';

/**
 * FRESCO-767 AC: the connectors return the same price the app shows today.
 * "Today" is `packPrice` (Mercadona) and the catalog's `precioConsum.precio` (Consum), read
 * through the real `mapShoppingListItem` for EVERY dictionary entry backed by
 * that chain, so a drift in either catalog or in the conversion fails here.
 */

const CENTIMO = 0.005;

function entradasDe(origen: 'mercadona' | 'consum') {
  return Object.values(INGREDIENT_DICTIONARY).filter(e => e.origenEnvase === origen);
}

describe('conectorMercadona', () => {
  const entradas = entradasDe('mercadona');

  test('cubre al menos un ingrediente del diccionario', () => {
    expect(entradas.length).toBeGreaterThan(0);
  });

  test.each(entradas.map(e => [e.clave] as const))('%s: mismo precio de envase que hoy', async (clave) => {
    const hoy = packPrice(mapShoppingListItem({ nombre: clave, cantidad: 1, unidad: 'g' }));
    const producto = await conectorMercadona.obtenerProducto(clave, ZONA_CATALOGO);

    expect(producto).not.toBeNull();
    expect(Math.abs(producto!.precioEnvase - hoy)).toBeLessThan(CENTIMO);
  });

  test('lentejas: referencia por unidad vale el envase entero, como hoy', async () => {
    const producto = await conectorMercadona.obtenerProducto('lentejas', ZONA_CATALOGO);
    expect(producto?.precioEnvase).toBe(4);
    expect(producto?.envase).toEqual({ cantidad: 485, unidad: 'g' });
  });

  test('aceite de oliva: 3,90 EUR/L sobre 1 L son 3,90 EUR', async () => {
    const producto = await conectorMercadona.obtenerProducto('aceite de oliva', ZONA_CATALOGO);
    expect(producto?.precioEnvase).toBe(3.9);
    expect(producto?.url).toContain('tienda.mercadona.es');
  });
});

describe('conectorConsum', () => {
  const entradas = entradasDe('consum');

  test('cubre al menos un ingrediente del diccionario', () => {
    expect(entradas.length).toBeGreaterThan(0);
  });

  test.each(entradas.map(e => [e.clave] as const))('%s: mismo precio de envase que hoy', async (clave) => {
    const hoy = CONSUM_CATALOG_MATCH[clave].precioConsum.precio;
    const producto = await conectorConsum.obtenerProducto(clave, ZONA_CATALOGO);

    expect(producto).not.toBeNull();
    expect(producto!.precioEnvase).toBe(hoy);
  });
});

describe('contrato de los conectores', () => {
  test('buscarProductos encuentra por palabra y no por mitad de palabra', async () => {
    const arroz = await conectorMercadona.buscarProductos('Arroz', ZONA_CATALOGO);
    expect(arroz.length).toBeGreaterThan(0);
    expect(arroz.every(p => p.idExterno.split(' ').some(w => w.startsWith('arroz')))).toBe(true);
    expect(await conectorMercadona.buscarProductos('rroz', ZONA_CATALOGO)).toEqual([]);
  });

  test('una zona distinta o un termino vacio no devuelven nada', async () => {
    expect(await conectorConsum.buscarProductos('arroz', 'otra-zona')).toEqual([]);
    expect(await conectorConsum.buscarProductos('  ', ZONA_CATALOGO)).toEqual([]);
    expect(await conectorConsum.obtenerProducto('arroz', 'otra-zona')).toBeNull();
    expect(await conectorConsum.obtenerProducto('no existe', ZONA_CATALOGO)).toBeNull();
  });

  test('todos los productos cumplen el contrato comun', async () => {
    for (const conector of [conectorMercadona, conectorConsum]) {
      const productos = await conector.buscarProductos('a', ZONA_CATALOGO);
      for (const p of productos) {
        expect(p.cadena).toBe(conector.cadena);
        expect(p.precioEnvase).toBeGreaterThan(0);
        expect(p.envase.cantidad).toBeGreaterThan(0);
      }
    }
  });
});

describe('registroSupermercados', () => {
  test('mercadona (ADR-0028) y consum (ADR-0037) son ejecutables', () => {
    expect(registroSupermercados.activos().map(c => c.cadena).sort()).toEqual(['consum', 'mercadona']);
    expect(registroSupermercados.get('mercadona')).toBe(conectorMercadona);
    expect(registroSupermercados.get('consum')).toBe(conectorConsum);
  });

  test('cada conector cita el ADR que justifica su permiso', () => {
    expect(conectorMercadona.permiso).toBe('riesgo-aceptado');
    expect(conectorMercadona.permisoRef).toBe('ADR-0028');
    expect(conectorConsum.permiso).toBe('riesgo-aceptado');
    expect(conectorConsum.permisoRef).toBe('ADR-0037');
    expect(puedeEjecutarse(conectorConsum)).toBe(true);
  });
});

describe('idMercadonaDeUrl', () => {
  test.each([
    ['https://tienda.mercadona.es/product/4640/aceite-oliva-1o-hacendado-botella', '4640'],
    ['https://tienda.mercadona.es/product/81649.1/salmon-rodajas-pieza', '81649.1'],
    ['https://tienda.mercadona.es/product/52734', '52734'],
  ])('%s -> %s', (url, id) => {
    expect(idMercadonaDeUrl(url)).toBe(id);
  });

  test.each([null, '', 'https://tienda.mercadona.es/categories/112', 'https://tienda.mercadona.es/product/abc/x'])('%p -> null', (url) => {
    expect(idMercadonaDeUrl(url)).toBeNull();
  });
});

describe('productosParaCarga', () => {
  test('no Mercadona catalog entry is lost for lack of a usable id', () => {
    const catalogo = Object.keys(MERCADONA_CATALOG_MATCH).length;
    expect(productosParaCarga('mercadona')).toHaveLength(catalogo);
  });

  test('Mercadona products carry Mercadona\'s own id and keep the ingredient they were found for', () => {
    const carga = productosParaCarga('mercadona');
    const salmon = carga.find(c => c.ingrediente === 'salmon');
    expect(salmon?.producto.idExterno).toBe('81649.1');
    for (const { producto } of carga) {
      expect(producto.idExterno).toMatch(/^\d+(\.\d+)?$/);
    }
  });

  test('other chains keep the ingredient key as their id until they have a live connector', () => {
    for (const { ingrediente, producto } of productosParaCarga('consum')) {
      expect(producto.idExterno).toBe(ingrediente);
    }
  });

  test('an unknown chain has nothing to load', () => {
    expect(productosParaCarga('no-existe')).toEqual([]);
  });
});
