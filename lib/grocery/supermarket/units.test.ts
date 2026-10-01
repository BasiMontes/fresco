import { describe, expect, test } from 'bun:test';
import { aUnidadBase, precioEnvaseDesdeReferencia, precioPorUnidadReferencia } from './units';

describe('aUnidadBase', () => {
  test('converts kg and l to the base units g and ml', () => {
    expect(aUnidadBase(1, 'kg')).toEqual({ cantidad: 1000, unidad: 'g' });
    expect(aUnidadBase(1.5, 'l')).toEqual({ cantidad: 1500, unidad: 'ml' });
    expect(aUnidadBase(33, 'cl')).toEqual({ cantidad: 330, unidad: 'ml' });
  });

  test('is case-insensitive and ignores surrounding spaces', () => {
    expect(aUnidadBase(1, ' L ')).toEqual({ cantidad: 1000, unidad: 'ml' });
    expect(aUnidadBase(2, 'KG')).toEqual({ cantidad: 2000, unidad: 'g' });
  });

  test('keeps countable units as units', () => {
    expect(aUnidadBase(12, 'ud')).toEqual({ cantidad: 12, unidad: 'unidad' });
    expect(aUnidadBase(6, 'unidades')).toEqual({ cantidad: 6, unidad: 'unidad' });
  });

  test('returns null for an unknown unit or a non-finite quantity', () => {
    expect(aUnidadBase(1, 'cabeza')).toBeNull();
    expect(aUnidadBase(Number.NaN, 'g')).toBeNull();
  });
});

describe('precioEnvaseDesdeReferencia', () => {
  test('a price per litre becomes the price of a 1 l pack', () => {
    const precio = precioEnvaseDesdeReferencia({
      precioReferencia: 3.9,
      referencia: { cantidad: 1, unidad: 'l' },
      envase: { cantidad: 1000, unidad: 'ml' },
    });
    expect(precio).toBe(3.9);
  });

  test('a price per 100 g becomes the price of a smaller pack, not the reference price', () => {
    const precio = precioEnvaseDesdeReferencia({
      precioReferencia: 3.5,
      referencia: { cantidad: 100, unidad: 'g' },
      envase: { cantidad: 40, unidad: 'g' },
    });
    expect(precio).toBe(1.4);
  });

  test('rounds to cents', () => {
    const precio = precioEnvaseDesdeReferencia({
      precioReferencia: 2.55,
      referencia: { cantidad: 1, unidad: 'kg' },
      envase: { cantidad: 410, unidad: 'g' },
    });
    expect(precio).toBe(1.05);
  });

  test('returns null when the reference and the pack are different families', () => {
    expect(precioEnvaseDesdeReferencia({
      precioReferencia: 3.9,
      referencia: { cantidad: 1, unidad: 'l' },
      envase: { cantidad: 1000, unidad: 'g' },
    })).toBeNull();
  });

  test('returns null for an unknown reference unit or a non-positive reference quantity', () => {
    const envase = { cantidad: 500, unidad: 'g' } as const;
    expect(precioEnvaseDesdeReferencia({ precioReferencia: 1, referencia: { cantidad: 1, unidad: '???' }, envase })).toBeNull();
    expect(precioEnvaseDesdeReferencia({ precioReferencia: 1, referencia: { cantidad: 0, unidad: 'kg' }, envase })).toBeNull();
  });
});

describe('precioPorUnidadReferencia', () => {
  test('grams give a price per kg', () => {
    expect(precioPorUnidadReferencia({ precioEnvase: 1.6, envase: { cantidad: 500, unidad: 'g' } })).toEqual({ precio: 3.2, por: 'kg' });
  });

  test('millilitres give a price per litre', () => {
    expect(precioPorUnidadReferencia({ precioEnvase: 0.5, envase: { cantidad: 250, unidad: 'ml' } })).toEqual({ precio: 2, por: 'l' });
  });

  test('countable units give a price per unit', () => {
    const referencia = precioPorUnidadReferencia({ precioEnvase: 3.12, envase: { cantidad: 12, unidad: 'unidad' } });
    expect(referencia.por).toBe('unidad');
    expect(referencia.precio).toBeCloseTo(0.26, 5);
  });

  test('makes two pack sizes comparable', () => {
    const grande = precioPorUnidadReferencia({ precioEnvase: 1.45, envase: { cantidad: 1000, unidad: 'g' } });
    const pequeno = precioPorUnidadReferencia({ precioEnvase: 1.6, envase: { cantidad: 500, unidad: 'g' } });
    expect(grande.precio).toBeLessThan(pequeno.precio);
  });
});
