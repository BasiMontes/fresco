import type { EstadoPermiso } from './connector';
import { describe, expect, test } from 'bun:test';
import {
  BloqueoError,
  crearRegistro,
  LimiteDeTasaError,
  PermisoNoConcedidoError,
  puedeEjecutarse,
} from './connector';
import { crearConectorFalso, ZONA_FALSA } from './fake-connector';

describe('puedeEjecutarse (the legal gate)', () => {
  test('consent and an accepted risk both run when they cite a reference', () => {
    expect(puedeEjecutarse({ permiso: 'concedido', permisoRef: 'FRESCO-532' })).toBe(true);
    expect(puedeEjecutarse({ permiso: 'riesgo-aceptado', permisoRef: 'ADR-0028' })).toBe(true);
  });

  test('a pending or rejected permission never runs', () => {
    expect(puedeEjecutarse({ permiso: 'pendiente', permisoRef: 'FRESCO-764' })).toBe(false);
    expect(puedeEjecutarse({ permiso: 'rechazado', permisoRef: 'FRESCO-764' })).toBe(false);
  });

  test('fail-closed: a runnable state with an empty or blank reference does not run', () => {
    expect(puedeEjecutarse({ permiso: 'concedido', permisoRef: '' })).toBe(false);
    expect(puedeEjecutarse({ permiso: 'riesgo-aceptado', permisoRef: '   ' })).toBe(false);
  });

  test('fail-closed: an unexpected permission value does not run', () => {
    const inesperado = 'si' as unknown as EstadoPermiso;
    expect(puedeEjecutarse({ permiso: inesperado, permisoRef: 'ADR-0028' })).toBe(false);
  });
});

describe('crearRegistro', () => {
  const concedido = crearConectorFalso({ cadena: 'a', permiso: 'concedido', permisoRef: 'FRESCO-1' });
  const pendiente = crearConectorFalso({ cadena: 'b', permiso: 'pendiente', permisoRef: 'FRESCO-2' });
  const aceptado = crearConectorFalso({ cadena: 'c', permiso: 'riesgo-aceptado', permisoRef: 'ADR-0028' });

  test('get returns a connector that may run', () => {
    const registro = crearRegistro([concedido, pendiente, aceptado]);
    expect(registro.get('a')).toBe(concedido);
    expect(registro.get('c')).toBe(aceptado);
  });

  test('get refuses a connector whose permission is pending', () => {
    const registro = crearRegistro([concedido, pendiente]);
    expect(() => registro.get('b')).toThrow(PermisoNoConcedidoError);
  });

  test('get throws for a chain that is not registered', () => {
    expect(() => crearRegistro([concedido]).get('desconocida')).toThrow('No connector registered');
  });

  test('activos lists only the connectors that may run', () => {
    const registro = crearRegistro([concedido, pendiente, aceptado]);
    expect(registro.activos().map(c => c.cadena)).toEqual(['a', 'c']);
  });

  test('estado reports every connector, runnable or not', () => {
    const registro = crearRegistro([concedido, pendiente]);
    expect(registro.estado()).toEqual([
      { cadena: 'a', permiso: 'concedido', permisoRef: 'FRESCO-1', ejecutable: true },
      { cadena: 'b', permiso: 'pendiente', permisoRef: 'FRESCO-2', ejecutable: false },
    ]);
  });

  test('registering the same chain twice is an error', () => {
    expect(() => crearRegistro([concedido, concedido])).toThrow('Duplicate connector');
  });
});

describe('errors', () => {
  test('LimiteDeTasaError carries the wait time', () => {
    const error = new LimiteDeTasaError('a', 30_000);
    expect(error.reintentarEnMs).toBe(30_000);
    expect(error.name).toBe('LimiteDeTasaError');
  });

  test('BloqueoError names the chain', () => {
    expect(new BloqueoError('a').message).toContain('a');
  });
});

describe('crearConectorFalso (synthetic fixtures, no real chain)', () => {
  const conector = crearConectorFalso();

  test('searches by name, ignoring case and accents', async () => {
    const encontrados = await conector.buscarProductos('ARROZ', ZONA_FALSA);
    expect(encontrados.map(p => p.idExterno)).toEqual(['p-001', 'p-002', 'p-003']);
  });

  test('prices are per whole pack and the contract fields are filled', async () => {
    const [arroz] = await conector.buscarProductos('arroz redondo', ZONA_FALSA);
    expect(arroz).toMatchObject({
      cadena: 'tiendafalsa',
      envase: { cantidad: 1000, unidad: 'g' },
      precioEnvase: 1.45,
      disponible: true,
      zona: ZONA_FALSA,
    });
  });

  test('a different zone has no products', async () => {
    expect(await conector.buscarProductos('arroz', 'otra-zona')).toEqual([]);
  });

  test('obtenerProducto returns the product or null', async () => {
    expect((await conector.obtenerProducto('p-004', ZONA_FALSA))?.nombre).toBe('Leche entera brik');
    expect(await conector.obtenerProducto('no-existe', ZONA_FALSA)).toBeNull();
  });

  test('the chain name is configurable', async () => {
    const otro = crearConectorFalso({ cadena: 'otra' });
    const [producto] = await otro.buscarProductos('arroz', ZONA_FALSA);
    expect(producto.cadena).toBe('otra');
  });
});
