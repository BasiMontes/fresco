import { describe, expect, test } from 'bun:test';
import { antiguedadEnDias, claveItemCompra } from './compra';
import { resolverCompra } from './shopping-list-compra';

const AHORA = new Date('2026-10-05T12:00:00.000Z');

describe('antiguedadEnDias', () => {
  test.each([
    ['2026-10-05T06:00:00.000Z', 0],
    ['2026-10-04T12:00:00.000Z', 1],
    ['2026-10-02T12:00:00.000Z', 3],
  ])('%s is %i days old', (observadoEn, dias) => {
    expect(antiguedadEnDias({ observadoEn, ahora: AHORA })).toBe(dias);
  });

  test('the Unix epoch the static catalogs use means "no date known"', () => {
    expect(antiguedadEnDias({ observadoEn: '1970-01-01T00:00:00.000Z', ahora: AHORA })).toBeNull();
  });

  test('an unparseable instant is unknown, not NaN', () => {
    expect(antiguedadEnDias({ observadoEn: 'not a date', ahora: AHORA })).toBeNull();
  });

  test('a date in the future counts as today', () => {
    expect(antiguedadEnDias({ observadoEn: '2026-10-06T12:00:00.000Z', ahora: AHORA })).toBe(0);
  });
});

describe('resolverCompra', () => {
  const pasillos = [{
    nombre: 'Aceites',
    items: [
      { nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml', comprado: false },
      { nombre: 'aguacate', cantidad: 1, unidad: 'unidades', comprado: false, precio_estimado: 0.9 },
    ],
  }];

  test('a catalog-backed row gets a priced link named after its chain', () => {
    const compra = resolverCompra({ pasillos, ahora: AHORA });
    const linea = compra[claveItemCompra({ pasillo: 'Aceites', item: 'aceite de oliva' })];

    expect(linea.precio).toBeGreaterThan(0);
    expect(linea.enlaces).toHaveLength(1);
    expect(linea.enlaces[0]).toMatchObject({ cadena: 'mercadona', nombreCadena: 'Mercadona' });
    expect(linea.enlaces[0].url).toStartWith('https://');
  });

  test('the static catalogs carry no date, so the row reports no age', () => {
    const compra = resolverCompra({ pasillos, ahora: AHORA });

    expect(compra[claveItemCompra({ pasillo: 'Aceites', item: 'aceite de oliva' })].enlaces[0].antiguedadDias).toBeNull();
  });

  test('a row with no catalog match has no link and keeps its stored estimate', () => {
    const compra = resolverCompra({ pasillos, ahora: AHORA });
    const linea = compra[claveItemCompra({ pasillo: 'Aceites', item: 'aguacate' })];

    expect(linea.enlaces).toEqual([]);
    expect(linea.precio).toBe(0.9);
  });

  test('the diet profile drops an incompatible product (FRESCO-826)', () => {
    const caldo = [{ nombre: 'Conservas', items: [{ nombre: 'caldo', cantidad: 500, unidad: 'ml', comprado: false, precio_estimado: 1.5 }] }];
    const clave = claveItemCompra({ pasillo: 'Conservas', item: 'caldo' });

    expect(resolverCompra({ pasillos: caldo, ahora: AHORA })[clave].enlaces).toHaveLength(1);
    expect(resolverCompra({ pasillos: caldo, perfil: { vegano: true }, ahora: AHORA })[clave].enlaces).toEqual([]);
  });

  test('the same name in two aisles does not collide', () => {
    const dos = [
      { nombre: 'A', items: [{ nombre: 'sal', cantidad: 1, unidad: 'g', comprado: false, precio_estimado: 1 }] },
      { nombre: 'B', items: [{ nombre: 'sal', cantidad: 1, unidad: 'g', comprado: false, precio_estimado: 2 }] },
    ];
    const compra = resolverCompra({ pasillos: dos, ahora: AHORA });

    expect(Object.keys(compra)).toHaveLength(2);
  });
});
