import { afterAll, beforeAll, describe, expect, setSystemTime, test } from 'bun:test';
import { CONSUM_CATALOG_FECHA, CONSUM_CATALOG_MATCH } from '../consum-catalog.generated';
import { packPrice } from '../estimate-menu-cost';
import { INGREDIENT_DICTIONARY } from '../ingredient-dictionary';
import { mapShoppingListItem, preciosNormalizados } from '../map-item';
import { MERCADONA_CATALOG_FECHA, MERCADONA_CATALOG_MATCH } from '../mercadona-catalog.generated';
import { conectorConsum, conectorMercadona, crearConectorDeCatalogo, idMercadonaDeUrl, productoDeCatalogo, productosParaCarga, ZONA_CATALOGO } from './catalog-connectors';
import { crearRegistro, puedeEjecutarse } from './connector';
import { crearConectorFalso } from './fake-connector';
import { registroSupermercados } from './registry';

/**
 * FRESCO-767 AC: the connectors return the same price the app shows today.
 * "Today" is `packPrice` (Mercadona) and the catalog's `precioConsum.precio` (Consum), read
 * through the real `mapShoppingListItem` for EVERY dictionary entry backed by
 * that chain, so a drift in either catalog or in the conversion fails here.
 */

// FRESCO-1177: a catalog price now has a date and stops counting after 30 days, so the clock is pinned to the
// day the catalogs were read; without it these tests would start failing a month after each regeneration.
beforeAll(() => setSystemTime(new Date(CONSUM_CATALOG_FECHA)));
afterAll(() => setSystemTime());

const CENTIMO = 0.005;

// FRESCO-1177: every product carries the date of its catalog, never the Unix epoch of "unknown".
describe('observadoEn of the catalog connectors', () => {
  test('every Mercadona and Consum product carries its catalog date', () => {
    for (const [conector, fecha] of [[conectorMercadona, MERCADONA_CATALOG_FECHA], [conectorConsum, CONSUM_CATALOG_FECHA]] as const) {
      const productos = productosParaCarga(conector);
      expect(productos.length).toBeGreaterThan(0);
      for (const { producto } of productos) { expect(producto.observadoEn).toBe(fecha); }
    }
  });

  test('the dates are real instants after the epoch', () => {
    for (const fecha of [MERCADONA_CATALOG_FECHA, CONSUM_CATALOG_FECHA]) {
      expect(new Date(fecha).getTime()).toBeGreaterThan(Date.UTC(2026, 0, 1));
    }
  });
});

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

  // FRESCO-1139: the catalog is regenerated every week, so no real price or pack size is written in these
  // two tests. They read the catalog and the dictionary and check the format the arithmetic depends on:
  // a price change moves nothing, a format change fails with a message that says what changed.
  test('lentejas: referencia por unidad vale el envase entero, como hoy', async () => {
    const lentejas = MERCADONA_CATALOG_MATCH.lentejas.precioMercadona;
    expect(lentejas.formatoReferencia).toBe('ud');
    const producto = await conectorMercadona.obtenerProducto('lentejas', ZONA_CATALOGO);
    expect(producto?.precioEnvase).toBe(lentejas.precioReferencia);
    expect(producto?.envase).toEqual(INGREDIENT_DICTIONARY.lentejas.envaseVenta);
  });

  test('aceite de oliva: el precio por litro sobre 1 L es el precio del envase', async () => {
    const aceite = MERCADONA_CATALOG_MATCH['aceite de oliva'].precioMercadona;
    expect(aceite.formatoReferencia).toBe('L');
    expect(INGREDIENT_DICTIONARY['aceite de oliva'].envaseVenta).toEqual({ cantidad: 1000, unidad: 'ml' });
    const producto = await conectorMercadona.obtenerProducto('aceite de oliva', ZONA_CATALOGO);
    expect(producto?.precioEnvase).toBeCloseTo(aceite.precioReferencia, 2);
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
    expect(productosParaCarga(conectorMercadona)).toHaveLength(catalogo);
  });

  test('Mercadona products carry Mercadona\'s own id and keep the ingredient they were found for', () => {
    const carga = productosParaCarga(conectorMercadona);
    const salmon = carga.find(c => c.ingrediente === 'salmon');
    expect(salmon?.producto.idExterno).toBe('87205');
    for (const { producto } of carga) {
      expect(producto.idExterno).toMatch(/^\d+(\.\d+)?$/);
    }
  });

  test('other chains keep the ingredient key as their id until they have a live connector', () => {
    for (const { ingrediente, producto } of productosParaCarga(conectorConsum)) {
      expect(producto.idExterno).toBe(ingrediente);
    }
  });

  test('a connector with no catalog has nothing to load', () => {
    expect(productosParaCarga(crearConectorFalso())).toEqual([]);
  });
});

/**
 * FRESCO-808: a connector that may not run serves nothing, by ANY path, not
 * only through the registry. Built from the same catalog as Consum's, so the
 * only thing that differs from a working connector is the permission.
 */
describe('permission gate on every read path', () => {
  const entradas = [{ clave: 'arroz', envaseVenta: { cantidad: 1000, unidad: 'g' }, precioEnvase: 1.2, url: 'https://tienda.example/arroz' }];
  const base = { cadena: 'cadenafalsa', nombre: 'Cadena falsa' } as const;
  const conectorCon = (permiso: 'concedido' | 'riesgo-aceptado' | 'pendiente' | 'rechazado', permisoRef: string) =>
    crearConectorDeCatalogo({ ...base, permiso, permisoRef, observadoEn: '2026-11-09T06:35:46.000Z' }, entradas);

  test('a runnable connector serves its catalog (control)', async () => {
    const conector = conectorCon('concedido', 'FIXTURE-1');
    expect(await conector.obtenerProducto('arroz', ZONA_CATALOGO)).not.toBeNull();
    expect(await conector.buscarProductos('arroz', ZONA_CATALOGO)).toHaveLength(1);
    expect(productoDeCatalogo(conector, 'arroz')).not.toBeNull();
    expect(productosParaCarga(conector)).toHaveLength(1);
  });

  test.each([
    ['pendiente', 'FIXTURE-1'],
    ['rechazado', 'FIXTURE-1'],
    ['concedido', '   '],
    ['riesgo-aceptado', ''],
  ] as const)('permission "%s" with reference "%s" returns nothing by any path', async (permiso, permisoRef) => {
    const conector = conectorCon(permiso, permisoRef);
    expect(await conector.obtenerProducto('arroz', ZONA_CATALOGO)).toBeNull();
    expect(await conector.buscarProductos('arroz', ZONA_CATALOGO)).toEqual([]);
    expect(productoDeCatalogo(conector, 'arroz')).toBeNull();
    expect(productosParaCarga(conector)).toEqual([]);
  });
});

/**
 * FRESCO-808 close criterion: adding a chain is a connector plus one registry
 * entry. A made-up chain flows through pricing and the open `OrigenEnvase`
 * without touching a component or a type.
 */
describe('a chain nobody wrote code for', () => {
  const conector = crearConectorDeCatalogo(
    { cadena: 'cadenafalsa', nombre: 'Cadena falsa', permiso: 'concedido', permisoRef: 'FIXTURE-1', observadoEn: '2026-11-09T06:35:46.000Z' },
    [{ clave: 'arroz', envaseVenta: { cantidad: 1000, unidad: 'g' }, precioEnvase: 1.2, url: 'https://cadena.example/arroz' }],
  );
  const registro = crearRegistro([conector]);

  test('prices an ingredient whose pack comes from it', () => {
    const entry = { clave: 'arroz', origenEnvase: 'cadenafalsa' };
    const precios = preciosNormalizados({ entry, registro });
    expect(precios).toHaveLength(1);
    expect(precios[0]).toMatchObject({ cadena: 'cadenafalsa', precioEnvase: 1.2, url: 'https://cadena.example/arroz' });
  });

  test('a chain whose pack is not the entry\'s is not priced', () => {
    expect(preciosNormalizados({ entry: { clave: 'arroz', origenEnvase: 'mercadona' }, registro })).toEqual([]);
  });

  test('the chain declares the name the shopper reads', () => {
    expect(registro.get('cadenafalsa').nombre).toBe('Cadena falsa');
  });
});
