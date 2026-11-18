import type { CompraPorItem, LineaCompra } from './compra';
import { describe, expect, test } from 'bun:test';
import { cobertura, precioQueCuenta, totalDeLista } from '@/components/shopping-list/shopping-list-format';
import { claveItemCompra, precioCuentaComoVigente } from './compra';
import { totalesReales } from './estimacion-cadenas';

/**
 * FRESCO-1237 — one rule for "does this row's price count": a price counts when it is recent or old but still shown.
 * No date and hidden for age do not. The list total, its coverage line and the "Comparar tu compra" card all ask it.
 */
describe('precioCuentaComoVigente', () => {
  test.each([
    [null, false, 'no date'],
    [0, true, 'today'],
    [13, true, 'recent'],
    [14, true, 'old but shown (FRESCO-1028 threshold)'],
    [30, true, 'last day shown'],
    [31, false, 'hidden for age'],
  ])('%p days: counts = %p (%s)', (dias, esperado) => {
    expect(precioCuentaComoVigente(dias)).toBe(esperado);
  });
});

const enlace = (dias: number | null) => ({ cadena: 'mercadona', nombreCadena: 'Mercadona', url: 'https://example.test', antiguedadDias: dias });
const enlazada = (precio: number, dias: number | null): LineaCompra => ({ precio, precioEnlazado: precio, enlaces: [enlace(dias)] });
const fila = (nombre: string) => ({ nombre, cantidad: 1, unidad: 'ud', comprado: false });

const FILAS: { nombre: string, linea: LineaCompra | undefined, cuenta: boolean }[] = [
  { nombre: 'reciente', linea: enlazada(1, 3), cuenta: true },
  { nombre: 'antiguo', linea: enlazada(2, 20), cuenta: true },
  { nombre: 'sin fecha', linea: enlazada(4, null), cuenta: false },
  { nombre: 'oculto', linea: enlazada(8, 45), cuenta: false },
  { nombre: 'sin precio', linea: undefined, cuenta: false },
  { nombre: 'precio cero', linea: { precio: 0, precioEnlazado: 0, enlaces: [enlace(2)] }, cuenta: false },
  // Priced by the stored per-gram estimate, not by the linked product: the list counts it, the chain card never does.
  { nombre: 'solo estimacion', linea: { precio: 16, enlaces: [enlace(2)] }, cuenta: true },
  { nombre: 'estimacion sin fecha', linea: { precio: 32, enlaces: [enlace(null)] }, cuenta: false },
];

const pasillos = [{ nombre: 'A', items: FILAS.map(f => fila(f.nombre)) }];
const compra: CompraPorItem = Object.fromEntries(
  FILAS.flatMap(f => (f.linea ? [[claveItemCompra({ pasillo: 'A', item: f.nombre }), f.linea]] : [])),
);

describe('precioQueCuenta', () => {
  test.each(FILAS)('$nombre', ({ nombre, linea, cuenta }) => {
    expect(precioQueCuenta({ item: fila(nombre), linea }) !== undefined).toBe(cuenta);
  });

  test('a stored estimate on a row with no link counts', () => {
    expect(precioQueCuenta({ item: { ...fila('x'), precio_estimado: 0.5 }, linea: undefined })).toBe(0.5);
  });
});

describe('list total and comparison card agree (FRESCO-1237)', () => {
  test('the list total sums exactly the rows that count', () => {
    const esperado = FILAS.filter(f => f.cuenta).reduce((s, f) => s + (f.linea?.precio ?? 0), 0);
    expect(totalDeLista({ pasillos, compra })).toBe(esperado);
    expect(cobertura({ pasillos, compra })).toEqual({ conPrecio: FILAS.filter(f => f.cuenta).length, articulos: FILAS.length });
  });

  test('both count the same rows among those priced by a linked product', () => {
    const nombres = FILAS.filter(f => f.linea?.precioEnlazado !== undefined).map(f => f.nombre);
    const lista = { pasillos: [{ nombre: 'A', items: nombres.map(fila) }], compra };
    const [mercadona] = totalesReales(lista);
    expect(mercadona?.incluidos).toBe(cobertura(lista).conPrecio);
    expect(mercadona?.importe).toBe(totalDeLista(lista) ?? 0);
    expect(mercadona?.importe).toBe(3);
  });

  test('a list whose only price has no date shows no total and no covered row', () => {
    const solo = { pasillos: [{ nombre: 'A', items: [fila('sin fecha')] }], compra };
    expect(totalDeLista(solo)).toBeUndefined();
    expect(cobertura(solo).conPrecio).toBe(0);
    expect(totalesReales(solo)).toEqual([]);
  });
});
