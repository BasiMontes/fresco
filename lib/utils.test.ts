import { describe, expect, test } from 'bun:test';
import { formatCantidad, formatImporte, formatPrecio } from './utils';

describe('formatImporte / formatPrecio (FRESCO-819)', () => {
  test('two decimals with a comma, symbol glued after the figure', () => {
    expect(formatImporte(3.5)).toBe('3,50');
    expect(formatPrecio(3.5)).toBe('3,50€');
    expect(formatPrecio(4.99)).toBe('4,99€');
    expect(formatPrecio(0)).toBe('0,00€');
  });

  test('groups thousands from five digits, like es-ES', () => {
    expect(formatPrecio(12345.5)).toBe('12.345,50€');
  });
});

describe('formatCantidad (FRESCO-819)', () => {
  test('decimal comma, no trailing zeros, at most two decimals', () => {
    expect(formatCantidad(1.6)).toBe('1,6');
    expect(formatCantidad(2)).toBe('2');
    expect(formatCantidad(0.25)).toBe('0,25');
    expect(formatCantidad(0.333333)).toBe('0,33');
  });
});
