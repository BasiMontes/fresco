import { describe, expect, test } from 'bun:test';
import { packPrice } from '../estimate-menu-cost';
import { INGREDIENT_DICTIONARY } from '../ingredient-dictionary';
import { mapShoppingListItem } from '../map-item';
import { conectorConsum, conectorMercadona, ZONA_CATALOGO } from './catalog-connectors';
import { puedeEjecutarse } from './connector';
import { registroSupermercados } from './registry';

/**
 * FRESCO-767 AC: the connectors return the same price the app shows today.
 * "Today" is `packPrice` (Mercadona) and `precioConsum.precio` (Consum), read
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
    const hoy = INGREDIENT_DICTIONARY[clave].precioConsum!.precio;
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
